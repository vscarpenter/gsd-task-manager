import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import {
  runTaskSyncTransaction,
  type TransactionalSyncEnqueue,
} from "./crud/helpers";

/**
 * Add a dependency to a task
 */
export async function addDependency(taskId: string, dependencyId: string): Promise<TaskRecord> {
  const db = getDb();
  return runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);
    if (existing.dependencies.includes(dependencyId)) return existing;

    const nextRecord: TaskRecord = {
      ...existing,
      dependencies: [...existing.dependencies, dependencyId],
      updatedAt: isoNow(),
    };
    await db.tasks.put(nextRecord);
    if (syncEnabled) await enqueue("update", taskId, nextRecord);
    return nextRecord;
  });
}

/**
 * Remove a dependency from a task
 */
export async function removeDependency(taskId: string, dependencyId: string): Promise<TaskRecord> {
  const db = getDb();
  return runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);

    const nextRecord: TaskRecord = {
      ...existing,
      dependencies: existing.dependencies.filter(depId => depId !== dependencyId),
      updatedAt: isoNow(),
    };
    await db.tasks.put(nextRecord);
    if (syncEnabled) await enqueue("update", taskId, nextRecord);
    return nextRecord;
  });
}

export async function removeDependencyReferencesInTransaction(
  taskId: string,
  enqueue: TransactionalSyncEnqueue,
  syncEnabled: boolean
): Promise<void> {
  const db = getDb();
  const allTasks = await db.tasks.toArray();
  const tasksToUpdate = allTasks.filter((task) => task.dependencies?.includes(taskId));

  for (const task of tasksToUpdate) {
    const nextRecord = {
      ...task,
      dependencies: task.dependencies.filter((id) => id !== taskId),
      updatedAt: isoNow(),
    };
    await db.tasks.put(nextRecord);
    if (syncEnabled) await enqueue("update", task.id, nextRecord);
  }
}

/**
 * Remove all references to a task from other tasks' dependencies
 * Should be called before deleting a task to clean up dependencies
 */
export async function removeDependencyReferences(taskId: string): Promise<void> {
  await runTaskSyncTransaction(({ syncEnabled, enqueue }) =>
    removeDependencyReferencesInTransaction(taskId, enqueue, syncEnabled)
  );
}
