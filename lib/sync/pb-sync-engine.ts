/**
 * PocketBase sync engine
 *
 * Handles push (local → PocketBase) and pull (PocketBase → local) operations.
 * Uses last-write-wins (LWW) conflict resolution based on client_updated_at.
 */

import { getPocketBase, getCurrentUserId } from './pocketbase-client';
import { getSyncQueue } from './queue';
import { taskRecordToPocketBase, pocketBaseToTaskRecord } from './task-mapper';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { getRetryManager } from './retry-manager';
import { recordSyncSuccess, recordSyncError } from '@/lib/sync-history';
import { notifySyncSuccess, notifySyncError } from './notifications';
import type { PBSyncResult, PBSyncConfig } from './types';
import type { RecordModel } from 'pocketbase';

const logger = createLogger('SYNC_ENGINE');

/** Delay between API requests to avoid PocketBase rate limiting (429) */
const THROTTLE_MS = 100;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Escape a string value for safe use in PocketBase filter expressions */
function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Get the current device ID from sync config in IndexedDB
 */
async function getDeviceId(): Promise<string> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');
  return (config as PBSyncConfig | undefined)?.deviceId ?? 'unknown';
}

/**
 * Fetch all existing remote task_ids for the current user in one request.
 * Returns a Map of task_id → PocketBase record id for efficient lookups.
 */
async function fetchRemoteTaskIndex(ownerId: string): Promise<{ index: Map<string, string>; fetchSucceeded: boolean }> {
  const pb = getPocketBase();
  const index = new Map<string, string>();

  try {
    const records = await pb.collection('tasks').getFullList({
      filter: `owner = "${escapeFilterValue(ownerId)}"`,
      fields: 'id,task_id',
    });
    for (const r of records) {
      index.set(r['task_id'] as string, r.id);
    }
    return { index, fetchSucceeded: true };
  } catch {
    logger.warn('Could not fetch remote task index; will check individually');
    return { index, fetchSucceeded: false };
  }
}

/**
 * Push all pending local changes to PocketBase
 * Pre-fetches remote task IDs to avoid per-item lookups, and throttles
 * requests to stay under PocketBase rate limits.
 */
export interface PushResult {
  pushedCount: number;
  failedCount: number;
  lastError: string | null;
  authenticated: boolean;
}

export async function pushLocalChanges(): Promise<PushResult> {
  const pb = getPocketBase();
  const queue = getSyncQueue();
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Push skipped: not authenticated');
    return { pushedCount: 0, failedCount: 0, lastError: null, authenticated: false };
  }

  const pending = await queue.getPending();
  if (pending.length === 0) return { pushedCount: 0, failedCount: 0, lastError: null, authenticated: true };

  const deviceId = await getDeviceId();

  // Pre-fetch all remote records in one request to avoid N individual lookups
  const { index: remoteIndex, fetchSucceeded: indexFetchSucceeded } = await fetchRemoteTaskIndex(ownerId);
  let pushedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  for (const item of pending) {
    try {
      const pbRecordId = remoteIndex.get(item.taskId);

      if (item.operation === 'create' && item.payload) {
        const data = taskRecordToPocketBase(item.payload, ownerId, deviceId);
        if (pbRecordId) {
          await pb.collection('tasks').update(pbRecordId, data);
        } else {
          const created = await pb.collection('tasks').create(data);
          remoteIndex.set(item.taskId, created.id);
        }
      } else if (item.operation === 'update' && item.payload) {
        const data = taskRecordToPocketBase(item.payload, ownerId, deviceId);
        if (pbRecordId) {
          await pb.collection('tasks').update(pbRecordId, data);
        } else {
          const created = await pb.collection('tasks').create(data);
          remoteIndex.set(item.taskId, created.id);
        }
      } else if (item.operation === 'delete') {
        if (pbRecordId) {
          await pb.collection('tasks').delete(pbRecordId);
          remoteIndex.delete(item.taskId);
        } else if (!indexFetchSucceeded) {
          // Index fetch failed — cannot confirm task doesn't exist remotely
          // Skip dequeue so the delete retries on next sync
          logger.warn('Skipping delete dequeue: remote index unavailable', { taskId: item.taskId });
          failedCount++;
          lastError = 'Remote index unavailable for delete verification';
          await queue.incrementRetry(item.id);
          continue;
        }
        // If index fetched successfully and task not found, safe to dequeue
      }

      await queue.dequeue(item.id);
      pushedCount++;

      // Throttle to avoid 429 rate limiting
      if (pushedCount < pending.length) {
        await delay(THROTTLE_MS);
      }
    } catch (error) {
      failedCount++;
      lastError = error instanceof Error ? error.message : String(error);
      logger.error('Push failed for item', error instanceof Error ? error : new Error(String(error)), {
        taskId: item.taskId,
        operation: item.operation,
      });
      await queue.incrementRetry(item.id);
    }
  }

  logger.info('Push completed', { pushedCount, failedCount, total: pending.length });
  return { pushedCount, failedCount, lastError, authenticated: true };
}

/**
 * Pull remote changes from PocketBase into local IndexedDB
 * Fetches tasks updated after the last sync timestamp.
 * LWW: remote wins if remote client_updated_at >= local updatedAt.
 */
