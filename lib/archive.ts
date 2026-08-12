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

function chooseArchiveSnapshot(
  liveTask: TaskRecord,
  existing: TaskRecord | undefined,
  archivedAt: string
): TaskRecord {
  if (existing) {
    const liveTime = new Date(liveTask.updatedAt).getTime();
    const existingTime = new Date(existing.updatedAt).getTime();
    if (Number.isNaN(liveTime) || Number.isNaN(existingTime) || existingTime >= liveTime) {
      return existing;
    }
  }
  return { ...liveTask, archivedAt };
}

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
    // React development effects can request defaults concurrently on a fresh
    // database. put() makes both initializers converge on the same singleton.
    await db.archiveSettings.put(defaults);
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
      const existing = await db.archivedTasks.bulkGet(eligible.map((task) => task.id));
      const archivedTasks = eligible.map((task, index) =>
        chooseArchiveSnapshot(task, existing[index], now)
      );

      // bulkPut, not bulkAdd: a task archived earlier can reappear in `tasks`
      // (a sync pull re-adding it, an import, a restore that was re-completed),
      // and bulkAdd throws ConstraintError on the existing key. Because the
      // whole batch runs in one transaction, that single collision aborted
      // every archive run on the device — permanently. Re-archiving is
      // idempotent. chooseArchiveSnapshot prevents a stale resurrected live
      // copy from replacing a newer tombstone snapshot.
      await db.archivedTasks.bulkPut(archivedTasks);

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

  // Resolve the sync dependencies BEFORE opening the transaction. Awaiting a
  // non-Dexie promise (the dynamic import, the config read) inside a Dexie
  // transaction lets it commit early, which would reopen the very atomicity
  // hole the transaction exists to close. Same ordering as archiveOldTasks.
  const { getSyncConfig } = await import("@/lib/sync/config");
  const syncConfig = await getSyncConfig();
  const queue = getSyncQueue();

  // The read, both writes, and the sync enqueue commit as one unit. Previously
  // the task was added to `tasks` and only removed from `archivedTasks` several
  // awaits later, so any failure in between (or a closed tab) left it in BOTH
  // tables — a live task wearing an archived id, which the v15 cleanup then has
  // to be careful not to delete. Reading the archived row inside the
  // transaction also closes the TOCTOU gap between two concurrent restores:
  // IndexedDB serializes transactions with overlapping scope, so the second
  // one sees the row already gone instead of colliding on `tasks.add`.
  await db.transaction(
    "rw",
    [db.tasks, db.archivedTasks, db.syncQueue],
    async () => {
      const archivedTask = await db.archivedTasks.get(taskId);
      if (!archivedTask) {
        throw new Error("Task not found in archive");
      }

      // Remove archivedAt timestamp
      const { archivedAt: _archivedAt, ...taskWithoutArchive } = archivedTask;

      await db.tasks.add(taskWithoutArchive);
      await db.archivedTasks.delete(taskId);

      if (syncConfig?.enabled) {
        await queue.enqueue('update', taskWithoutArchive.id, taskWithoutArchive);
      }
    }
  );
}

/**
 * Move a single live task straight into the archive, regardless of its age.
 *
 * This is the exact inverse of restoreTask and backs the "Undo" affordance on a
 * restore, so it carries the same guarantees: one transaction (a failure between
 * the two writes would strand the task in both tables), and a queued remote
 * delete so other devices drop it too — matching what archiveOldTasks does.
 *
 * Uses put rather than add for the same reason archiveOldTasks uses bulkPut: a
 * stale archived row must not make the undo permanently fail.
 */
export async function archiveTaskNow(taskId: string): Promise<void> {
  const db = getDb();

  // Resolved before the transaction opens — see restoreTask for why awaiting a
  // non-Dexie promise inside a Dexie transaction breaks its atomicity.
  const { getSyncConfig } = await import("@/lib/sync/config");
  const syncConfig = await getSyncConfig();
  const queue = getSyncQueue();

  await db.transaction(
    "rw",
    [db.tasks, db.archivedTasks, db.syncQueue],
    async () => {
      const task = await db.tasks.get(taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      const existing = await db.archivedTasks.get(taskId);
      await db.archivedTasks.put(
        chooseArchiveSnapshot(task, existing, new Date().toISOString())
      );
      await db.tasks.delete(taskId);

      if (syncConfig?.enabled) {
        await queue.enqueue('delete', taskId, task);
      }
    }
  );
}

/**
 * Permanently delete an archived task
 */
export async function deleteArchivedTask(taskId: string): Promise<void> {
  const db = getDb();
  await db.archivedTasks.delete(taskId);
}

/**
 * Put an archived task back into the archive — the undo for deleteArchivedTask.
 *
 * Takes the whole record because the row is already gone by the time undo runs,
 * so the caller is the only remaining source of truth for it.
 *
 * Writes only when the id is absent, and reports success either way. An existing
 * row means one of two things, and skipping is right for both:
 *
 *   - the undo already ran (a double-click, or a toast still on screen), which
 *     is why this cannot simply `add` — that threw ConstraintError; or
 *   - the id came back and was archived again with *newer* content. That is
 *     reachable: when pb-push abandons the archive's remote delete as stale, the
 *     pull re-adds the task (the archive guard no longer suppresses it — this
 *     row was just deleted) and auto-archive files it away again. The snapshot
 *     held by the toast is from delete time, so writing it unconditionally would
 *     discard the intervening edit.
 *
 * The stored row is therefore never older than the one being offered, so the
 * read and the write must be one transaction — two undos racing could otherwise
 * both observe an empty slot.
 *
 * Purely local: `archivedTasks` is never synced, and the remote copy was already
 * deleted when the task was archived, so there is nothing to enqueue.
 */
export async function reinstateArchivedTask(task: TaskRecord): Promise<void> {
  const db = getDb();

  await db.transaction("rw", db.archivedTasks, async () => {
    const existing = await db.archivedTasks.get(task.id);
    if (existing) {
      return;
    }
    await db.archivedTasks.put(task);
  });
}

/**
 * Get count of archived tasks
 */
export async function getArchivedCount(): Promise<number> {
  const db = getDb();
  return db.archivedTasks.count();
}

/** Archived-task footprint, for the Settings storage summary. */
export interface ArchivedStorageStats {
  count: number;
  bytes: number;
}

/**
 * Measure the archived store's footprint in one pass.
 *
 * Settings reports storage two rows above "Reset everything", so the count and
 * the size have to describe the same set of records — a count that includes
 * archived tasks beside a size that doesn't would misstate what a reset destroys.
 * Reading the rows (rather than just counting them) is what makes the byte figure
 * real; the Data section is a deliberate navigation, not a hot path.
 */
export async function getArchivedStorageStats(): Promise<ArchivedStorageStats> {
  const db = getDb();
  const archived = await db.archivedTasks.toArray();
  return { count: archived.length, bytes: JSON.stringify(archived).length };
}
