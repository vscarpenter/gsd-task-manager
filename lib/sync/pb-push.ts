/**
 * Push engine: local -> PocketBase
 *
 * Pushes pending sync queue items to PocketBase, handling create/update/delete.
 * Pre-fetches remote task index for efficient lookups and throttles requests.
 */

import { readDefaultReminder } from '@/lib/notifications/default-reminder';
import { getPocketBase } from './pocketbase-client';
import { getSyncQueue } from './queue';
import { placementToWire, taskRecordToPocketBase } from './task-mapper';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import {
  THROTTLE_MS,
  SessionIdentityMismatchError,
  SessionRejectedError,
  confirmSessionIdentity,
  delay,
  getDeviceId,
  getCurrentUserId,
  fetchRemoteTaskEntry,
} from './pb-sync-helpers';
import { sanitizeSyncError, isTransientSyncFailure, extractRetryAfterMs } from './error-categorizer';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { StaleSyncSessionError } from './sync-session';
import type { RemoteTaskIndexEntry, SyncQueueItem } from './types';

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

function makeSafePushError(errorCode: string): Error {
  const error = new Error(errorCode);
  error.name = 'SyncPushError';
  return error;
}

export interface PushResult {
  pushedCount: number;
  failedCount: number;
  lastError: string | null;
  authenticated: boolean;
  /** Server-requested backoff (ms) parsed from a 429 Retry-After, if any. */
  retryAfterMs?: number | null;
}

type QueuedTask = NonNullable<SyncQueueItem['payload']>;

/**
 * The offset a push sends: the payload's, else the stored row's at any stamp, else
 * this device's default (D-10). A legacy null never reaches the wire. Only the
 * write-back below is guarded against a newer edit, because it writes to the row.
 */
async function resolveNotifyBefore(
  payload: QueuedTask,
  defaultReminder: number,
): Promise<{ task: QueuedTask; storeOnRow: boolean }> {
  if (typeof payload.notifyBefore === 'number') return { task: payload, storeOnRow: false };
  const row = await getDb().tasks.get(payload.id);
  if (typeof row?.notifyBefore === 'number') {
    return { task: { ...payload, notifyBefore: row.notifyBefore }, storeOnRow: false };
  }
  return { task: { ...payload, notifyBefore: defaultReminder }, storeOnRow: row?.updatedAt === payload.updatedAt };
}

/**
 * Store the resolved number on the row so this device and the server agree. No
 * stamp bump and nothing queued: other devices already hold this task at the same
 * stamp. Guarded in one transaction, so an edit saved while the push was in
 * flight is never overwritten. The server already has the number, so a local
 * failure here is logged and does not fail the push.
 */
