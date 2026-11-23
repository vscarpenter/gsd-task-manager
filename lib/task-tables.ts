/**
 * An id lives in one of tasks, archivedTasks, and deletedTasks (ADR 0013, ADR 0015).
 * An Undo holds a record from seconds ago, and the id may have moved since, so
 * both Undo writers ask here. The caller's transaction needs all three tables,
 * or Dexie rejects the call.
 */

import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";

async function storedCopiesInTransaction(id: string): Promise<TaskRecord[]> {
  const db = getDb();
  const copies = await Promise.all([db.tasks.get(id), db.archivedTasks.get(id), db.deletedTasks.get(id)]);
  return copies.filter((copy) => copy !== undefined);
}

export async function isStoredInTransaction(id: string): Promise<boolean> {
  return (await storedCopiesInTransaction(id)).length > 0;
}

/** Returns the task to `tasks` alone, with the newest content of any copy. */
export async function bringBackInTransaction(held: TaskRecord): Promise<TaskRecord> {
  const db = getDb();
  const newest = (await storedCopiesInTransaction(held.id)).reduce(
    (best, copy) => (Date.parse(copy.updatedAt) > Date.parse(best.updatedAt) ? copy : best),
    held,
  );
  const { archivedAt: _archivedAt, deletedAt: _deletedAt, ...task } = newest;
  await db.archivedTasks.delete(held.id);
  await db.deletedTasks.delete(held.id);
  await db.tasks.put(task);
  return task;
}
