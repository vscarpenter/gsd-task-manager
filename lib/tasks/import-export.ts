import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import {
  archivedTaskRecordSchema,
  importPayloadSchema,
  taskRecordSchema,
  trashedTaskRecordSchema,
} from "@/lib/schema";
import type { ImportPayload, TaskRecord } from "@/lib/types";
import type { SyncQueue } from "@/lib/sync/queue";
import { isoNow } from "@/lib/utils";

/** Maximum number of tasks allowed in a single import to prevent storage DoS */
const MAX_IMPORT_TASKS = 10_000;

/** Maximum raw JSON string size (10 MB) to prevent memory exhaustion */
const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

/** Envelope version written by this build. See docs/adr/0014. */
const BACKUP_ENVELOPE_VERSION = "2.1.0";

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

/**
 * Read the archive, keeping only rows that pass the archived-record schema.
 *
 * Deliberately NOT `taskRecordSchema`: that schema is `.strict()` and declares no
 * `archivedAt`, so every archived row would fail and be counted as corrupt —
 * producing an empty archive in the backup that looks like an empty archive on
 * disk. See ADR 0014.
 */
async function collectExportableArchive(): Promise<{ tasks: TaskRecord[]; skippedCount: number }> {
  const db = getDb();
  const archived = await db.archivedTasks.toArray();
  const normalized: TaskRecord[] = [];
  let skippedCount = 0;
  for (const task of archived) {
    const result = archivedTaskRecordSchema.safeParse(task);
    if (result.success) {
      normalized.push(result.data as TaskRecord);
    } else {
      skippedCount++;
      logger.warn('Skipping corrupt archived task during export', { taskId: task.id });
    }
  }
  return { tasks: normalized, skippedCount };
}

/**
 * Collect every user-owned store for a backup.
 *
 * Device-local and account-identifying stores are excluded by omission rather
 * than by filtering: `syncMetadata` carries email / userId / deviceId, and a
 * backup is a file people mail themselves. See ADR 0014 for the full table.
 */
/** Trash rows for the backup. Restoring one resumes its retention clock. */
async function collectExportableTrash(): Promise<{ tasks: TaskRecord[]; skippedCount: number }> {
  const db = getDb();
  const trashed = await db.deletedTasks.toArray();
  const normalized: TaskRecord[] = [];
  let skippedCount = 0;
  for (const task of trashed) {
    const result = trashedTaskRecordSchema.safeParse(task);
    if (result.success) normalized.push(result.data as TaskRecord);
    else {
      skippedCount++;
      logger.warn('Skipping corrupt trashed task during export', { taskId: task.id });
    }
  }
  return { tasks: normalized, skippedCount };
}

async function collectUserOwnedStores() {
  const db = getDb();
  const [smartViews, notificationSettings, archiveSettings, appPreferences] = await Promise.all([
    db.smartViews.toArray(),
    db.notificationSettings.get("settings"),
    db.archiveSettings.get("settings"),
    db.appPreferences.get("preferences"),
  ]);
  return { smartViews, notificationSettings, archiveSettings, appPreferences };
}

/**
 * Build the backup envelope once, reporting how many records were unreadable.
 *
 * Single source for both `exportTasks` and `exportToJsonWithReport`, so the file
 * a user downloads can never contain less than the API says it does.
 */
async function buildBackup(): Promise<{ payload: ImportPayload; skippedCount: number }> {
  const [live, archive, trash, stores] = await Promise.all([
    collectExportableTasks(),
    collectExportableArchive(),
    collectExportableTrash(),
    collectUserOwnedStores(),
  ]);

  const payload: ImportPayload = {
    version: BACKUP_ENVELOPE_VERSION,
    exportedAt: isoNow(),
    tasks: live.tasks,
    archivedTasks: archive.tasks,
    deletedTasks: trash.tasks,
    smartViews: stores.smartViews as ImportPayload["smartViews"],
    ...(stores.notificationSettings ? { notificationSettings: stores.notificationSettings } : {}),
    ...(stores.archiveSettings ? { archiveSettings: stores.archiveSettings } : {}),
    ...(stores.appPreferences ? { appPreferences: stores.appPreferences } : {}),
  };

  return {
    payload,
    skippedCount: live.skippedCount + archive.skippedCount + trash.skippedCount,
  };
}

/**
 * Export every user-owned store as a structured payload (envelope 2.0.0).
 */