async function settleRowOffset(task: QueuedTask): Promise<void> {
  const db = getDb();
  try {
    await db.transaction('rw', db.tasks, async () => {
      const row = await db.tasks.get(task.id);
      if (row && row.notifyBefore === undefined && row.updatedAt === task.updatedAt) {
        await db.tasks.update(task.id, { notifyBefore: task.notifyBefore });
      }
    });
  } catch (error) {
    logger.warn('Could not store the resolved reminder offset on the row', {
      taskId: task.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Upsert a task to PocketBase. Creates if no remote record exists, updates otherwise.
 * Placement comes from the current row (placementToWire), not the payload.
 */
async function upsertRemoteTask(
  payload: SyncQueueItem['payload'],
  pbRecordId: string | undefined,
  ownerId: string,
  deviceId: string,
): Promise<string> {
  const pb = getPocketBase();
  const defaultReminder = await readDefaultReminder();
  const { task, storeOnRow } = await resolveNotifyBefore(payload!, defaultReminder);
  const { saved_at: _savedAt, focus_date: _focusDate, focus_rank: _focusRank, ...queued } =
    taskRecordToPocketBase(task, ownerId, deviceId, defaultReminder);
  const current = await getDb().tasks.get(payload!.id);
  const pbData = { ...queued, ...placementToWire(current) };

  let recordId = pbRecordId;
  if (recordId) {
    await pb.collection('tasks').update(recordId, pbData);
  } else {
    recordId = (await pb.collection('tasks').create(pbData)).id;
  }

  if (storeOnRow) await settleRowOffset(task);
  return recordId;
}

/**
 * Outcome of processing one queue item. Distinguishes a real network write
 * from an LWW-skipped dequeue so the caller can report accurate stats.
 */
type PushItemOutcome = 'pushed' | 'skipped' | 'index_unavailable';

/** What fetchRemoteTaskEntry found for one queued task. */
interface RemoteLookup {
  entry: RemoteTaskIndexEntry | null;
  fetchSucceeded: boolean;
}

/**
 * A token the server refuses reads as a guest, and a guest's lookup 404s for
 * every task: the answer a task that was never pushed, or was already deleted,
 * gets. So a push acts on a 404 only once auth-refresh confirms the session
 * (confirmSessionIdentity). Creates ask once per push: a session that dies later
 * in the push fails each remaining create, which charges that row one attempt,
 * and the next push's check stops before it charges more. A delete that finds
 * nothing leaves the queue for good, so each one asks after its own lookup.
 */
interface PushSessionCheck {
  beforeCreate(): Promise<void>;
  beforeDroppingDelete(): Promise<void>;
}

function createPushSessionCheck(ownerId: string): PushSessionCheck {
  let confirmed = false;
  const confirm = async (): Promise<void> => {
    await confirmSessionIdentity(ownerId);
    confirmed = true;
  };
  return {
    beforeCreate: () => (confirmed ? Promise.resolve() : confirm()),
    beforeDroppingDelete: confirm,
  };
}

/**
 * The session check failed, not this row. Charging the row would retire it after
 * MAX_RETRIES, and nothing re-arms a retired row, so the push stops instead.
 */
function isSessionCheckFailure(error: unknown): boolean {
  return error instanceof SessionRejectedError || error instanceof SessionIdentityMismatchError;
}

interface PushContext {
  ownerId: string;
  deviceId: string;
  session: PushSessionCheck;
}

function hasUsableRemoteVersion(value: unknown): value is string {
  return typeof value === 'string'
    && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(new Date(value).getTime());
}

async function recordUnusableRemoteVersion(item: SyncQueueItem): Promise<void> {
  logger.warn('Skipping mutation: remote task version is missing or malformed', {
    taskId: item.taskId,
    operation: item.operation,
  });
  await getSyncQueue().recordAttemptFailure(
    item.id,
    'Remote task version is missing or malformed',
  );
}

/**
 * A delete is stale when the remote changed after the delete was queued. An
 * archive's delete also carries the task as it was archived, and is stale when
 * the remote is newer than that version: another device edited the task after
 * this copy was last synced, either in an edit a pull missed or between the
 * pull and the archive. Archiving a stale copy must not delete it (B-46).
 */
function isStaleDelete(item: SyncQueueItem, remoteAt: string): boolean {
  if (isRemoteNewer(remoteAt, new Date(item.timestamp).toISOString())) return true;
  const archivedVersion = item.payload?.updatedAt;
  return archivedVersion !== undefined && isRemoteNewer(remoteAt, archivedVersion);
}

/**
 * Process a single queue item: create, update, or delete the remote record.
 *
 * LWW guard: before writing or deleting, compare the queued payload's
 * `updatedAt` (for deletes, see isStaleDelete) against the
 * remote record's `client_updated_at`. If the remote is strictly newer,
 * the queued op is stale — skip the write and dequeue. The next pull will
 * deliver the newer remote version, restoring correctness on this device.
 */
async function pushSingleItem(item: SyncQueueItem, ctx: PushContext): Promise<PushItemOutcome> {
  const lookup = await fetchRemoteTaskEntry(ctx.ownerId, item.taskId);

  if (lookup.entry && !hasUsableRemoteVersion(lookup.entry.clientUpdatedAt)) {
    await recordUnusableRemoteVersion(item);
    return 'index_unavailable';
  }

  if (item.operation === 'delete') return pushDelete(item, lookup, ctx.session);
  return pushUpsert(item, lookup, ctx);
}

async function pushUpsert(
  item: SyncQueueItem,
  { entry: remote, fetchSucceeded }: RemoteLookup,
  ctx: PushContext,
): Promise<PushItemOutcome> {
  const queue = getSyncQueue();
  if (!item.payload) {
    // Invalid queue state — payload is required for create/update.
    await queue.dequeue(item.id);
    return 'skipped';
  }

  // If the index fetch failed AND we have no remote entry, we cannot
  // verify whether the queued write would clobber newer remote data.
  // Refuse to push and let the next attempt retry once the index is
  // available again. Mirrors the symmetric guard in the delete path.
  if (!fetchSucceeded) {
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

  if (remote && isRemoteNewer(remote.clientUpdatedAt, item.payload.updatedAt)) {
    logger.info('Skipping stale push: remote is newer', {
      taskId: item.taskId,
      operation: item.operation,
      remoteAt: remote.clientUpdatedAt,
      localAt: item.payload.updatedAt,
    });
    await queue.dequeue(item.id);
    return 'skipped';
  }

  if (!remote) await ctx.session.beforeCreate();
  await upsertRemoteTask(item.payload, remote?.pbRecordId, ctx.ownerId, ctx.deviceId);
  await queue.dequeue(item.id);
  return 'pushed';
}

async function pushDelete(
  item: SyncQueueItem,
  { entry: remote, fetchSucceeded }: RemoteLookup,
  session: PushSessionCheck,
): Promise<PushItemOutcome> {
  const queue = getSyncQueue();
  if (remote) {
    if (isStaleDelete(item, remote.clientUpdatedAt)) {
      logger.info('Skipping stale delete: remote modified after the deleted version', {
        taskId: item.taskId,
        remoteAt: remote.clientUpdatedAt,
        deletionQueuedAt: new Date(item.timestamp).toISOString(),
      });
      await queue.dequeue(item.id);
      return 'skipped';
    }
    await getPocketBase().collection('tasks').delete(remote.pbRecordId);
    await queue.dequeue(item.id);
    return 'pushed';
  }

  if (!fetchSucceeded) {
    logger.warn('Skipping delete dequeue: remote index unavailable', { taskId: item.taskId });
    await queue.recordAttemptFailure(item.id, 'Remote task index unavailable for delete verification');
    return 'index_unavailable';
  }

  // The remote record is gone and the session is the owner's, so the local delete is a no-op.
  await session.beforeDroppingDelete();
  await queue.dequeue(item.id);
  return 'pushed';
}

/**
 * Compare two ISO timestamps. Returns true iff remote is strictly newer than local.
 * Returns false for any NaN/invalid input — never skip a write because of bad data.
 *
 * A remote `client_updated_at` beyond `now + MAX_CLIENT_CLOCK_SKEW_MS` is treated
 * as untrustworthy (skewed clock or forged value) and never considered newer, so a
 * legitimate local edit can overwrite — and thereby heal — a poisoned remote record
 * instead of being blocked by it forever.
 */
function isRemoteNewer(remoteIso: string, localIso: string, nowMs: number = Date.now()): boolean {
  const r = new Date(remoteIso).getTime();
  const l = new Date(localIso).getTime();
  if (Number.isNaN(r) || Number.isNaN(l)) return false;
  if (r > nowMs + SYNC_CONFIG.MAX_CLIENT_CLOCK_SKEW_MS) return false;
  return r > l;
}

/**
 * The SDK principal lives in shared browser auth storage, where a late
 * `authRefresh` response for a previous account can land after the next
 * account signs in. The queue carries no owner of its own, so the only way to
 * keep one account's tasks out of another's cloud record is to refuse any push
 * whose SDK principal is not the session owner. Throws StaleSyncSessionError
 * on that mismatch, which fullSync reports as `cancelled`.
 */
function resolvePushPrincipal(sessionOwnerId: string): string | null {
  const ownerId = getCurrentUserId();
  if (ownerId && ownerId !== sessionOwnerId) {
    logger.warn('Push refused: SDK principal does not match the sync session owner');
    throw new StaleSyncSessionError();
  }
  return ownerId;
}

/**
 * Charge one row for a failed push. Persists a stable error code only, never the
 * raw message, which for a 4xx can echo task content back from PocketBase.
 */
async function recordItemFailure(item: SyncQueueItem, error: unknown): Promise<string> {
  const errorCode = sanitizeSyncError(error);
  const context = { taskId: item.taskId, operation: item.operation, errorCode };
  if (isTransientSyncFailure(error)) {
    logger.warn('Push failed for item (transient)', context);
  } else {
    logger.error('Push failed for item', makeSafePushError(errorCode), context);
  }
  await getSyncQueue().recordAttemptFailure(item.id, errorCode);
  return errorCode;
}

/**
 * Push all pending local changes to PocketBase on behalf of `sessionOwnerId`,
 * the account sync_config names as the enabled session. A session the server
 * refuses throws SessionRejectedError and leaves every remaining row as it was.
 */
export async function pushLocalChanges(sessionOwnerId: string): Promise<PushResult> {
  const ownerId = resolvePushPrincipal(sessionOwnerId);
  if (!ownerId) {
    logger.warn('Push skipped: not authenticated');
    return { pushedCount: 0, failedCount: 0, lastError: null, authenticated: false };
  }

  const queue = getSyncQueue();
  const pending = await queue.getPending();
  if (pending.length === 0) {
    return { pushedCount: 0, failedCount: 0, lastError: null, authenticated: true };
  }

  const ctx: PushContext = { ownerId, deviceId: await getDeviceId(), session: createPushSessionCheck(ownerId) };
  let pushedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let lastError: string | null = null;
  let retryAfterMs: number | null = null;

  for (const item of pending) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- intentionally sequential/throttled (rate-limit); parallelizing risks 429s
      const outcome = await pushSingleItem(item, ctx);
      if (outcome === 'pushed') {
        pushedCount++;
      } else if (outcome === 'skipped') {
        skippedCount++;
      } else {
        failedCount++;
        lastError = 'remote_index_unavailable';
      }

    } catch (error) {
      if (isSessionCheckFailure(error)) throw error;
      failedCount++;
      // react-doctor-disable-next-line react-doctor/async-defer-await -- awaited value/side-effect needed before the guard; cannot defer
      lastError = await recordItemFailure(item, error);

      // 429 means the server is under load. Abort the push loop early so
      // we don't hammer it through the remaining queue items at 100ms
      // throttle and amplify the rate-limit response.
      if (isRateLimitError(error)) {
        // Honor the server's Retry-After (if it sent one) for the next backoff.
        retryAfterMs = extractRetryAfterMs(error);
        logger.warn('Aborting push loop due to rate limit (429)', {
          pushedCount,
          failedCount,
          skippedCount,
          retryAfterMs,
          remaining: pending.length - (pushedCount + failedCount + skippedCount),
        });
        break;
      }
    }

    if (pushedCount + failedCount + skippedCount < pending.length) {
      await delay(THROTTLE_MS);
    }
  }

  logger.debug('Push completed', { pushedCount, failedCount, skippedCount, total: pending.length });
  return { pushedCount, failedCount, lastError, authenticated: true, retryAfterMs };
}
