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
import { escapeFilterValue, getCurrentUserId, fetchRemoteTaskIndex, assertSafeRecordId } from './pb-sync-helpers';
import type { RecordModel } from 'pocketbase';

const logger = createLogger('SYNC_ENGINE');

/**
 * Apply fetched remote records to local IndexedDB using LWW resolution.
 */
async function applyRemoteRecords(records: RecordModel[]): Promise<{ pulledCount: number; skippedCount: number }> {
  const db = getDb();
  const remoteTasks = records.map(pocketBaseToTaskRecord);
  const validRemoteTasks = remoteTasks.filter((t): t is NonNullable<typeof t> => t !== null);

  // Pre-fetch matching local tasks in bulk to avoid N individual lookups
  const localTasksRaw = await db.tasks.bulkGet(validRemoteTasks.map(t => t.id));
  const localTaskMap = new Map(
    localTasksRaw
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .map(t => [t.id, t])
  );

  let pulledCount = 0;
  const skippedCount = remoteTasks.length - validRemoteTasks.length;

  for (const remoteTask of validRemoteTasks) {
    const localTask = localTaskMap.get(remoteTask.id);

    if (!localTask) {
      await db.tasks.add(remoteTask);
      pulledCount++;
    } else {
      const remoteTime = new Date(remoteTask.updatedAt).getTime();
      const localTime = new Date(localTask.updatedAt).getTime();
      if (remoteTime >= localTime) {
        await db.tasks.put(remoteTask);
        pulledCount++;
      }
    }
  }

  return { pulledCount, skippedCount };
}

/** Find the maximum client_updated_at across a set of PocketBase records */
function findMaxTimestamp(records: RecordModel[]): string | null {
  let max: string | null = null;
  for (const record of records) {
    const ts = record['client_updated_at'] as string;
    if (ts && (!max || ts > max)) {
      max = ts;
    }
  }
  return max;
}

/**
 * Pull remote changes from PocketBase into local IndexedDB.
 * Fetches tasks updated after the last sync timestamp.
 * LWW: remote wins if remote client_updated_at >= local updatedAt.
 */
export async function pullRemoteChanges(lastSyncAt: string | null): Promise<{ pulledCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const pb = getPocketBase();
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, authenticated: false, maxObservedTimestamp: null };
  }

  assertSafeRecordId(ownerId, 'ownerId');

  let filter = `owner = "${escapeFilterValue(ownerId)}"`;
  if (lastSyncAt) {
    filter += ` && client_updated_at > "${escapeFilterValue(lastSyncAt)}"`;
  }

  const records = await pb.collection('tasks').getFullList({
    filter,
    sort: '-client_updated_at',
  });

  const { pulledCount, skippedCount } = await applyRemoteRecords(records);
  if (skippedCount > 0) {
    logger.warn('Skipped invalid remote records during pull', { skippedCount });
  }

  const maxObservedTimestamp = findMaxTimestamp(records);

  await reconcileDeletedTasks(ownerId);

  logger.info('Pull completed', { pulledCount, fetched: records.length });
  return { pulledCount, authenticated: true, maxObservedTimestamp };
}

/**
 * Remove local tasks that no longer exist remotely.
 * Tasks with pending sync operations are preserved.
 */
async function reconcileDeletedTasks(ownerId: string): Promise<void> {
  const { index: remoteIndex, fetchSucceeded } = await fetchRemoteTaskIndex(ownerId);
  if (!fetchSucceeded) {
    logger.warn('Skipping deletion reconciliation: remote index unavailable');
    return;
  }

  const db = getDb();
  const localTasks = await db.tasks.toArray();
  const remoteTaskIds = new Set(remoteIndex.keys());

  const allPendingOps = await db.syncQueue.toArray();
  const pendingTaskIds = new Set(allPendingOps.map(op => op.taskId));

  for (const local of localTasks) {
    if (!remoteTaskIds.has(local.id) && !pendingTaskIds.has(local.id)) {
      await db.tasks.delete(local.id);
      logger.debug('Deleted locally: task removed from server', { taskId: local.id });
    }
  }
}
