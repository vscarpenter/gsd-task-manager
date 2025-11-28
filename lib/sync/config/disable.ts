/**
 * Sync disable functionality
 */

import { getDb } from "@/lib/db";
import { getCryptoManager } from "../crypto";
import { getApiClient } from "../api-client";
import type { SyncConfig } from "../types";
import { getSyncConfig } from "./get-set";

/**
 * Stop health monitoring
 */
async function stopHealthMonitor(): Promise<void> {
  const { getHealthMonitor } = await import("../health-monitor");
  const healthMonitor = getHealthMonitor();

  if (healthMonitor.isActive()) {
    console.log("[SYNC] Stopping health monitor (sync disabled)");
    healthMonitor.stop();
  }
}

/**
 * Clear crypto and API credentials
 */
function clearCredentials(serverUrl: string): void {
  const crypto = getCryptoManager();
  crypto.clear();

  const api = getApiClient(serverUrl);
  api.setToken(null);
}

/**
 * Reset sync config to disabled state
 */
async function resetSyncConfigState(current: SyncConfig): Promise<void> {
  const db = getDb();

  await db.syncMetadata.put({
    ...current,
    enabled: false,
    userId: null,
    email: null,
    token: null,
    tokenExpiresAt: null,
    lastSyncAt: null,
    vectorClock: {},
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

  // Clear credentials
  clearCredentials(current.serverUrl);

  // Reset config
  await resetSyncConfigState(current);
}
