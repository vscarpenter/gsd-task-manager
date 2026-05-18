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
import type { SyncQueueItem, RemoteTaskIndexEntry } from './types';

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
 * Outcome of processing one queue item. Distinguishes a real network write
 * from an LWW-skipped dequeue so the caller can report accurate stats.
 */
type PushItemOutcome = 'pushed' | 'skipped' | 'index_unavailable';

/**
 * Process a single queue item: create, update, or delete the remote record.
 *
 * LWW guard: before writing or deleting, compare the queued payload's
 * `updatedAt` (or the queue item's `timestamp` for deletes) against the
 * remote record's `client_updated_at`. If the remote is strictly newer,
 * the queued op is stale — skip the write and dequeue. The next pull will
 * deliver the newer remote version, restoring correctness on this device.
 */
async function pushSingleItem(
  item: SyncQueueItem,
  remoteIndex: Map<string, RemoteTaskIndexEntry>,
  indexFetchSucceeded: boolean,
  ownerId: string,
  deviceId: string,
): Promise<PushItemOutcome> {
  const pb = getPocketBase();
  const queue = getSyncQueue();
  const remote = remoteIndex.get(item.taskId);

  if (item.operation === 'create' || item.operation === 'update') {
    if (!item.payload) {
      // Invalid queue state — payload is required for create/update.
      await queue.dequeue(item.id);
      return 'skipped';
    }

    // If the index fetch failed AND we have no remote entry, we cannot
    // verify whether the queued write would clobber newer remote data.
    // Refuse to push and let the next attempt retry once the index is
    // available again. Mirrors the symmetric guard in the delete path.
    if (!remote && !indexFetchSucceeded) {
      logger.warn('Skipping upsert dequeue: remote index unavailable', {
        taskId: item.taskId,
        operation: item.operation,
      });
      await queue.recordAttemptFailure(
        item.id,
        'Remote task index unavailable for upsert LWW verification',
      );
      return 'index_unavailable';
    }

    if (remote?.clientUpdatedAt && isRemoteNewer(remote.clientUpdatedAt, item.payload.updatedAt)) {
      logger.info('Skipping stale push: remote is newer', {
        taskId: item.taskId,
        operation: item.operation,
        remoteAt: remote.clientUpdatedAt,
        localAt: item.payload.updatedAt,
      });
      await queue.dequeue(item.id);
      return 'skipped';
    }

    const recordId = await upsertRemoteTask(item.payload, remote?.pbRecordId, ownerId, deviceId);
    remoteIndex.set(item.taskId, {
      pbRecordId: recordId,
      clientUpdatedAt: item.payload.updatedAt,
    });
    await queue.dequeue(item.id);
    return 'pushed';
  }

  // item.operation === 'delete'
  if (remote) {
    const deletionIntent = new Date(item.timestamp).toISOString();
    if (remote.clientUpdatedAt && isRemoteNewer(remote.clientUpdatedAt, deletionIntent)) {
      logger.info('Skipping stale delete: remote modified after delete was queued', {
        taskId: item.taskId,
        remoteAt: remote.clientUpdatedAt,
        deletionQueuedAt: deletionIntent,
      });
      await queue.dequeue(item.id);
      return 'skipped';
    }
    await pb.collection('tasks').delete(remote.pbRecordId);
    remoteIndex.delete(item.taskId);
    await queue.dequeue(item.id);
    return 'pushed';
  }

  if (!indexFetchSucceeded) {
    logger.warn('Skipping delete dequeue: remote index unavailable', { taskId: item.taskId });
    await queue.recordAttemptFailure(item.id, 'Remote task index unavailable for delete verification');
    return 'index_unavailable';
  }

  // Remote record is already gone and index fetch succeeded — local delete is a no-op.
  await queue.dequeue(item.id);
  return 'pushed';
}

/**
 * Compare two ISO timestamps. Returns true iff remote is strictly newer than local.
 * Returns false for any NaN/invalid input — never skip a write because of bad data.
 */
function isRemoteNewer(remoteIso: string, localIso: string): boolean {
  const r = new Date(remoteIso).getTime();
  const l = new Date(localIso).getTime();
  if (Number.isNaN(r) || Number.isNaN(l)) return false;
  return r > l;
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
  let skippedCount = 0;
  let lastError: string | null = null;

  for (const item of pending) {
    try {
      const outcome = await pushSingleItem(item, remoteIndex, fetchSucceeded, ownerId, deviceId);
      if (outcome === 'pushed') {
        pushedCount++;
      } else if (outcome === 'skipped') {
        skippedCount++;
      } else {
        failedCount++;
        lastError = 'remote_index_unavailable';
      }

      if (pushedCount + failedCount + skippedCount < pending.length) {
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
          skippedCount,
          remaining: pending.length - (pushedCount + failedCount + skippedCount),
        });
        break;
      }
    }
  }

  logger.info('Push completed', { pushedCount, failedCount, skippedCount, total: pending.length });
  return { pushedCount, failedCount, lastError, authenticated: true };
}
