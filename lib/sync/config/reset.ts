/**
 * Sync reset functionality
 */

import { getDb } from "@/lib/db";
import type { SyncConfig } from "../types";
import { getSyncConfig } from "./get-set";
import { createLogger } from "@/lib/logger";

const logger = createLogger('SYNC_CONFIG');

/**
 * Clear sync queue and local tasks
 */
async function clearLocalData(): Promise<number> {
  const db = getDb();

  await db.syncQueue.clear();
  logger.info('Cleared sync queue');

  const taskCount = await db.tasks.count();
  await db.tasks.clear();
  logger.info('Cleared local tasks', { taskCount });

  return taskCount;
}

/**
 * Reset sync metadata for full pull
 */
async function resetSyncMetadata(config: SyncConfig): Promise<void> {
  const db = getDb();

  await db.syncMetadata.put({
    ...config,
    lastSyncAt: 0,
    vectorClock: {},
    key: "sync_config",
  });
  logger.info('Reset sync metadata', { lastSyncAt: 0, vectorClock: {} });
}

/**
 * Reset sync state and perform full sync from server
 * This clears lastSyncAt and vector clocks to force a complete pull
 * Useful for debugging sync issues or recovering from inconsistent state
 */
export async function resetAndFullSync(): Promise<void> {
  const config = await getSyncConfig();
  if (!config || !config.enabled) {
    throw new Error("Sync not enabled");
  }

  const db = getDb();

  logger.info('Starting full sync reset', {
    lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
    vectorClock: config.vectorClock as Record<string, unknown>,
    pendingOps: await db.syncQueue.count(),
  });

  // Clear local data
  await clearLocalData();

  // Reset sync metadata
  await resetSyncMetadata(config);

  logger.info('Reset complete - run sync() to pull all tasks from server');
}