export async function exportTasks(): Promise<ImportPayload> {
  return (await buildBackup()).payload;
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
 * Write the archive, upholding the ADR 0013 tombstone rules.
 *
 * Rule 1 — an id lives in `tasks` or `archivedTasks`, never both. A payload
 * listing an id in both is self-contradictory; the live copy wins and the
 * archived duplicate is dropped, because resurrecting a tombstone over live work
 * loses data while dropping a redundant tombstone does not.
 *
 * Rule 3 — `put`, never `add`, so a re-import cannot raise a ConstraintError and
 * abort the surrounding transaction.
 *
 * Returns the number of archived records dropped, so the caller can report it
 * rather than swallow it.
 */
async function applyArchivedTasks(
  archivedTasks: TaskRecord[] | undefined,
  mode: "replace" | "merge"
): Promise<number> {
  // Silence is not an instruction to delete: a 1.0.0 backup says nothing about
  // the archive, so replace must leave it alone.
  if (!archivedTasks) return 0;

  const db = getDb();
  if (mode === "replace") await db.archivedTasks.clear();

  const liveIds = new Set((await db.tasks.toCollection().primaryKeys()) as string[]);
  const existingArchivedIds =
    mode === "merge"
      ? new Set((await db.archivedTasks.toCollection().primaryKeys()) as string[])
      : new Set<string>();

  let dropped = 0;
  for (const task of archivedTasks) {
    if (liveIds.has(task.id)) {
      dropped++;
      continue;
    }
    if (existingArchivedIds.has(task.id)) continue;
    await db.archivedTasks.put(task);
  }
  return dropped;
}

/**
 * Restore the trash. Same rules as the archive: an absent key means the backup
 * says nothing about trash, and a record already live elsewhere is skipped so an
 * id never occupies two lifecycle tables (ADR 0013, extended by ADR 0015).
 */
async function applyTrashedTasks(
  deletedTasks: TaskRecord[] | undefined,
  mode: "replace" | "merge"
): Promise<void> {
  if (!deletedTasks) return;
  const db = getDb();
  if (mode === "replace") await db.deletedTasks.clear();

  const liveIds = new Set((await db.tasks.toCollection().primaryKeys()) as string[]);
  const archivedIds = new Set((await db.archivedTasks.toCollection().primaryKeys()) as string[]);

  for (const task of deletedTasks) {
    if (liveIds.has(task.id) || archivedIds.has(task.id)) continue;
    await db.deletedTasks.put(task);
  }
}

async function applySmartViews(
  smartViews: ImportPayload["smartViews"],
  mode: "replace" | "merge"
): Promise<void> {
  if (!smartViews) return;
  const db = getDb();
  if (mode === "replace") await db.smartViews.clear();
  for (const view of smartViews) {
    await db.smartViews.put(view as never);
  }
}

/** Settings singletons, applied on the restore path only. */
async function applySettings(parsed: ImportPayload): Promise<void> {
  const db = getDb();
  if (parsed.notificationSettings) await db.notificationSettings.put(parsed.notificationSettings);
  if (parsed.archiveSettings) await db.archiveSettings.put(parsed.archiveSettings);
  if (parsed.appPreferences) await db.appPreferences.put(parsed.appPreferences);
}

/** Every table a restore writes. A narrower scope would let a partial restore commit. */
function importTransactionTables(db: ReturnType<typeof getDb>) {
  return [
    db.tasks,
    db.archivedTasks,
    db.deletedTasks,
    db.smartViews,
    db.notificationSettings,
    db.archiveSettings,
    db.appPreferences,
    db.syncQueue,
  ];
}

/** Write the live-task table, returning what sync needs to hear about. */
async function applyTasks(
  tasks: TaskRecord[],
  mode: "replace" | "merge"
): Promise<{ created: TaskRecord[]; deletedIds: string[] }> {
  const db = getDb();

  if (mode === "replace") {
    const existingIds = new Set((await db.tasks.toCollection().primaryKeys()) as string[]);
    const importedIds = new Set(tasks.map(t => t.id));
    const deletedIds = [...existingIds].filter(id => !importedIds.has(id));

    await db.tasks.clear();
    await db.tasks.bulkAdd(tasks);
    return { created: tasks, deletedIds };
  }

  const existingTasks = await db.tasks.toArray();
  const existingIds = new Set(existingTasks.map(t => t.id));
  const { tasks: regeneratedTasks, idMap } = regenerateConflictingIds(tasks, existingIds);
  const tasksToImport = remapTaskReferences(regeneratedTasks, idMap);
  await db.tasks.bulkAdd(tasksToImport);
  return { created: tasksToImport, deletedIds: [] };
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
  let droppedArchivedCount = 0;

  await db.transaction(
    "rw",
    importTransactionTables(db),
    async () => {
      ({ created: tasksToCreate, deletedIds: taskIdsToDelete } = await applyTasks(parsed.tasks, mode));

      droppedArchivedCount = await applyArchivedTasks(parsed.archivedTasks, mode);
      await applyTrashedTasks(parsed.deletedTasks, mode);
      await applySmartViews(parsed.smartViews, mode);
      // Settings belong to the restore path: merging combines task lists, it
      // does not adopt another device's configuration.
      if (mode === "replace") await applySettings(parsed);

      if (syncEnabled) {
        // Archived rows are never synced — the remote copy is deleted when a
        // task is archived (ADR 0013).
        await Promise.all([
          ...taskIdsToDelete.map((id) => queue.enqueue('delete', id, null)),
          ...tasksToCreate.map((task) => queue.enqueue('create', task.id, task)),
        ]);
      }
    });

  if (droppedArchivedCount > 0) {
    logger.warn('Dropped archived records that were also present as live tasks', {
      count: droppedArchivedCount,
    });
  }

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
  // Shares buildBackup with exportTasks: this is the path the Settings "Export
  // tasks" button uses, so anything it omits is omitted from every backup a user
  // actually takes.
  const { payload, skippedCount } = await buildBackup();
  return { json: JSON.stringify(payload, null, 2), skippedCount };
}

/**
 * Export all tasks as a JSON string
 */
export async function exportToJson(): Promise<string> {
  return (await exportToJsonWithReport()).json;
}
