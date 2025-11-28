/**
 * Sync configuration getters and setters
 */

import { getDb } from "@/lib/db";
import { ensureSyncConfigInitialized, migrateLegacyConfig } from "../config-migration";
import type { SyncConfig, BackgroundSyncConfig } from "../types";

/**
 * Get sync configuration
 */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  await ensureSyncConfigInitialized();
  const db = getDb();
  const config = await db.syncMetadata.get("sync_config");

  if (!config) {
    return null;
  }

  return migrateLegacyConfig(config as SyncConfig);
}

/**
 * Update sync configuration
 */
export async function updateSyncConfig(updates: Partial<SyncConfig>): Promise<void> {
  const db = getDb();
  const current = await getSyncConfig();

  if (!current) {
    throw new Error("Sync config not initialized");
  }

  await db.syncMetadata.put({
    ...current,
    ...updates,
    key: "sync_config",
  });
}

/**
 * Get auto-sync configuration
 * Returns defaults if not set
 */
export async function getAutoSyncConfig(): Promise<BackgroundSyncConfig> {
  const config = await getSyncConfig();

  return {
    enabled: config?.autoSyncEnabled ?? true,
    intervalMinutes: config?.autoSyncIntervalMinutes ?? 2,
    syncOnFocus: true,
    syncOnOnline: true,
    debounceAfterChangeMs: 30000, // 30 seconds
  };
}

/**
 * Update auto-sync preferences
 */
export async function updateAutoSyncConfig(
  enabled: boolean,
  intervalMinutes: number
): Promise<void> {
  // Clamp interval to valid range (1-30 minutes)
  const clampedInterval = Math.max(1, Math.min(30, intervalMinutes));

  await updateSyncConfig({
    autoSyncEnabled: enabled,
    autoSyncIntervalMinutes: clampedInterval,
  });
}

/**
 * Check if sync is enabled
 */
export async function isSyncEnabled(): Promise<boolean> {
  const config = await getSyncConfig();
  return config?.enabled || false;
}

/**
 * Get sync status summary
 */
export async function getSyncStatus() {
  const config = await getSyncConfig();
  const db = getDb();
  const pendingCount = await db.syncQueue.count();

  return {
    enabled: config?.enabled || false,
    email: config?.email || null,
    lastSyncAt: config?.lastSyncAt || null,
    pendingCount,
    deviceId: config?.deviceId || null,
    serverUrl: config?.serverUrl || null,
  };
}
