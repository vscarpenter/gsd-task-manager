/**
 * Metadata manager - handles sync configuration and metadata updates
 * Manages IndexedDB sync_config record and task queueing.
 * Vector clocks have been removed — timestamps drive conflict resolution.
 */

import { getDb } from '@/lib/db';
import { getSyncQueue } from '../queue';
import { createLogger } from '@/lib/logger';
import type { SyncConfig } from '../types';

const logger = createLogger('SYNC_METADATA');

/**
 * Update sync metadata after a successful sync cycle.
 * Uses the sync START time as lastSyncAt to avoid a race condition:
 * tasks modified after sync starts will be caught in the next cycle.
 */
export async function updateSyncMetadata(
  config: SyncConfig,
  syncStartTime: number
): Promise<void> {
  const db = getDb();

  logger.debug('Updating sync metadata', {
    previousLastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
    newLastSyncAt: new Date(syncStartTime).toISOString(),
    timingWindow: config.lastSyncAt ? `${syncStartTime - config.lastSyncAt}ms` : 'initial sync',
  });

  await db.syncMetadata.put({
    ...config,
    lastSyncAt: syncStartTime,
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
 * Update sync configuration with partial changes
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
 * Get current sync status (combines config, queue state, and running flag)
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
 * Queue all existing tasks for initial sync.
 * Called when sync is first enabled or re-enabled.
 * Skips tasks that are already queued to avoid duplicates.
 *
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

  const allTasks = await db.tasks.toArray();
  logger.debug('Found tasks in IndexedDB', { taskCount: allTasks.length });

  const pendingOps = await queue.getPending();
  const queuedTaskIds = new Set(pendingOps.map(op => op.taskId));

  let queuedCount = 0;
  let skippedCount = 0;

  for (const task of allTasks) {
    if (queuedTaskIds.has(task.id)) {
      logger.debug('Skipping task — already in queue', { taskId: task.id });
      skippedCount++;
      continue;
    }

    await queue.enqueue('create', task.id, task);
    queuedCount++;
  }

  logger.info('Initial task queueing complete', { queuedCount, skippedCount });

  return queuedCount;
}
