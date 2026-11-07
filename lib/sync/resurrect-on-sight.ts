/**
 * Resurrect on sight (tasks/spec-resurrect-on-sight.md). A delete made while signed
 * out is a local act: the server never heard about it, so the server copy wins. The
 * device remembers those task ids, and after the next completed pull it brings back
 * every remembered task the account still lists.
 */

import type { RecordModel } from 'pocketbase';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { TaskRecord } from '@/lib/types';
import {
  assertSafeRecordId,
  confirmSessionIdentity,
  escapeFilterValue,
  fetchBoundedRemoteTasks,
  holdsOffFarFutureRemote,
  readClientUpdatedAt,
} from './pb-sync-helpers';
import { assertSyncSessionCurrent } from './sync-session';
import { getPocketBaseTaskId, pocketBaseToTaskRecord } from './task-mapper';
import type { ResurrectOnSightRecord, SyncQueueItem } from './types';

const logger = createLogger('SYNC_ENGINE');
const RESURRECT_KEY = 'resurrect_on_sight';

/**
 * Remember task ids whose delete never reached the server. Device-local: the row
 * never syncs, survives sign-out, and Erase all data clears it. Inside a caller's
 * transaction, the caller must scope db.syncMetadata.
 */
export async function rememberForResurrect(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const current = await readRememberedTaskIds();
  await writeRemembered([...new Set([...current, ...taskIds])]);
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

/**
 * After a completed pull, list the whole account once and bring back each remembered
 * task it still holds. Without a complete listing for this owner, nothing is
 * forgotten and the next run tries again. With nothing remembered, nothing is listed.
 */
export async function resurrectOnSight(ownerId: string): Promise<void> {
  const remembered = await readRememberedTaskIds();
  if (remembered.length === 0) return;
  const records = await listAccount(ownerId);
  if (!records) return;

  const byTaskId = new Map(records.map((record) => [getPocketBaseTaskId(record), record]));
  const db = getDb();
  await db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks, db.syncQueue, db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
    const heldOff: string[] = [];
    for (const taskId of remembered) {
      const record = byTaskId.get(taskId);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one atomic Dexie transaction keeps the tombstone invariant
      if (record && (await resurrectOne(record)) === 'held-off') heldOff.push(taskId);
    }
    await forgetAllBut(remembered, heldOff);
  });
}

/** A guest listing is empty, so the owner is confirmed before the listing counts. */
async function listAccount(ownerId: string): Promise<RecordModel[] | null> {
  try {
    assertSafeRecordId(ownerId, 'ownerId');
    const records = await fetchBoundedRemoteTasks({
      filter: `owner = "${escapeFilterValue(ownerId)}"`,
      sort: 'task_id,id',
    });
    await confirmSessionIdentity(ownerId);
    return records;
  } catch (error) {
    logger.warn('Resurrect on sight skipped: no complete listing for this account', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

type Outcome = 'restored' | 'kept-local' | 'held-off' | 'nothing';

/**
 * Bring one remembered task back from the account's copy. A held-off far-future
 * remote waits for the next run, after this run's push has healed the record.
 */
async function resurrectOne(record: RecordModel): Promise<Outcome> {
  const remote = pocketBaseToTaskRecord(record, null);
  if (!remote) return 'nothing';
  if (await holdsOffFarFutureRemote(readClientUpdatedAt(record), remote.id)) return 'held-off';

  const db = getDb();
  const local = await db.tasks.get(remote.id);
  if (local) return takeIfStrictlyNewer(record, local);

  const trashed = await db.deletedTasks.get(remote.id);
  const archived = await db.archivedTasks.get(remote.id);
  if (!trashed && !archived) return 'nothing';
  if (trashed) await db.deletedTasks.delete(remote.id);
  if (archived) await db.archivedTasks.delete(remote.id);
  await db.tasks.put(pocketBaseToTaskRecord(record, trashed ?? archived) ?? remote);
  return 'restored';
}

/** An active copy here (restored, or brought back by the pull) follows last-write-wins. */
async function takeIfStrictlyNewer(record: RecordModel, local: TaskRecord): Promise<Outcome> {
  const merged = pocketBaseToTaskRecord(record, local);
  if (!merged || new Date(merged.updatedAt).getTime() <= new Date(local.updatedAt).getTime()) return 'kept-local';
  await getDb().tasks.put(merged);
  return 'restored';
}

/** Forget every id this run looked at, found or not, except the held-off ones. */
async function forgetAllBut(processed: string[], keep: string[]): Promise<void> {
  const forget = new Set(processed.filter((taskId) => !keep.includes(taskId)));
  const current = await readRememberedTaskIds();
  await writeRemembered(current.filter((taskId) => !forget.has(taskId)));
}
