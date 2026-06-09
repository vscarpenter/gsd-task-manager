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
import { clearAppCaches } from "@/lib/browser-cache";

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
 * Reset sync config to disabled state and wipe per-user sync artefacts.
 *
 * Important on shared/kiosk devices: the next user on the same browser
 * profile must not see the previous user's sync metadata, queued
 * operations, or sync-history entries (which carry device IDs, task
 * counts, and error messages that may contain task content).
 */
async function resetSyncConfigState(current: PBSyncConfig): Promise<void> {
  const db = getDb();
  const localTaskOwnerUserId = current.localTaskOwnerUserId ?? current.userId ?? null;

  await db.syncMetadata.put({
    ...current,
    enabled: false,
    userId: null,
    email: null,
    provider: null,
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
    localTaskOwnerUserId,
    key: "sync_config",
  });

  // Clear sync queue
  await db.syncQueue.clear();

  // Clear sync history — privacy on shared devices.
  await db.syncHistory.clear();
}

async function clearBrowserCaches(): Promise<void> {
  try {
    const clearedCaches = await clearAppCaches();
    if (clearedCaches.length > 0) {
      logger.info('Cleared app caches during sync disable', {
        clearedCacheCount: clearedCaches.length,
      });
    }
  } catch (err) {
    logger.warn('Failed to clear app caches during sync disable', {
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Disable sync (logout)
 */
export async function disableSync(): Promise<void> {
  const current = await getSyncConfig();

  if (!current) {
    clearPocketBase();
    await clearBrowserCaches();
    return;
  }

  // Stop health monitor
  await stopHealthMonitor();

  // Clear PocketBase auth state (token + localStorage)
  clearPocketBase();
  await clearBrowserCaches();

  // Reset config in IndexedDB
  await resetSyncConfigState(current);

  logger.info('Sync disabled');
}
