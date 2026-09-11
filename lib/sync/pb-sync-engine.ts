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
import { classifyRemoteDeletion } from './queue';
import { StaleSyncSessionError, assertSyncSessionCurrent, getSessionOwner } from './sync-session';
import { toTrashedRecord } from '@/lib/trash';
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
/**
 * Apply a delete that arrived over the realtime channel.
 *
 * Mirrors reconcileDeletedTasks through the same classifier so the two guards
 * cannot drift: a still-push-eligible queued op suppresses the delete (it will
 * be re-pushed and recreate the remote record); a retry-exhausted op never will,
 * so the task goes to Trash and its dead rows go with it.
 */
async function applyRemoteDeletion(taskId: string, ownerId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.tasks, db.deletedTasks, db.syncQueue, db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
    const rowsForTask = (await db.syncQueue.toArray()).filter((op) => op.taskId === taskId);
    const { verdict, staleRowIds } = classifyRemoteDeletion(rowsForTask);

    if (verdict === 'protect') {
      logger.debug('Realtime delete skipped: local change pending', { taskId });
      return;
    }
    if (verdict === 'abandon') {
      const local = await db.tasks.get(taskId);
      if (local) await db.deletedTasks.put(toTrashedRecord(local));
      logger.warn('Abandoned retry-exhausted local edits to trash', { taskId });
    }

    if (staleRowIds.length > 0) await db.syncQueue.bulkDelete(staleRowIds);
    await db.tasks.delete(taskId);
    logger.debug('Realtime delete applied', { taskId });
  });
}

/**
 * Apply one realtime event. `ownerId` is the user signed in when the event
 * arrived, and the write lands only while that user still owns the sync session.
 */
export async function applyRemoteChange(
  action: 'create' | 'update' | 'delete',
  record: RecordModel,
  ownerId: string,
): Promise<void> {
  const db = getDb();

  if (action === 'delete') {
    const taskId = getPocketBaseTaskId(record);
    if (!taskId) {
      logger.warn('Realtime delete skipped: invalid record');
      return;
    }
    await applyRemoteDeletion(taskId, ownerId);
    return;
  }

  const remoteTask = pocketBaseToTaskRecord(record, null);
  if (!remoteTask) {
    logger.warn('Realtime change skipped: invalid record', { action });
    return;
  }

  await db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks, db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
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

/** Everything the outcome writers need to record a sync for its session owner. */
interface SyncOutcomeContext {
  ownerId: string;
  retryManager: ReturnType<typeof getRetryManager>;
  deviceId: string;
  triggeredBy: 'user' | 'auto';
  startTime: number;
}

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

function cancelledSync(): PBSyncResult {
  logger.debug('Sync cancelled: no current sync session');
  return { status: 'cancelled' };
}

/**
 * Full sync: push local changes, then pull remote changes.
 * Handles auth checks, cursor updates, partial failures, and error reporting.
 * A sync whose session ends partway through returns `cancelled` and leaves no
 * cursor, retry state, history row, or toast behind.
 */
export async function fullSync(triggeredBy: 'user' | 'auto' = 'auto'): Promise<PBSyncResult> {
  const startTime = Date.now();
  const config = await getDb().syncMetadata.get('sync_config') as PBSyncConfig | undefined;
  const ownerId = getSessionOwner(config);
  // A request queued before sign-out or reset has no session to sync for.
  if (!ownerId) return cancelledSync();

  const ctx: SyncOutcomeContext = {
    ownerId,
    retryManager: getRetryManager(),
    deviceId: await getDeviceId(),
    triggeredBy,
    startTime,
  };

  try {
    // A merely-expired JWT can still be refreshed from the server session.
    // Attempt that silently here; if it fails, push/pull report the auth
    // failure cleanly via the unauthenticated path below.
    // react-doctor-disable-next-line react-doctor/async-parallel -- auth->push->pull ordering is required; not independent
    await ensureValidAuth();

    const pushResult = await pushLocalChanges();
    const pullResult = await pullRemoteChanges(resolvePullCursor(config));

    if (!pushResult.authenticated && !pullResult.authenticated) {
      return await reportAuthFailure(ctx);
    }

    await updateSyncCursor(ownerId, pullResult.maxObservedTimestamp);

    if (pushResult.failedCount > 0) {
      return await reportPartialFailure(pushResult, pullResult, ctx);
    }
    return await reportSuccess(pushResult, pullResult, ctx);
  } catch (error) {
    return await reportSyncError(error, ctx);
  }
}

/**
 * Retry state and history rows are the sync's outcome. They commit in one
 * transaction with the session check, so a sync that outlived its session
 * records nothing. Callers show a toast only after this resolves.
 *
 * A stale session throws StaleSyncSessionError. The report helpers let it
 * propagate, so they must stay inside fullSync's try block, whose catch turns
 * it into `cancelled`. reportSyncError runs in that catch and handles it itself.
 */
async function writeSyncOutcome(ownerId: string, write: () => Promise<void>): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.syncMetadata, db.syncHistory], async () => {
    await assertSyncSessionCurrent(ownerId);
    await write();
  });
}

