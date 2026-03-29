/**
 * PocketBase sync engine — orchestration layer
 *
 * Re-exports push/pull operations and provides fullSync orchestration
 * with retry management, history recording, and notifications.
 */

import { getDb } from '@/lib/db';
import { pocketBaseToTaskRecord } from './task-mapper';
import { createLogger } from '@/lib/logger';
import { getRetryManager } from './retry-manager';
import { recordSyncSuccess, recordSyncError } from '@/lib/sync-history';
import { notifySyncSuccess, notifySyncError } from './notifications';
import { getDeviceId } from './pb-sync-helpers';
import { pushLocalChanges } from './pb-push';
import { pullRemoteChanges } from './pb-pull';
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
    const taskId = record['task_id'] as string;
    await db.tasks.delete(taskId);
    logger.debug('Realtime delete applied', { taskId });
    return;
  }

  const remoteTask = pocketBaseToTaskRecord(record);
  if (!remoteTask) {
    logger.warn('Realtime change skipped: invalid record', { action });
    return;
  }

  if (action === 'create') {
    const existing = await db.tasks.get(remoteTask.id);
    if (!existing) {
      await db.tasks.add(remoteTask);
      logger.debug('Realtime create applied', { taskId: remoteTask.id });
    }
    return;
  }

  // update — LWW
  const localTask = await db.tasks.get(remoteTask.id);
  if (!localTask || new Date(remoteTask.updatedAt).getTime() >= new Date(localTask.updatedAt).getTime()) {
    await db.tasks.put(remoteTask);
    logger.debug('Realtime update applied', { taskId: remoteTask.id });
  }
}

// ─── Full sync orchestration ─────────────────────────────────────────

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
    const lastSyncAt = config?.lastSyncAt ?? null;

    const pushResult = await pushLocalChanges();
    const pullResult = await pullRemoteChanges(lastSyncAt);

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

  const db = getDb();
  await db.syncMetadata.put({
    ...config,
    lastSyncAt: maxTimestamp ?? config.lastSyncAt ?? null,
    lastSuccessfulSyncAt: new Date().toISOString(),
  });
}

async function reportPartialFailure(
  pushResult: { pushedCount: number; failedCount: number; lastError: string | null },
  pullResult: { pulledCount: number },
  retryManager: ReturnType<typeof getRetryManager>,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  duration: number,
): Promise<PBSyncResult> {
  const errorMsg = `${pushResult.failedCount} item(s) failed to sync: ${pushResult.lastError}`;
  await retryManager.recordFailure(new Error(errorMsg));
  await recordSyncSuccess(pushResult.pushedCount, pullResult.pulledCount, 0, deviceId, triggeredBy, duration);
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
  await retryManager.recordFailure(errorObj);
  await recordSyncError(errorObj.message, deviceId, triggeredBy, Date.now() - startTime);
  notifySyncError(errorObj.message, false);
  logger.error('Full sync failed', errorObj, { triggeredBy });
  return { status: 'error', error: errorObj.message };
}
