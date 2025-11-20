/**
 * Sync configuration utilities
 * Helper functions for managing sync settings
 */

import { getDb } from '@/lib/db';
import { getCryptoManager } from './crypto';
import { getApiClient } from './api-client';
import { getSyncQueue } from './queue';
import { ensureSyncConfigInitialized, migrateLegacyConfig } from './config-migration';
import type { SyncConfig, RegisterRequest, LoginRequest } from './types';

/**
 * Get sync configuration
 */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  await ensureSyncConfigInitialized();
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');

  if (!config) {
    return null;
  }

  // Migrate legacy configs
  const syncConfig = migrateLegacyConfig(config as SyncConfig);

  return syncConfig;
}

/**
 * Update sync configuration
 */
export async function updateSyncConfig(updates: Partial<SyncConfig>): Promise<void> {
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
 * Get auto-sync configuration
 * Returns defaults if not set
 */
export async function getAutoSyncConfig(): Promise<import('./types').BackgroundSyncConfig> {
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
  const { getHealthMonitor } = await import('./health-monitor');
  const healthMonitor = getHealthMonitor();

  if (!healthMonitor.isActive()) {
    console.log('[SYNC] Starting health monitor (sync enabled)');
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
    key: 'sync_config',
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
    throw new Error('Sync config not initialized');
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


/**
 * Stop health monitoring
 */
async function stopHealthMonitor(): Promise<void> {
  const { getHealthMonitor } = await import('./health-monitor');
  const healthMonitor = getHealthMonitor();

  if (healthMonitor.isActive()) {
    console.log('[SYNC] Stopping health monitor (sync disabled)');
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
async function resetSyncConfig(current: SyncConfig): Promise<void> {
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
    key: 'sync_config',
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
  await resetSyncConfig(current);
}

/**
 * Register new sync account
 */
export async function registerSyncAccount(
  email: string,
  password: string,
  deviceName?: string
): Promise<void> {
  const config = await getSyncConfig();
  if (!config) {
    throw new Error('Sync config not initialized');
  }

  const api = getApiClient(config.serverUrl);

  const request: RegisterRequest = {
    email,
    password: password,
    deviceName: deviceName || config.deviceName,
  };

  const response = await api.register(request);

  // Enable sync with the new credentials
  await enableSync(
    response.userId,
    email,
    response.token,
    response.expiresAt,
    response.salt,
    password
  );

  // Update device ID
  await updateSyncConfig({
    deviceId: response.deviceId,
  });
}

/**
 * Login to existing sync account
 */
export async function loginSyncAccount(
  email: string,
  password: string
): Promise<void> {
  const config = await getSyncConfig();
  if (!config) {
    throw new Error('Sync config not initialized');
  }

  const api = getApiClient(config.serverUrl);

  const request: LoginRequest = {
    email,
    passwordHash: password,
    deviceId: config.deviceId,
    deviceName: config.deviceName,
  };

  const response = await api.login(request);

  // Enable sync with the login credentials
  await enableSync(
    response.userId,
    email,
    response.token,
    response.expiresAt,
    response.salt,
    password
  );

  // Update device ID if changed
  if (response.deviceId !== config.deviceId) {
    await updateSyncConfig({
      deviceId: response.deviceId,
    });
  }
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

/**
 * Clear sync queue and local tasks
 */
async function clearLocalData(): Promise<number> {
  const db = getDb();

  await db.syncQueue.clear();
  console.log('[SYNC RESET] Cleared sync queue');

  const taskCount = await db.tasks.count();
  await db.tasks.clear();
  console.log(`[SYNC RESET] Cleared ${taskCount} local tasks`);

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
    key: 'sync_config',
  });
  console.log('[SYNC RESET] Reset sync metadata (lastSyncAt=0, vectorClock={})');
}

/**
 * Reset sync state and perform full sync from server
 * This clears lastSyncAt and vector clocks to force a complete pull
 * Useful for debugging sync issues or recovering from inconsistent state
 */
export async function resetAndFullSync(): Promise<void> {
  const config = await getSyncConfig();
  if (!config || !config.enabled) {
    throw new Error('Sync not enabled');
  }

  const db = getDb();

  console.log('[SYNC RESET] Starting full sync reset...');
  console.log('[SYNC RESET] Current state:', {
    lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
    vectorClock: config.vectorClock,
    pendingOps: await db.syncQueue.count(),
  });

  // Clear local data
  await clearLocalData();

  // Reset sync metadata
  await resetSyncMetadata(config);

  console.log('[SYNC RESET] Reset complete. Run sync() to pull all tasks from server.');
}
