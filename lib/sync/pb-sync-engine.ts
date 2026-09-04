/**
 * PocketBase sync engine — orchestration layer
 *
 * Re-exports push/pull operations and provides fullSync orchestration
 * with retry management, history recording, and notifications.
 */

import { getDb } from '@/lib/db';
import { getPocketBaseTaskId, pocketBaseToTaskRecord } from './task-mapper';
import { createLogger } from '@/lib/logger';
import { getRetryManager } from './retry-manager';
import { recordSyncSuccess, recordSyncError, recordSyncPartial } from '@/lib/sync-history';
import { notifySyncSuccess, notifySyncError } from './notifications';
import { isTransientSyncFailure, sanitizeSyncError, extractRetryAfterMs } from './error-categorizer';
import { ensureValidAuth } from './pb-auth';
import { getDeviceId, isRemoteNewerThanArchive } from './pb-sync-helpers';
import { pushLocalChanges } from './pb-push';
import { pullRemoteChanges } from './pb-pull';
import { isUnresolvedSyncQueueItem } from './queue';
import type { PBSyncResult, PBSyncConfig } from './types';
import type { RecordModel } from 'pocketbase';

// Re-export for backward compatibility
export { pushLocalChanges } from './pb-push';
export type { PushResult } from './pb-push';
export { pullRemoteChanges } from './pb-pull';

const logger = createLogger('SYNC_ENGINE');

/**
 * Apply a single remote change to IndexedDB (used by realtime handler)
 */
export async function applyRemoteChange(
  action: 'create' | 'update' | 'delete',
  record: RecordModel
): Promise<void> {
  const db = getDb();

  if (action === 'delete') {
    const taskId = getPocketBaseTaskId(record);
    if (!taskId) {
      logger.warn('Realtime delete skipped: invalid record');
      return;
    }

    // Mirror reconcileDeletedTasks: don't drop a task that has a queued local
    // change. The pending op (edit-beats-delete under LWW) will be re-pushed and
    // recreate the remote record, so deleting locally now would just lose the
    // unsynced edit until the next pull round-trips.
    await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
      const queuedOps = await db.syncQueue.toArray();
      if (queuedOps.some((op) => op.taskId === taskId && isUnresolvedSyncQueueItem(op))) {
        logger.debug('Realtime delete skipped: local change pending', { taskId });
        return;
      }
      await db.tasks.delete(taskId);
      logger.debug('Realtime delete applied', { taskId });
    });
    return;
  }

  const remoteTask = pocketBaseToTaskRecord(record, null);
  if (!remoteTask) {
    logger.warn('Realtime change skipped: invalid record', { action });
    return;
  }

  await db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks], async () => {
    const archived = await db.archivedTasks.get(remoteTask.id);
    if (archived && !isRemoteNewerThanArchive(remoteTask.updatedAt, archived.archivedAt)) {
      logger.debug('Realtime change skipped: task is archived locally', { taskId: remoteTask.id });
      return;
    }
    const deleted = await db.deletedTasks.get(remoteTask.id);
    if (deleted && !isRemoteNewerThanArchive(remoteTask.updatedAt, deleted.deletedAt)) {
      logger.debug('Realtime change skipped: task is deleted locally', { taskId: remoteTask.id });
      return;
    }
    const localTask = await db.tasks.get(remoteTask.id);
    if (action === 'create' && localTask) return;
    if (action === 'update' && localTask &&
        new Date(remoteTask.updatedAt).getTime() <= new Date(localTask.updatedAt).getTime()) return;
    const mergedTask = localTask ? pocketBaseToTaskRecord(record, localTask) : remoteTask;
    if (!mergedTask) return;
    if (archived) await db.archivedTasks.delete(remoteTask.id);
    if (deleted) await db.deletedTasks.delete(remoteTask.id);
    await db.tasks.put(mergedTask);
    logger.debug(`Realtime ${action} applied`, { taskId: mergedTask.id });
  });
}

// ─── Full sync orchestration ─────────────────────────────────────────

/** Rewind applied when migrating a legacy client-stamped cursor. */
const LEGACY_CURSOR_REWIND_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve the client_updated_at pull cursor. The persisted field keeps its
 * historical name for storage compatibility. A config from a pre-2026-06
 * build has only `lastSyncAt`, so it is migrated once with a 24h rewind.
 */
function resolvePullCursor(config: PBSyncConfig | undefined): string | null {
  if (config?.pullCursorVersion === 2) return config.lastClientUpdatedAt ?? null;
  // This value came from PocketBase's server timestamp domain. Mixing it with
  // client_updated_at can permanently skip a slow-clock client write, so an
  // unversioned config carrying it must perform a full pull.
  if (config?.lastServerUpdatedAt) return null;
  if (config?.lastSyncAt) {
    return new Date(new Date(config.lastSyncAt).getTime() - LEGACY_CURSOR_REWIND_MS).toISOString();
  }
  return null;
}

