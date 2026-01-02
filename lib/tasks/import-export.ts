import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { importPayloadSchema, taskRecordSchema } from "@/lib/schema";
import type { ImportPayload, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";

/**
 * Export all tasks as a structured payload
 */
export async function exportTasks(): Promise<ImportPayload> {
  const db = getDb();
  const tasks = await db.tasks.toArray();
  const normalized = tasks.map((task) => taskRecordSchema.parse(task));
  return {
    tasks: normalized,
    exportedAt: isoNow(),
    version: "1.0.0"
  } satisfies ImportPayload;
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
    const updatedDependencies = (task.dependencies ?? []).map(depId => idMap.get(depId) ?? depId);
    const updatedParentTaskId = task.parentTaskId ? (idMap.get(task.parentTaskId) ?? task.parentTaskId) : undefined;

    const dependenciesChanged =
      updatedDependencies.length !== (task.dependencies ?? []).length ||
      updatedDependencies.some((depId, index) => depId !== (task.dependencies ?? [])[index]);

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

/**
 * Import tasks from a payload with merge or replace mode
 */
export async function importTasks(payload: ImportPayload, mode: "replace" | "merge" = "replace"): Promise<void> {
  const db = getDb();
  const parsed = importPayloadSchema.parse(payload);

  await db.transaction("rw", db.tasks, async () => {
    if (mode === "replace") {
      // Replace mode: clear existing and add imported tasks
      await db.tasks.clear();
      await db.tasks.bulkAdd(parsed.tasks);
    } else {
      // Merge mode: keep existing, add imported with regenerated IDs if needed
      const existingTasks = await db.tasks.toArray();
      const existingIds = new Set(existingTasks.map(t => t.id));
      const { tasks: regeneratedTasks, idMap } = regenerateConflictingIds(parsed.tasks, existingIds);
      const tasksToImport = remapTaskReferences(regeneratedTasks, idMap);
      await db.tasks.bulkAdd(tasksToImport);
    }
  });
}

/**
 * Import tasks from JSON string with merge or replace mode
 */
export async function importFromJson(raw: string, mode: "replace" | "merge" = "replace"): Promise<void> {
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
 * Export all tasks as a JSON string
 */
export async function exportToJson(): Promise<string> {
  const payload = await exportTasks();
  return JSON.stringify(payload, null, 2);
}
