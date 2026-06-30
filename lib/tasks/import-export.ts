import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import { importPayloadSchema, taskRecordSchema } from "@/lib/schema";
import type { ImportPayload, TaskRecord } from "@/lib/types";
import type { SyncQueue } from "@/lib/sync/queue";
import { isoNow } from "@/lib/utils";

/** Maximum number of tasks allowed in a single import to prevent storage DoS */
const MAX_IMPORT_TASKS = 10_000;

/** Maximum raw JSON string size (10 MB) to prevent memory exhaustion */
const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

const logger = createLogger("IMPORT");

/** An export plus a count of tasks dropped because they failed validation. */
export interface ExportReport {
  json: string;
  /** Number of stored tasks excluded from the backup as unreadable/corrupt. */
  skippedCount: number;
}

/**
 * Read all tasks, keeping only those that pass the strict schema. A corrupt
 * task is skipped (not thrown) so one bad record never aborts the whole backup,
 * but the count is returned so callers can surface it instead of losing data
 * silently.
 */
async function collectExportableTasks(): Promise<{ tasks: TaskRecord[]; skippedCount: number }> {
  const db = getDb();
  const tasks = await db.tasks.toArray();
  const normalized: TaskRecord[] = [];
  let skippedCount = 0;
  for (const task of tasks) {
    const result = taskRecordSchema.safeParse(task);
    if (result.success) {
      normalized.push(result.data);
    } else {
      skippedCount++;
      logger.warn('Skipping corrupt task during export', { taskId: task.id });
    }
  }
  return { tasks: normalized, skippedCount };
}

function toPayload(tasks: TaskRecord[]): ImportPayload {
  return { tasks, exportedAt: isoNow(), version: "1.0.0" } satisfies ImportPayload;
}

/**
 * Export all tasks as a structured payload
 */
export async function exportTasks(): Promise<ImportPayload> {
  const { tasks } = await collectExportableTasks();
  return toPayload(tasks);
}

/**
 * Regenerate IDs for tasks that conflict with existing IDs
 *
 * Prevents ID collisions when merging imported tasks with existing tasks.
 * Also regenerates subtask IDs to maintain consistency.
 */
function regenerateConflictingIds(
  tasks: TaskRecord[],
  existingIds: Set<string>
): { tasks: TaskRecord[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();

  const updatedTasks = tasks.map(task => {
    // If ID already exists, regenerate it
    if (existingIds.has(task.id)) {
      const newId = generateId();
      idMap.set(task.id, newId);
      return {
        ...task,
        id: newId,
        // Also regenerate subtask IDs to avoid conflicts
        subtasks: task.subtasks.map(subtask => ({
          ...subtask,
          id: generateId()
        }))
      };
    }
    return task;
  });

  return { tasks: updatedTasks, idMap };
}

/**
 * Update task references (dependencies, parentTaskId) after ID regeneration
 */
function remapTaskReferences(
  tasks: TaskRecord[],
  idMap: Map<string, string>
): TaskRecord[] {
  if (idMap.size === 0) {
    return tasks;
  }

  return tasks.map(task => {
    const originalDeps = task.dependencies ?? [];
    const updatedDependencies = originalDeps.map(depId => idMap.get(depId) ?? depId);
    const updatedParentTaskId = task.parentTaskId ? (idMap.get(task.parentTaskId) ?? task.parentTaskId) : undefined;

    const dependenciesChanged =
      updatedDependencies.length !== originalDeps.length ||
      updatedDependencies.some((depId, index) => depId !== originalDeps[index]);

    const parentChanged = updatedParentTaskId !== task.parentTaskId;

    if (!dependenciesChanged && !parentChanged) {
      return task;
    }

    return {
      ...task,
      dependencies: updatedDependencies,
      parentTaskId: updatedParentTaskId,
    };
  });
}

/** Resolve sync modules outside transaction to avoid detaching Dexie context */
async function resolveSyncDeps(): Promise<{ syncEnabled: boolean; queue: SyncQueue; scheduleSyncAfterChange: () => void }> {
  const [{ getSyncConfig }, { getSyncQueue }, { scheduleSyncAfterChange }] = await Promise.all([
    import("@/lib/sync/config"),
    import("@/lib/sync/queue"),
    import("@/lib/tasks/crud/helpers"),
  ]);
  const syncConfig = await getSyncConfig();
  return {
    syncEnabled: !!syncConfig?.enabled,
    queue: getSyncQueue(),
    scheduleSyncAfterChange,
  };
}

/**
 * Import tasks from a payload with merge or replace mode
 */
export async function importTasks(payload: ImportPayload, mode: "replace" | "merge" = "replace"): Promise<void> {
  const db = getDb();
  const result = importPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid import data: ${result.error.issues.map(i => i.message).join(", ")}`);
  }
  const parsed = result.data;

  if (parsed.tasks.length > MAX_IMPORT_TASKS) {
    throw new Error(`Import exceeds maximum of ${MAX_IMPORT_TASKS.toLocaleString()} tasks. Please split into smaller files.`);
  }

  const { syncEnabled, queue, scheduleSyncAfterChange } = await resolveSyncDeps();

  let tasksToCreate: TaskRecord[] = [];
  let taskIdsToDelete: string[] = [];

  await db.transaction("rw", [db.tasks, db.syncQueue], async () => {
    if (mode === "replace") {
      const existingIds = new Set(
        (await db.tasks.toCollection().primaryKeys()) as string[],
      );
      const importedIds = new Set(parsed.tasks.map(t => t.id));
      taskIdsToDelete = [...existingIds].filter(id => !importedIds.has(id));

      await db.tasks.clear();
      await db.tasks.bulkAdd(parsed.tasks);
      tasksToCreate = parsed.tasks;
    } else {
      const existingTasks = await db.tasks.toArray();
      const existingIds = new Set(existingTasks.map(t => t.id));
      const { tasks: regeneratedTasks, idMap } = regenerateConflictingIds(parsed.tasks, existingIds);
      const tasksToImport = remapTaskReferences(regeneratedTasks, idMap);
      await db.tasks.bulkAdd(tasksToImport);
      tasksToCreate = tasksToImport;
    }

    if (syncEnabled) {
      await Promise.all([
        ...taskIdsToDelete.map((id) => queue.enqueue('delete', id, null)),
        ...tasksToCreate.map((task) => queue.enqueue('create', task.id, task)),
      ]);
    }
  });

  if (syncEnabled) {
    scheduleSyncAfterChange();
  }
}

/**
 * Import tasks from JSON string with merge or replace mode
 */
export async function importFromJson(raw: string, mode: "replace" | "merge" = "replace"): Promise<void> {
  const importSizeBytes = getUtf8ByteLength(raw);
  if (importSizeBytes > MAX_IMPORT_SIZE_BYTES) {
    throw new Error(`Import file is too large (${(importSizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_IMPORT_SIZE_BYTES / 1024 / 1024} MB.`);
  }

  try {
    const payload = JSON.parse(raw);
    await importTasks(payload, mode);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format. Please ensure you selected a valid export file.");
    }
    // Re-throw validation errors from importTasks/schema with their original messages
    throw error;
  }
}

/**
 * Export all tasks as a JSON string plus a report of how many were skipped.
 * Use this when you need to tell the user that some records were unreadable.
 */
export async function exportToJsonWithReport(): Promise<ExportReport> {
  const { tasks, skippedCount } = await collectExportableTasks();
  return { json: JSON.stringify(toPayload(tasks), null, 2), skippedCount };
}

/**
 * Export all tasks as a JSON string
 */
export async function exportToJson(): Promise<string> {
  return (await exportToJsonWithReport()).json;
}
