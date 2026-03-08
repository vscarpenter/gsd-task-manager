/**
 * Sync disable functionality
 *
 * Clears PB auth store, sync queue, and resets IndexedDB sync metadata.
 */

import { getDb } from "@/lib/db";
import { clearPocketBase } from "../pocketbase-client";
import type { PBSyncConfig } from "../types";
import { getSyncConfig } from "./get-set";
import { createLogger } from "@/lib/logger";

const logger = createLogger('SYNC_CONFIG');

/**
 * Stop health monitoring
 */
async function stopHealthMonitor(): Promise<void> {
  const { getHealthMonitor } = await import("../health-monitor");
  const healthMonitor = getHealthMonitor();

  if (healthMonitor.isActive()) {
    logger.info('Stopping health monitor (sync disabled)');
    healthMonitor.stop();
  }
}

/**
 * Reset sync config to disabled state
 */
async function resetSyncConfigState(current: PBSyncConfig): Promise<void> {
  const db = getDb();

  await db.syncMetadata.put({
    ...current,
    enabled: false,
    userId: null,
    email: null,
    provider: null,
    lastSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
    key: "sync_config",
  });

  // Clear sync queue
  await db.syncQueue.clear();
}

/**
 * Disable sync (logout)
 */
export async function disableSync(): Promise<void> {
  const current = await getSyncConfig();

  if (!current) {
    return;
  }

  // Stop health monitor
  await stopHealthMonitor();

  // Clear PocketBase auth state (token + localStorage)
  clearPocketBase();

  // Reset config in IndexedDB
  await resetSyncConfigState(current);

  logger.info('Sync disabled');
}
