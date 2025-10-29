/**
 * Metadata manager - handles sync configuration and metadata updates
 * Manages IndexedDB sync_config record and task queueing
 */

import { getDb } from '@/lib/db';
import { getSyncQueue } from '../queue';
import { mergeVectorClocks } from '../vector-clock';
import { createLogger } from '@/lib/logger';
import type { SyncConfig, VectorClock } from '../types';

const logger = createLogger('SYNC_METADATA');

/**
 * Update sync metadata after successful sync
 */
export async function updateSyncMetadata(
  config: SyncConfig,
  serverClock: VectorClock,
  syncStartTime: number
): Promise<void> {
  const db = getDb();

  const mergedClock = mergeVectorClocks(config.vectorClock, serverClock);

  // Use sync START time to prevent race condition
  // Tasks modified after sync starts will be caught in the next sync
  // Server uses >= comparison, so no adjustment needed
  logger.debug('Updating sync metadata', {
    previousLastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
    newLastSyncAt: new Date(syncStartTime).toISOString(),
    timingWindow: config.lastSyncAt ? `${syncStartTime - config.lastSyncAt}ms` : 'initial sync',
  });

  await db.syncMetadata.put({
    ...config,
    lastSyncAt: syncStartTime,
    vectorClock: mergedClock,
    key: 'sync_config',
  });
}

/**
 * Get sync configuration from IndexedDB
 */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');
  return config as SyncConfig | null;
}

/**
 * Update sync configuration
 */
export async function updateConfig(updates: Partial<SyncConfig>): Promise<void> {
  const db = getDb();
  const current = await getSyncConfig();

  if (!current) {
    throw new Error('Sync config not initialized');
  }

  await db.syncMetadata.put({
    ...current,
    ...updates,
    key: 'sync_config',
  });
}

/**
 * Check if sync is enabled
 */
export async function isEnabled(): Promise<boolean> {
  const config = await getSyncConfig();
  return config?.enabled || false;
}

/**
 * Get current sync status
 */
export async function getStatus(isRunning: boolean) {
  const config = await getSyncConfig();
  const queue = getSyncQueue();
  const pendingCount = await queue.getPendingCount();

  return {
    enabled: config?.enabled || false,
    lastSyncAt: config?.lastSyncAt || null,
    pendingCount,
    isRunning,
  };
}

/**
 * Queue all existing tasks for initial sync
 * Called when sync is first enabled or re-enabled
 * @returns Number of tasks queued
 */
export async function queueExistingTasks(): Promise<number> {
  const db = getDb();
  const queue = getSyncQueue();
  const config = await getSyncConfig();

  if (!config || !config.enabled) {
    logger.warn('Cannot queue tasks: sync not enabled');
    return 0;
  }

  logger.info('Queueing existing tasks for initial sync');

  // Get all tasks from IndexedDB
  const allTasks = await db.tasks.toArray();
  logger.debug('Found tasks in IndexedDB', { taskCount: allTasks.length });

  // Get all pending operations to check for duplicates
  const pendingOps = await queue.getPending();
  const queuedTaskIds = new Set(pendingOps.map(op => op.taskId));

  let queuedCount = 0;
  let skippedCount = 0;

  for (const task of allTasks) {
    // Skip if already in queue
    if (queuedTaskIds.has(task.id)) {
      logger.debug('Skipping task - already in queue', { taskId: task.id });
      skippedCount++;
      continue;
    }

    // Queue as 'create' operation with current vector clock
    await queue.enqueue(
      'create',
      task.id,
      task,
      task.vectorClock || {}
    );

    queuedCount++;
  }

  logger.info('Initial task queueing complete', {
    queuedCount,
    skippedCount,
  });

  return queuedCount;
}
