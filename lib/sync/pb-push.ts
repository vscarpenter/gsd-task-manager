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
import { sanitizeSyncError } from './error-categorizer';
import type { SyncQueueItem } from './types';

const logger = createLogger('SYNC_ENGINE');

/**
 * Detect HTTP 429 responses in arbitrary thrown values. PocketBase SDK
 * surfaces 429s either as `{status: 429}` (ClientResponseError) or as a
 * plain Error whose message includes the status code.
 */
function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; message?: string };
  if (candidate.status === 429) return true;
  if (typeof candidate.message === 'string') {
    return /\b429\b|too many requests/i.test(candidate.message);
  }
  return false;
}

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
        lastError = 'remote_index_unavailable';
      }

      if (pushedCount + failedCount < pending.length) {
        await delay(THROTTLE_MS);
      }
    } catch (error) {
      failedCount++;
      // Persist a stable error code only — never the raw error message,
      // which (for 4xx responses) can echo task content back from PocketBase.
      const errorCode = sanitizeSyncError(error);
      lastError = errorCode;
      logger.error('Push failed for item', error instanceof Error ? error : new Error(String(error)), {
        taskId: item.taskId,
        operation: item.operation,
        errorCode,
      });
      await queue.recordAttemptFailure(item.id, errorCode);

      // 429 means the server is under load. Abort the push loop early so
      // we don't hammer it through the remaining queue items at 100ms
      // throttle and amplify the rate-limit response.
      if (isRateLimitError(error)) {
        logger.warn('Aborting push loop due to rate limit (429)', {
          pushedCount,
          failedCount,
          remaining: pending.length - (pushedCount + failedCount),
        });
        break;
      }
    }
  }

  logger.info('Push completed', { pushedCount, failedCount, total: pending.length });
  return { pushedCount, failedCount, lastError, authenticated: true };
}