export async function pullRemoteChanges(lastSyncAt: string | null): Promise<{ pulledCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const pb = getPocketBase();
  const db = getDb();
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, authenticated: false, maxObservedTimestamp: null };
  }

  // Build filter: tasks owned by this user, optionally updated since last sync
  let filter = `owner = "${escapeFilterValue(ownerId)}"`;
  if (lastSyncAt) {
    filter += ` && client_updated_at > "${escapeFilterValue(lastSyncAt)}"`;
  }

  const records = await pb.collection('tasks').getFullList({
    filter,
    sort: '-client_updated_at',
  });

  let pulledCount = 0;
  let skippedCount = 0;
  for (const record of records) {
    const remoteTask = pocketBaseToTaskRecord(record);
    if (!remoteTask) {
      skippedCount++;
      continue;
    }

    const localTask = await db.tasks.get(remoteTask.id);

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

  if (skippedCount > 0) {
    logger.warn('Skipped invalid remote records during pull', { skippedCount });
  }

  // Track the maximum observed client_updated_at for cursor advancement
  let maxObservedTimestamp: string | null = null;
  for (const record of records) {
    const clientUpdatedAt = record['client_updated_at'] as string;
    if (clientUpdatedAt && (!maxObservedTimestamp || clientUpdatedAt > maxObservedTimestamp)) {
      maxObservedTimestamp = clientUpdatedAt;
    }
  }

  // Handle remote deletions on every sync by comparing full remote index
  // For incremental syncs, `records` only contains recently changed tasks,
  // so we need to fetch the complete remote task ID set for deletion detection
  await reconcileDeletedTasks(ownerId);

  logger.info('Pull completed', { pulledCount, fetched: records.length });
  return { pulledCount, authenticated: true, maxObservedTimestamp };
}

/**
 * Remove local tasks that no longer exist remotely.
 * Fetches the complete remote task ID index and compares against local tasks.
 * Tasks with pending sync operations are preserved (they may not be on the server yet).
 */
async function reconcileDeletedTasks(ownerId: string): Promise<void> {
  const { index: remoteIndex, fetchSucceeded } = await fetchRemoteTaskIndex(ownerId);

  // If we couldn't fetch the remote index, skip deletion to avoid data loss
  if (!fetchSucceeded) {
    logger.warn('Skipping deletion reconciliation: remote index unavailable');
    return;
  }

  const db = getDb();
  const localTasks = await db.tasks.toArray();
  const remoteTaskIds = new Set(remoteIndex.keys());
  const queue = getSyncQueue();

  for (const local of localTasks) {
    if (!remoteTaskIds.has(local.id)) {
      const pendingOps = await queue.getForTask(local.id);
      if (pendingOps.length === 0) {
        await db.tasks.delete(local.id);
        logger.debug('Deleted locally: task removed from server', { taskId: local.id });
      }
    }
  }
}

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
  } else {
    // update — LWW
    const localTask = await db.tasks.get(remoteTask.id);
    if (!localTask || new Date(remoteTask.updatedAt).getTime() >= new Date(localTask.updatedAt).getTime()) {
      await db.tasks.put(remoteTask);
      logger.debug('Realtime update applied', { taskId: remoteTask.id });
    }
  }
}

/**
 * Full sync: push local changes, then pull remote changes
 */
export async function fullSync(triggeredBy: 'user' | 'auto' = 'auto'): Promise<PBSyncResult> {
  const startTime = Date.now();
  const retryManager = getRetryManager();
  const deviceId = await getDeviceId();

  try {
    // Read last sync timestamp
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;
    const lastSyncAt = config?.lastSyncAt ?? null;

    // Push first, then pull
    const pushResult = await pushLocalChanges();
    const pullResult = await pullRemoteChanges(lastSyncAt);

    // If neither push nor pull was authenticated, treat as auth error
    if (!pushResult.authenticated && !pullResult.authenticated) {
      const authError = new Error('Sync skipped: not authenticated');
      await retryManager.recordFailure(authError);
      const duration = Date.now() - startTime;
      await recordSyncError(authError.message, deviceId, triggeredBy, duration);
      notifySyncError('Please sign in to sync your tasks', false);
      return { status: 'error', error: authError.message };
    }

    // Update last sync cursor using server-observed timestamps (not client clock)
    if (config) {
      const newCursor = pullResult.maxObservedTimestamp ?? config.lastSyncAt ?? null;
      await db.syncMetadata.put({
        ...config,
        lastSyncAt: newCursor,
        lastSuccessfulSyncAt: new Date().toISOString(),
      });
    }

    const duration = Date.now() - startTime;

    // Report partial failures when some items failed to push
    if (pushResult.failedCount > 0) {
      const errorMsg = `${pushResult.failedCount} item(s) failed to sync: ${pushResult.lastError}`;
      // Do NOT record success on partial failure
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

    await retryManager.recordSuccess();
    await recordSyncSuccess(pushResult.pushedCount, pullResult.pulledCount, 0, deviceId, triggeredBy, duration);

    if (pushResult.pushedCount > 0 || pullResult.pulledCount > 0) {
      notifySyncSuccess(pushResult.pushedCount, pullResult.pulledCount);
    }

    return { status: 'success', pushedCount: pushResult.pushedCount, pulledCount: pullResult.pulledCount };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await retryManager.recordFailure(errorObj);

    const duration = Date.now() - startTime;
    await recordSyncError(errorObj.message, deviceId, triggeredBy, duration);

    notifySyncError(errorObj.message, false);

    logger.error('Full sync failed', errorObj, { triggeredBy });
    return { status: 'error', error: errorObj.message };
  }
}

