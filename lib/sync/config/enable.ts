/**
 * Sync enable functionality
 */

import { getDb } from "@/lib/db";
import { getCryptoManager } from "../crypto";
import { getApiClient } from "../api-client";
import { getSyncQueue } from "../queue";
import type { SyncConfig } from "../types";
import { getSyncConfig, updateAutoSyncConfig } from "./get-set";

/**
 * Initialize crypto manager with user password
 */
async function initializeCrypto(password: string, salt: string): Promise<void> {
  const crypto = getCryptoManager();
  await crypto.deriveKey(password, salt);
}

/**
 * Queue existing tasks for initial sync
 */
async function queueExistingTasks(): Promise<void> {
  const db = getDb();
  const taskCount = await db.tasks.count();

  if (taskCount > 0) {
    const queue = getSyncQueue();
    const populatedCount = await queue.populateFromExistingTasks();
    console.log(`[SYNC] Initial sync setup: queued ${populatedCount} existing tasks`);
  }
}

/**
 * Start health monitoring
 */
async function startHealthMonitor(): Promise<void> {
  const { getHealthMonitor } = await import("../health-monitor");
  const healthMonitor = getHealthMonitor();

  if (!healthMonitor.isActive()) {
    console.log("[SYNC] Starting health monitor (sync enabled)");
    healthMonitor.start();
  }
}

/**
 * Update sync config with auth credentials
 */
async function updateAuthCredentials(
  current: SyncConfig,
  userId: string,
  email: string,
  token: string,
  expiresAt: number
): Promise<void> {
  const db = getDb();

  await db.syncMetadata.put({
    ...current,
    enabled: true,
    userId,
    email,
    token,
    tokenExpiresAt: expiresAt,
    key: "sync_config",
  });
}

/**
 * Enable sync (typically called after successful auth)
 */
export async function enableSync(
  userId: string,
  email: string,
  token: string,
  expiresAt: number,
  salt: string,
  password: string
): Promise<void> {
  const current = await getSyncConfig();

  if (!current) {
    throw new Error("Sync config not initialized");
  }

  // Initialize crypto manager with password
  await initializeCrypto(password, salt);

  // Update config with auth credentials
  await updateAuthCredentials(current, userId, email, token, expiresAt);

  // Set default auto-sync config if not present
  if (current.autoSyncEnabled === undefined) {
    await updateAutoSyncConfig(true, 2); // Default: enabled, 2 min interval
  }

  // Set token in API client
  const api = getApiClient(current.serverUrl);
  api.setToken(token);

  // Queue existing tasks for initial sync
  await queueExistingTasks();

  // Start health monitor
  await startHealthMonitor();
}