/**
 * Full sync: push local changes, then pull remote changes.
 * Handles auth checks, cursor updates, partial failures, and error reporting.
 */
export async function fullSync(triggeredBy: 'user' | 'auto' = 'auto'): Promise<PBSyncResult> {
  const startTime = Date.now();
  const retryManager = getRetryManager();
  const deviceId = await getDeviceId();

  try {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;

    // A merely-expired JWT can still be refreshed from the server session.
    // Attempt that silently here; if it fails, push/pull report the auth
    // failure cleanly via the unauthenticated path below.
    // react-doctor-disable-next-line react-doctor/async-parallel -- auth->push->pull ordering is required; not independent
    await ensureValidAuth();

    const pushResult = await pushLocalChanges();
    const pullResult = await pullRemoteChanges(resolvePullCursor(config));

    if (!pushResult.authenticated && !pullResult.authenticated) {
      return await reportAuthFailure(retryManager, deviceId, triggeredBy, startTime);
    }

    await updateSyncCursor(config, pullResult.maxObservedTimestamp);
    const duration = Date.now() - startTime;

    if (pushResult.failedCount > 0) {
      return await reportPartialFailure(pushResult, pullResult, retryManager, deviceId, triggeredBy, duration);
    }

    await retryManager.recordSuccess();
    await recordSyncSuccess(pushResult.pushedCount, pullResult.pulledCount, 0, deviceId, triggeredBy, duration);

    if (pushResult.pushedCount > 0 || pullResult.pulledCount > 0) {
      notifySyncSuccess(pushResult.pushedCount, pullResult.pulledCount);
    }

    return { status: 'success', pushedCount: pushResult.pushedCount, pulledCount: pullResult.pulledCount };
  } catch (error) {
    return await reportSyncError(error, retryManager, deviceId, triggeredBy, startTime);
  }
}

async function reportAuthFailure(
  retryManager: ReturnType<typeof getRetryManager>,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  startTime: number,
): Promise<PBSyncResult> {
  const authError = new Error('Sync skipped: not authenticated');
  await retryManager.recordFailure(authError);
  await recordSyncError(authError.message, deviceId, triggeredBy, Date.now() - startTime);
  notifySyncError('Please sign in to sync your tasks', false);
  return { status: 'error', error: authError.message };
}

async function updateSyncCursor(config: PBSyncConfig | undefined, maxTimestamp: string | null): Promise<void> {
  if (!config) return;

  // The legacy `lastSyncAt` is intentionally not advanced — it only feeds the
  // one-time migration in resolvePullCursor.
  const db = getDb();
  await db.syncMetadata.put({
    ...config,
    lastClientUpdatedAt: maxTimestamp ?? config.lastClientUpdatedAt ?? null,
    pullCursorVersion: 2,
    lastServerUpdatedAt: null,
    lastSuccessfulSyncAt: new Date().toISOString(),
  });
}

async function reportPartialFailure(
  pushResult: { pushedCount: number; failedCount: number; lastError: string | null; retryAfterMs?: number | null },
  pullResult: { pulledCount: number },
  retryManager: ReturnType<typeof getRetryManager>,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  duration: number,
): Promise<PBSyncResult> {
  const errorMsg = `${pushResult.failedCount} item(s) failed to sync: ${pushResult.lastError}`;
  await retryManager.recordFailure(new Error(errorMsg), { retryAfterMs: pushResult.retryAfterMs ?? null });
  await recordSyncPartial({
    pushedCount: pushResult.pushedCount,
    pulledCount: pullResult.pulledCount,
    failedCount: pushResult.failedCount,
    ...(pushResult.lastError ? { errorMessage: pushResult.lastError } : {}),
    deviceId,
    triggeredBy,
    duration,
  });
  notifySyncError(errorMsg, false);
  return {
    status: 'partial',
    pushedCount: pushResult.pushedCount,
    pulledCount: pullResult.pulledCount,
    failedCount: pushResult.failedCount,
    error: errorMsg,
  };
}

async function reportSyncError(
  error: unknown,
  retryManager: ReturnType<typeof getRetryManager>,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  startTime: number,
): Promise<PBSyncResult> {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  // PB 4xx bodies can echo submitted field values (task titles), so persist
  // and surface only the stable code; keep the raw Error for diagnostics.
  const errorCode = sanitizeSyncError(errorObj);
  // A directly-thrown 429 (e.g. from pull) may carry a Retry-After hint.
  await retryManager.recordFailure(errorObj, { retryAfterMs: extractRetryAfterMs(errorObj) });
  await recordSyncError(errorCode, deviceId, triggeredBy, Date.now() - startTime);
  notifySyncError(errorCode, false);
  if (isTransientSyncFailure(errorObj)) {
    logger.warn('Full sync failed (transient)', { triggeredBy, errorCode });
  } else {
    logger.error('Full sync failed', errorObj, { triggeredBy, errorCode });
  }
  return { status: 'error', error: errorCode };
}
