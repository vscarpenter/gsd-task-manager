import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { getSyncQueue } from "@/lib/sync/queue";
import { getSyncConfig } from "@/lib/sync/config";

/**
 * Add a dependency to a task
 */
export async function addDependency(taskId: string, dependencyId: string): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (existing.dependencies.includes(dependencyId)) {
    return existing;
  }

  const nextRecord: TaskRecord = {
    ...existing,
    dependencies: [...existing.dependencies, dependencyId],
    updatedAt: isoNow(),
  };

  await db.tasks.put(nextRecord);

  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord);
  }

  return nextRecord;
}

/**
 * Remove a dependency from a task
 */
export async function removeDependency(taskId: string, dependencyId: string): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const nextRecord: TaskRecord = {
    ...existing,
    dependencies: existing.dependencies.filter(depId => depId !== dependencyId),
    updatedAt: isoNow(),
  };

  await db.tasks.put(nextRecord);

  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord);
  }

  return nextRecord;
}

/**
 * Remove all references to a task from other tasks' dependencies
 * Should be called before deleting a task to clean up dependencies
 */
export async function removeDependencyReferences(taskId: string): Promise<void> {
  const db = getDb();
  const allTasks = await db.tasks.toArray();

  const tasksToUpdate = allTasks.filter(task =>
    task.dependencies && task.dependencies.includes(taskId)
  );

  await Promise.all(
    tasksToUpdate.map(task =>
      removeDependency(task.id, taskId)
    )
  );
}