async function reportSuccess(
  pushResult: { pushedCount: number },
  pullResult: { pulledCount: number },
  ctx: SyncOutcomeContext,
): Promise<PBSyncResult> {
  const { pushedCount } = pushResult;
  const { pulledCount } = pullResult;
  await writeSyncOutcome(ctx.ownerId, async () => {
    await ctx.retryManager.recordSuccess();
    await recordSyncSuccess(pushedCount, pulledCount, 0, ctx.deviceId, ctx.triggeredBy, Date.now() - ctx.startTime);
  });

  if (pushedCount > 0 || pulledCount > 0) {
    notifySyncSuccess(pushedCount, pulledCount);
  }
  return { status: 'success', pushedCount, pulledCount };
}

async function reportAuthFailure(ctx: SyncOutcomeContext): Promise<PBSyncResult> {
  const authError = new Error('Sync skipped: not authenticated');
  await writeSyncOutcome(ctx.ownerId, async () => {
    await ctx.retryManager.recordFailure(authError);
    await recordSyncError(authError.message, ctx.deviceId, ctx.triggeredBy, Date.now() - ctx.startTime);
  });
  notifySyncError('Please sign in to sync your tasks', false);
  return { status: 'error', error: authError.message };
}

/**
 * Merge only the cursor fields into the row as it is now. Writing back the
 * start-of-sync snapshot would undo changes made during the sync, including
 * a sign-out.
 */
async function updateSyncCursor(ownerId: string, maxTimestamp: string | null): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
    const current = await db.syncMetadata.get('sync_config') as PBSyncConfig;
    // The legacy `lastSyncAt` is intentionally not advanced. It only feeds the
    // one-time migration in resolvePullCursor.
    await db.syncMetadata.put({
      ...current,
      lastClientUpdatedAt: maxTimestamp ?? current.lastClientUpdatedAt ?? null,
      pullCursorVersion: 2,
      lastServerUpdatedAt: null,
      lastSuccessfulSyncAt: new Date().toISOString(),
    });
  });
}

async function reportPartialFailure(
  pushResult: { pushedCount: number; failedCount: number; lastError: string | null; retryAfterMs?: number | null },
  pullResult: { pulledCount: number },
  ctx: SyncOutcomeContext,
): Promise<PBSyncResult> {
  const errorMsg = `${pushResult.failedCount} item(s) failed to sync: ${pushResult.lastError}`;
  await writeSyncOutcome(ctx.ownerId, async () => {
    await ctx.retryManager.recordFailure(new Error(errorMsg), { retryAfterMs: pushResult.retryAfterMs ?? null });
    await recordSyncPartial({
      pushedCount: pushResult.pushedCount,
      pulledCount: pullResult.pulledCount,
      failedCount: pushResult.failedCount,
      ...(pushResult.lastError ? { errorMessage: pushResult.lastError } : {}),
      deviceId: ctx.deviceId,
      triggeredBy: ctx.triggeredBy,
      duration: Date.now() - ctx.startTime,
    });
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

async function reportSyncError(error: unknown, ctx: SyncOutcomeContext): Promise<PBSyncResult> {
  if (error instanceof StaleSyncSessionError) return cancelledSync();
  const errorObj = error instanceof Error ? error : new Error(String(error));
  // PB 4xx bodies can echo submitted field values (task titles), so persist
  // and surface only the stable code; keep the raw Error for diagnostics.
  const errorCode = sanitizeSyncError(errorObj);
  try {
    await writeSyncOutcome(ctx.ownerId, async () => {
      // A directly-thrown 429 (e.g. from pull) may carry a Retry-After hint.
      await ctx.retryManager.recordFailure(errorObj, { retryAfterMs: extractRetryAfterMs(errorObj) });
      await recordSyncError(errorCode, ctx.deviceId, ctx.triggeredBy, Date.now() - ctx.startTime);
    });
  } catch (writeError) {
    // The session can also end while this failure is being recorded.
    if (writeError instanceof StaleSyncSessionError) return cancelledSync();
    throw writeError;
  }
  notifySyncError(errorCode, false);
  if (isTransientSyncFailure(errorObj)) {
    logger.warn('Full sync failed (transient)', { triggeredBy: ctx.triggeredBy, errorCode });
  } else {
    logger.error('Full sync failed', errorObj, { triggeredBy: ctx.triggeredBy, errorCode });
  }
  return { status: 'error', error: errorCode };
}
