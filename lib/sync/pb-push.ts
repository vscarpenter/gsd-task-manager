/**
 * Push engine: local -> PocketBase
 *
 * Pushes pending sync queue items to PocketBase, handling create/update/delete.
 * Pre-fetches remote task index for efficient lookups and throttles requests.
 */

import { getPocketBase } from './pocketbase-client';
import { getSyncQueue } from './queue';
import { taskRecordToPocketBase } from './task-mapper';
import { createLogger } from '@/lib/logger';
import { THROTTLE_MS, delay, getDeviceId, getCurrentUserId, fetchRemoteTaskIndex } from './pb-sync-helpers';
import type { SyncQueueItem } from './types';

const logger = createLogger('SYNC_ENGINE');

export interface PushResult {
  pushedCount: number;
  failedCount: number;
  lastError: string | null;
  authenticated: boolean;
}

/**
 * Upsert a task to PocketBase. Creates if no remote record exists, updates otherwise.
 */
async function upsertRemoteTask(
  payload: SyncQueueItem['payload'],
  pbRecordId: string | undefined,
  ownerId: string,
  deviceId: string,
): Promise<string> {
  const pb = getPocketBase();
  const pbData = taskRecordToPocketBase(payload!, ownerId, deviceId);

  if (pbRecordId) {
    await pb.collection('tasks').update(pbRecordId, pbData);
    return pbRecordId;
  }

  const created = await pb.collection('tasks').create(pbData);
  return created.id;
}

/**
 * Process a single queue item: create, update, or delete the remote record.
 * Returns true if the item was successfully dequeued.
 */
async function pushSingleItem(
  item: SyncQueueItem,
  remoteIndex: Map<string, string>,
  indexFetchSucceeded: boolean,
  ownerId: string,
  deviceId: string,
): Promise<boolean> {
  const pb = getPocketBase();
  const queue = getSyncQueue();
  const pbRecordId = remoteIndex.get(item.taskId);

  if ((item.operation === 'create' || item.operation === 'update') && item.payload) {
    const recordId = await upsertRemoteTask(item.payload, pbRecordId, ownerId, deviceId);
    remoteIndex.set(item.taskId, recordId);
  } else if (item.operation === 'delete') {
    if (pbRecordId) {
      await pb.collection('tasks').delete(pbRecordId);
      remoteIndex.delete(item.taskId);
    } else if (!indexFetchSucceeded) {
      logger.warn('Skipping delete dequeue: remote index unavailable', { taskId: item.taskId });
      await queue.recordAttemptFailure(item.id, 'Remote task index unavailable for delete verification');
      return false;
    }
  }

  await queue.dequeue(item.id);
  return true;
}

/**
 * Push all pending local changes to PocketBase.
 */
export async function pushLocalChanges(): Promise<PushResult> {
  const ownerId = getCurrentUserId();
  if (!ownerId) {
    logger.warn('Push skipped: not authenticated');
    return { pushedCount: 0, failedCount: 0, lastError: null, authenticated: false };
  }

  const queue = getSyncQueue();
  const pending = await queue.getPending();
  if (pending.length === 0) {
    return { pushedCount: 0, failedCount: 0, lastError: null, authenticated: true };
  }

  const deviceId = await getDeviceId();
  const { index: remoteIndex, fetchSucceeded } = await fetchRemoteTaskIndex(ownerId);
  let pushedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  for (const item of pending) {
    try {
      const succeeded = await pushSingleItem(item, remoteIndex, fetchSucceeded, ownerId, deviceId);
      if (succeeded) {
        pushedCount++;
      } else {
        failedCount++;
        lastError = 'Remote index unavailable for delete verification';
      }

      if (pushedCount + failedCount < pending.length) {
        await delay(THROTTLE_MS);
      }
    } catch (error) {
      failedCount++;
      lastError = error instanceof Error ? error.message : String(error);
      logger.error('Push failed for item', error instanceof Error ? error : new Error(String(error)), {
        taskId: item.taskId,
        operation: item.operation,
      });
      await queue.recordAttemptFailure(item.id, lastError);
    }
  }

  logger.info('Push completed', { pushedCount, failedCount, total: pending.length });
  return { pushedCount, failedCount, lastError, authenticated: true };
}
