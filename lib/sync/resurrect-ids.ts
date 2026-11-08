/**
 * The device-local list behind resurrect on sight (tasks/spec-resurrect-on-sight.md):
 * ids of tasks whose delete never reached the server. Plain Dexie, with no SDK
 * imports, so the Trash and task writers can use it without pulling in sync.
 */

import { getDb } from '@/lib/db';
import type { ResurrectOnSightRecord, SyncQueueItem } from './types';

const RESURRECT_KEY = 'resurrect_on_sight';

/**
 * Remember task ids whose delete never reached the server. The row never syncs,
 * survives sign-out, and Erase all data clears it. Inside a caller's transaction,
 * the caller must scope db.syncMetadata.
 */
export async function rememberForResurrect(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const current = await readRememberedTaskIds();
  await writeRemembered([...new Set([...current, ...taskIds])]);
}

/**
 * Forget ids. An id matters only while its Trash row exists, so each way out of
 * Trash (restore, undo, delete forever, empty, purge) forgets it in the same
 * transaction, which keeps the list no longer than Trash (S-WEB-05).
 */
export async function forgetForResurrect(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const gone = new Set(taskIds);
  const current = await readRememberedTaskIds();
  if (!current.some((taskId) => gone.has(taskId))) return;
  await writeRemembered(current.filter((taskId) => !gone.has(taskId)));
}

export async function readRememberedTaskIds(): Promise<string[]> {
  const row = (await getDb().syncMetadata.get(RESURRECT_KEY)) as ResurrectOnSightRecord | undefined;
  return row?.taskIds ?? [];
}

/** A Trash delete carries no payload; an archive's delete carries the task and isn't remembered. */
export function trashDeleteTaskIds(rows: SyncQueueItem[]): string[] {
  return rows.filter((row) => row.operation === 'delete' && !row.payload).map((row) => row.taskId);
}

async function writeRemembered(taskIds: string[]): Promise<void> {
  const db = getDb();
  if (taskIds.length === 0) await db.syncMetadata.delete(RESURRECT_KEY);
  else await db.syncMetadata.put({ key: RESURRECT_KEY, taskIds });
}
