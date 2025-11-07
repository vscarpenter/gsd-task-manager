/**
 * Archive module - Task archiving operations
 *
 * Provides functions for archiving old completed tasks,
 * viewing archived tasks, and restoring tasks from archive.
 */

import { getDb } from "@/lib/db";
import type { TaskRecord, ArchiveSettings } from "@/lib/types";
import { getSyncQueue } from "@/lib/sync/queue";
import { incrementVectorClock } from "@/lib/sync/vector-clock";
import { getSyncConfig } from "@/lib/sync/config";

/**
 * Get archive settings from database
 */
export async function getArchiveSettings(): Promise<ArchiveSettings> {
  const db = getDb();
  const settings = await db.archiveSettings.get("settings");

  if (!settings) {
    const defaults: ArchiveSettings = {
      id: "settings",
      enabled: false,
      archiveAfterDays: 30
    };
    await db.archiveSettings.add(defaults);
    return defaults;
  }

  return settings;
}

/**
 * Update archive settings
 */
export async function updateArchiveSettings(
  updates: Partial<Omit<ArchiveSettings, "id">>
): Promise<void> {
  const db = getDb();
  await db.archiveSettings.update("settings", updates);
}

/**
 * Archive completed tasks older than specified days
 * Returns count of archived tasks
 */
export async function archiveOldTasks(
  daysOld: number
): Promise<number> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffIso = cutoffDate.toISOString();

  // Find completed tasks older than cutoff
  const tasksToArchive = await db.tasks
    .where("completed")
    .equals(1)
    .and((task) => {
      if (!task.completedAt) return false;
      return task.completedAt < cutoffIso;
    })
    .toArray();

  if (tasksToArchive.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();

  // Enqueue delete operations for sync before archiving
  const queue = getSyncQueue();
  for (const task of tasksToArchive) {
    await queue.enqueue('delete', task.id, task, task.vectorClock || {});
  }

  // Move tasks to archive table
  const archivedTasks: TaskRecord[] = tasksToArchive.map((task) => ({
    ...task,
    archivedAt: now
  }));

  await db.archivedTasks.bulkAdd(archivedTasks);

  // Remove from main tasks table
  const taskIds = tasksToArchive.map((task) => task.id);
  await db.tasks.bulkDelete(taskIds);

  return tasksToArchive.length;
}

/**
 * List all archived tasks
 */
export async function listArchivedTasks(): Promise<TaskRecord[]> {
  const db = getDb();
  return db.archivedTasks.toArray();
}

/**
 * Restore a task from archive back to main tasks
 */
export async function restoreTask(taskId: string): Promise<void> {
  const db = getDb();

  const archivedTask = await db.archivedTasks.get(taskId);
  if (!archivedTask) {
    throw new Error("Task not found in archive");
  }

  // Get device ID and increment vector clock for sync
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const vectorClock = incrementVectorClock(archivedTask.vectorClock || {}, deviceId);

  // Remove archivedAt timestamp and update vector clock
  const { archivedAt: _archivedAt, ...taskWithoutArchive } = {
    ...archivedTask,
    vectorClock
  };

  // Move back to main tasks table
  await db.tasks.add(taskWithoutArchive);

  // Enqueue update operation for sync
  const queue = getSyncQueue();
  await queue.enqueue('update', taskWithoutArchive.id, taskWithoutArchive, vectorClock);

  // Remove from archive
  await db.archivedTasks.delete(taskId);
}

/**
 * Permanently delete an archived task
 */
export async function deleteArchivedTask(taskId: string): Promise<void> {
  const db = getDb();
  await db.archivedTasks.delete(taskId);
}

/**
 * Get count of archived tasks
 */
export async function getArchivedCount(): Promise<number> {
  const db = getDb();
  return db.archivedTasks.count();
}
