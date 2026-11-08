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
import { isPendingSyncQueueItem } from './queue';
import { StaleSyncSessionError, assertSyncSessionCurrent } from './sync-session';
import { getPocketBaseTaskId, pocketBaseToTaskRecord } from './task-mapper';
import { forgetForResurrect, readRememberedTaskIds } from './resurrect-ids';

const logger = createLogger('SYNC_ENGINE');
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
  try {
    await applyResurrections(ownerId, remembered, byTaskId);
  } catch (error) {
    // The push already committed, so a failed step mustn't fail the sync. The
    // transaction rolled back, so nothing was forgotten, and the next run retries.
    if (error instanceof StaleSyncSessionError) throw error;
    logger.error('Resurrect on sight failed; nothing forgotten', error instanceof Error ? error : undefined);
  }
}

async function applyResurrections(
  ownerId: string,
  remembered: string[],
  byTaskId: Map<string | null, RecordModel>,
): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks, db.syncQueue, db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
    const retry: string[] = [];
    for (const taskId of remembered) {
      const record = byTaskId.get(taskId);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one atomic Dexie transaction keeps the tombstone invariant
      if (record && (await resurrectOne(record)) === 'retry') retry.push(taskId);
    }
    await forgetAllBut(remembered, retry);
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

/** 'retry' keeps the id for the next run; every other outcome forgets it. */
type Outcome = 'restored' | 'kept-local' | 'retry' | 'nothing';

/** Bring one remembered task back from the account's copy. */
async function resurrectOne(record: RecordModel): Promise<Outcome> {
  const remote = pocketBaseToTaskRecord(record, null);
  // Forgotten, found or not (rule 4), and the Trash row stays. A retry would list the account on
  // every sync while the copy stays unreadable, and on web a reload brings any newer schema.
  if (!remote) return 'nothing';
  if (await waitsForThisDevice(record, remote.id)) return 'retry';

  const db = getDb();
  const local = await db.tasks.get(remote.id);
  if (local) return takeIfStrictlyNewer(record, local);

  // An archive row stands: it's the user's last act here, and archiving while
  // signed out keeps the archive too (spec rule 6, reading 2, owner item 26).
  if (await db.archivedTasks.get(remote.id)) return 'nothing';
  const trashed = await db.deletedTasks.get(remote.id);
  if (!trashed) return 'nothing';
  await db.deletedTasks.delete(remote.id);
  await db.tasks.put(pocketBaseToTaskRecord(record, trashed) ?? remote);
  return 'restored';
}

/**
 * This device still has its own word pending: a far-future remote held off for a
 * queued write, which waits until push heals the record, or a delete queued since
 * the id was remembered, which is the user's latest act and will push.
 */
async function waitsForThisDevice(record: RecordModel, taskId: string): Promise<boolean> {
  if (await holdsOffFarFutureRemote(readClientUpdatedAt(record), taskId)) return true;
  const rows = await getDb().syncQueue.where('taskId').equals(taskId).toArray();
  return rows.some((row) => row.operation === 'delete' && isPendingSyncQueueItem(row));
}

/** An active copy here (restored, or brought back by the pull) follows last-write-wins. */
async function takeIfStrictlyNewer(record: RecordModel, local: TaskRecord): Promise<Outcome> {
  const merged = pocketBaseToTaskRecord(record, local);
  if (!merged || new Date(merged.updatedAt).getTime() <= new Date(local.updatedAt).getTime()) return 'kept-local';
  await getDb().tasks.put(merged);
  return 'restored';
}

/** Forget every id this run looked at, found or not, except the ones to retry. */
async function forgetAllBut(processed: string[], keep: string[]): Promise<void> {
  await forgetForResurrect(processed.filter((taskId) => !keep.includes(taskId)));
}
