/**
 * Pull engine: PocketBase -> local
 *
 * Fetches remote changes and applies them to local IndexedDB using LWW resolution.
 * Also reconciles deletions by comparing full remote index against local tasks.
 */

import { getPocketBase } from './pocketbase-client';
import { pocketBaseToTaskRecord } from './task-mapper';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { escapeFilterValue, getCurrentUserId, fetchRemoteTaskIndex, assertSafeRecordId, isRemoteNewerThanArchive } from './pb-sync-helpers';
import type { RecordModel } from 'pocketbase';
import { isPendingSyncQueueItem } from './queue';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import type { TaskRecord } from '@/lib/types';

const logger = createLogger('SYNC_ENGINE');

/** Overlap window subtracted from the persisted cursor to avoid boundary misses. */
const CURSOR_OVERLAP_MS = 30 * 1000;

interface PreparedRemoteRecord {
  record: RecordModel;
  remoteTask: TaskRecord;
}

function prepareRemoteRecords(records: RecordModel[]): PreparedRemoteRecord[] {
  const prepared: PreparedRemoteRecord[] = [];
  for (const record of records) {
    const remoteTask = pocketBaseToTaskRecord(record, null);
    if (remoteTask) {
      prepared.push({ record, remoteTask });
    }
  }
  return prepared;
}

function findMaxAppliedClientUpdated(records: PreparedRemoteRecord[]): string | null {
  let maxTime = Number.NEGATIVE_INFINITY;
  const ceiling = Date.now() + SYNC_CONFIG.MAX_CLIENT_CLOCK_SKEW_MS;
  for (const { remoteTask } of records) {
    const parsed = new Date(remoteTask.updatedAt).getTime();
    if (!Number.isNaN(parsed)) maxTime = Math.max(maxTime, Math.min(parsed, ceiling));
  }
  return Number.isFinite(maxTime) ? new Date(maxTime).toISOString() : null;
}

async function applyPreparedRecord(
  db: ReturnType<typeof getDb>,
  prepared: PreparedRemoteRecord
): Promise<number> {
  const { record, remoteTask } = prepared;
  const archived = await db.archivedTasks.get(remoteTask.id);
  if (archived && !isRemoteNewerThanArchive(remoteTask.updatedAt, archived.archivedAt)) return 0;

  const localTask = await db.tasks.get(remoteTask.id);
  const merged = localTask ? pocketBaseToTaskRecord(record, localTask) : remoteTask;
  if (!merged) return 0;
  const remoteWins = !localTask ||
    new Date(merged.updatedAt).getTime() > new Date(localTask.updatedAt).getTime();
  if (archived) await db.archivedTasks.delete(remoteTask.id);
  if (!remoteWins) return 0;
  if (localTask) await db.tasks.put(merged);
  else await db.tasks.add(merged);
  return 1;
}

/**
 * Apply fetched remote records to local IndexedDB using LWW resolution.
 */
async function applyRemoteRecords(records: RecordModel[]): Promise<{
  pulledCount: number;
  skippedCount: number;
  appliedRecords: PreparedRemoteRecord[];
}> {
  const db = getDb();
  const acceptedRecords = prepareRemoteRecords(records);
  let pulledCount = 0;
  const appliedRecords: PreparedRemoteRecord[] = [];
  await db.transaction('rw', [db.tasks, db.archivedTasks], async () => {
    for (const prepared of acceptedRecords) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one atomic Dexie transaction preserves tombstone/live invariants
      const applied = await applyPreparedRecord(db, prepared);
      pulledCount += applied;
      if (applied > 0) appliedRecords.push(prepared);
    }
  });
  return {
    pulledCount,
    skippedCount: records.length - acceptedRecords.length,
    appliedRecords,
  };
}

/**
 * Pull remote changes from PocketBase into local IndexedDB.
 * Fetches tasks whose client-stamped `client_updated_at` is at or past the cursor.
 * LWW: remote wins if remote client_updated_at > local updatedAt.
 */
export async function pullRemoteChanges(lastClientUpdatedAt: string | null): Promise<{ pulledCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const pb = getPocketBase();
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, authenticated: false, maxObservedTimestamp: null };
  }

  assertSafeRecordId(ownerId, 'ownerId');

  let filter = `owner = "${escapeFilterValue(ownerId)}"`;
  if (lastClientUpdatedAt) {
    // PocketBase 0.23+ doesn't allow collection queries to sort/filter on the
    // system `updated` field. Keep the cursor on the same custom field as LWW.
    // `>=`, paired with the overlap below, re-catches boundary records.
    filter += ` && client_updated_at >= "${escapeFilterValue(lastClientUpdatedAt)}"`;
  }

  const records = await pb.collection('tasks').getFullList({
    filter,
    sort: 'client_updated_at',
  });

  const { pulledCount, skippedCount, appliedRecords } = await applyRemoteRecords(records);
  if (skippedCount > 0) {
    logger.warn('Skipped invalid remote records during pull', { skippedCount });
  }

  // Only records actually committed locally may advance the watermark.
  // Invalid, archive-suppressed, and LWW-skipped records remain eligible for
  // a later overlapping pull instead of poisoning the cursor.
  const maxApplied = findMaxAppliedClientUpdated(appliedRecords);
  const maxObservedTimestamp = maxApplied
    ? new Date(new Date(maxApplied).getTime() - CURSOR_OVERLAP_MS).toISOString()
    : null;

  await reconcileDeletedTasks(ownerId);

  logger.debug('Pull completed', { pulledCount, fetched: records.length });
  return { pulledCount, authenticated: true, maxObservedTimestamp };
}

/**
 * Remove local tasks that no longer exist remotely.
 * Tasks with pending sync operations are preserved.
 *
 * Self-healing by design: this re-fetches the remote index and deletes locals
 * absent from it. On a single PocketBase node, getFullList reflects committed
 * writes, so a task just pushed (and dequeued) in this same fullSync is present.
 * On a replicated/proxied backend, read-after-write lag could briefly hide such
 * a task and delete it locally. Recovery relies on the recently-pushed record's
 * `client_updated_at` falling inside the next pull's CURSOR_OVERLAP_MS window,
 * so it is re-fetched and re-added (it still exists remotely). The
 * pending-op guard below covers the common not-yet-pushed case directly.
 */
async function reconcileDeletedTasks(ownerId: string): Promise<void> {
  const { index: remoteIndex, fetchSucceeded } = await fetchRemoteTaskIndex(ownerId);
  if (!fetchSucceeded) {
    logger.warn('Skipping deletion reconciliation: remote index unavailable');
    return;
  }

  const db = getDb();
  const remoteTaskIds = new Set(remoteIndex.keys());
  await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
    const [localTasks, allPendingOps] = await Promise.all([
      db.tasks.toArray(),
      db.syncQueue.toArray(),
    ]);
    const pendingTaskIds = new Set(
      allPendingOps.filter(isPendingSyncQueueItem).map(op => op.taskId)
    );
    const toDelete = localTasks.filter(
      local => !remoteTaskIds.has(local.id) && !pendingTaskIds.has(local.id)
    );
    await db.tasks.bulkDelete(toDelete.map((local) => local.id));
    for (const local of toDelete) {
      logger.debug('Deleted locally: task removed from server', { taskId: local.id });
    }
  });
}
