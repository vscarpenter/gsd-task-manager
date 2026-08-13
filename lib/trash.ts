import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";
import { formatErrorMessage, isoNow } from "@/lib/utils";
import { TIME_MS } from "@/lib/constants";

const logger = createLogger("TASK_CRUD");

/**
 * How long a deleted task stays recoverable.
 *
 * Deliberately not configurable. A second knob beside the archive's 30/60/90
 * setting would imply the two are the same kind of decision — archiving is a
 * workflow preference, trash retention is a safety floor. See ADR 0015.
 */
export const TRASH_RETENTION_DAYS = 30;

/** Trash rows, newest deletion first. */
export async function listTrashedTasks(): Promise<TaskRecord[]> {
  const db = getDb();
  const rows = await db.deletedTasks.toArray();
  return rows.sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
}

export async function getTrashCount(): Promise<number> {
  return getDb().deletedTasks.count();
}

/**
 * Return a trashed task to the board.
 *
 * Runs as one transaction across both tables: ADR 0013's first rule is that an
 * id lives in exactly one lifecycle table, and a half-applied restore would put
 * it in two.
 */
export async function restoreFromTrash(taskId: string): Promise<void> {
  const db = getDb();
  const { getSyncConfig } = await import("@/lib/sync/config");
  const { getSyncQueue } = await import("@/lib/sync/queue");
  // Resolved before the transaction opens: awaiting a non-Dexie promise inside
  // one lets it commit early and silently removes the atomicity.
  const syncEnabled = !!(await getSyncConfig())?.enabled;
  const queue = getSyncQueue();

  try {
    const restored = await db.transaction(
      "rw",
      [db.tasks, db.deletedTasks, db.syncQueue],
      async () => {
        const trashed = await db.deletedTasks.get(taskId);
        if (!trashed) return null;

        const { deletedAt: _deletedAt, ...task } = trashed;
        await db.tasks.put(task as TaskRecord);
        await db.deletedTasks.delete(taskId);
        if (syncEnabled) await queue.enqueue("create", taskId, task as TaskRecord);
        return task as TaskRecord;
      }
    );

    if (!restored) {
      logger.info("Nothing to restore from trash", { taskId });
      return;
    }
    logger.info("Task restored from trash", { taskId });
  } catch (error) {
    logger.error("Failed to restore from trash", error instanceof Error ? error : undefined, {
      taskId,
    });
    throw new Error(`Failed to restore task: ${formatErrorMessage(error)}`);
  }
}

/** Remove a single trashed task for good. */
export async function deleteFromTrashForever(taskId: string): Promise<void> {
  await getDb().deletedTasks.delete(taskId);
  logger.info("Task permanently deleted from trash", { taskId });
}

/** Empty the trash. Returns how many records went. */
export async function emptyTrash(): Promise<number> {
  const db = getDb();
  const count = await db.deletedTasks.count();
  await db.deletedTasks.clear();
  logger.info("Trash emptied", { count });
  return count;
}

/**
 * Drop trash rows past the retention window. Returns how many were purged.
 *
 * Runs on app start beside the auto-archive sweep. A row with no `deletedAt` is
 * left alone rather than guessed at — deleting a record because its timestamp is
 * missing would be the exact failure this store exists to prevent.
 */
export async function purgeExpiredTrash(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * TIME_MS.DAY).toISOString();

  const expired = await db.deletedTasks
    .filter((task) => typeof task.deletedAt === "string" && task.deletedAt < cutoff)
    .primaryKeys();

  if (expired.length === 0) return 0;

  await db.deletedTasks.bulkDelete(expired as string[]);
  logger.info("Purged expired trash", { count: expired.length, retentionDays: TRASH_RETENTION_DAYS });
  return expired.length;
}

/** Stamp a task as trashed. Exported for the delete path to share the shape. */
export function toTrashedRecord(task: TaskRecord): TaskRecord {
  return { ...task, deletedAt: isoNow() };
}
