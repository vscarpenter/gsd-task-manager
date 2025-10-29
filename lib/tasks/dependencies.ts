import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { getSyncQueue } from "@/lib/sync/queue";
import { incrementVectorClock } from "@/lib/sync/vector-clock";
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

  // Check if dependency already exists
  if (existing.dependencies.includes(dependencyId)) {
    return existing;
  }

  // Increment vector clock for sync
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const currentClock = existing.vectorClock || {};
  const newClock = incrementVectorClock(currentClock, deviceId);

  const nextRecord: TaskRecord = {
    ...existing,
    dependencies: [...existing.dependencies, dependencyId],
    updatedAt: isoNow(),
    vectorClock: newClock
  };

  await db.tasks.put(nextRecord);

  // Enqueue sync operation if sync is enabled
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord, nextRecord.vectorClock || {});
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

  // Increment vector clock for sync
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const currentClock = existing.vectorClock || {};
  const newClock = incrementVectorClock(currentClock, deviceId);

  const nextRecord: TaskRecord = {
    ...existing,
    dependencies: existing.dependencies.filter(depId => depId !== dependencyId),
    updatedAt: isoNow(),
    vectorClock: newClock
  };

  await db.tasks.put(nextRecord);

  // Enqueue sync operation if sync is enabled
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord, nextRecord.vectorClock || {});
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

  // Find all tasks that depend on this task
  const tasksToUpdate = allTasks.filter(task =>
    task.dependencies && task.dependencies.includes(taskId)
  );

  // Remove this task from their dependencies
  await Promise.all(
    tasksToUpdate.map(task =>
      removeDependency(task.id, taskId)
    )
  );
}
