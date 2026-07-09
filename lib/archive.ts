/**
 * Archive module - Task archiving operations
 *
 * Provides functions for archiving old completed tasks,
 * viewing archived tasks, and restoring tasks from archive.
 */

import { getDb } from "@/lib/db";
import type { TaskRecord, ArchiveSettings } from "@/lib/types";
import { getSyncQueue } from "@/lib/sync/queue";
import { ARCHIVE_CONFIG } from "@/lib/constants";

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
      archiveAfterDays: ARCHIVE_CONFIG.DEFAULT_ARCHIVE_AFTER_DAYS
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
 *
 * The read (find eligible tasks), bulkAdd, and bulkDelete all run inside a
 * single Dexie transaction. Without this, two overlapping calls (e.g. two
 * open tabs, or the hourly auto-archive racing a manual "Archive now" click)
 * can both read the same eligible tasks before either commits its
 * bulkDelete, so the second call's bulkAdd collides with keys the first
 * call already inserted. IndexedDB serializes transactions with overlapping
 * table scope, so the second call now re-reads tasks after the first has
 * already removed them.
 */
export async function archiveOldTasks(
  daysOld: number
): Promise<number> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffIso = cutoffDate.toISOString();
  const now = new Date().toISOString();

  const { getSyncConfig } = await import("@/lib/sync/config");
  const syncConfig = await getSyncConfig();
  const queue = getSyncQueue();

  const tasksToArchive = await db.transaction(
    "rw",
    [db.tasks, db.archivedTasks, db.syncQueue],
    async () => {
      // Find completed tasks older than cutoff
      const allTasks = await db.tasks.toArray();
      const eligible = allTasks.filter((task) => {
        if (!task.completed || !task.completedAt) return false;
        return task.completedAt < cutoffIso;
      });

      if (eligible.length === 0) {
        return eligible;
      }

      // Move tasks to archive table
      const archivedTasks: TaskRecord[] = eligible.map((task) => ({
        ...task,
        archivedAt: now
      }));

      await db.archivedTasks.bulkAdd(archivedTasks);

      // Remove from main tasks table
      await db.tasks.bulkDelete(eligible.map((task) => task.id));

      // Enqueue delete operations for sync (only if sync is enabled)
      if (syncConfig?.enabled) {
        await Promise.all(
          eligible.map((task) => queue.enqueue('delete', task.id, task))
        );
      }

      return eligible;
    }
  );

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

  // Remove archivedAt timestamp
  const { archivedAt: _archivedAt, ...taskWithoutArchive } = archivedTask;

  // Move back to main tasks table; load the sync-config module concurrently
  // since the import does not depend on the write completing.
  const [, { getSyncConfig }] = await Promise.all([
    db.tasks.add(taskWithoutArchive),
    import("@/lib/sync/config"),
  ]);
  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskWithoutArchive.id, taskWithoutArchive);
  }

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
