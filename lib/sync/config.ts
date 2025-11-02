/**
 * Sync configuration utilities
 * Helper functions for managing sync settings
 */

import { getDb } from '@/lib/db';
import { ENV_CONFIG } from '@/lib/env-config';
import { getCryptoManager } from './crypto';
import { getApiClient } from './api-client';
import { getSyncQueue } from './queue';
import type { SyncConfig, RegisterRequest, LoginRequest } from './types';

/**
 * Initialize sync configuration if it doesn't exist
 */
async function ensureSyncConfigInitialized(): Promise<void> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');

  if (!config) {
    // Initialize sync config for the first time
    const deviceId = crypto.randomUUID();
    const deviceName = typeof navigator !== 'undefined' && navigator?.userAgent?.includes('Mac') ? 'Mac' : 'Desktop';

    await db.syncMetadata.add({
      key: 'sync_config',
      enabled: false,
      userId: null,
      deviceId,
      deviceName,
      email: null,
      token: null,
      tokenExpiresAt: null,
      lastSyncAt: null,
      vectorClock: {},
      conflictStrategy: 'last_write_wins' as const,
      serverUrl: ENV_CONFIG.apiBaseUrl,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
    });
  }
}

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
  
  // Handle legacy configs without retry tracking fields
  const syncConfig = config as SyncConfig;
  if (syncConfig.consecutiveFailures === undefined) {
    syncConfig.consecutiveFailures = 0;
  }
  if (syncConfig.lastFailureAt === undefined) {
    syncConfig.lastFailureAt = null;
  }
  if (syncConfig.lastFailureReason === undefined) {
    syncConfig.lastFailureReason = null;
  }
  if (syncConfig.nextRetryAt === undefined) {
    syncConfig.nextRetryAt = null;
  }
  
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
  const db = getDb();
  const current = await getSyncConfig();

  if (!current) {
    throw new Error('Sync config not initialized');
  }

  // Initialize crypto manager with password
  const crypto = getCryptoManager();
  await crypto.deriveKey(password, salt);

  // Update config
  await db.syncMetadata.put({
    ...current,
    enabled: true,
    userId,
    email,
    token,
    tokenExpiresAt: expiresAt,
    key: 'sync_config',
  });

  // Set token in API client
  const api = getApiClient(current.serverUrl);
  api.setToken(token);

  // FIX #1: Populate sync queue with existing tasks for initial sync
  // This happens ONCE when sync is enabled, not on every sync
  // Prevents infinite re-queue loop that was causing sync failures
  const taskCount = await db.tasks.count();
  if (taskCount > 0) {
    const queue = getSyncQueue();
    const populatedCount = await queue.populateFromExistingTasks();
    console.log(`[SYNC] Initial sync setup: queued ${populatedCount} existing tasks`);
  }

  // Start health monitor when sync is enabled
  // Note: The useSync hook also manages this, but we start it here for immediate monitoring
  const { getHealthMonitor } = await import('./health-monitor');
  const healthMonitor = getHealthMonitor();
  if (!healthMonitor.isActive()) {
    console.log('[SYNC] Starting health monitor (sync enabled)');
    healthMonitor.start();
  }
}

/**
 * Disable sync (logout)
 */
export async function disableSync(): Promise<void> {
  const db = getDb();
  const current = await getSyncConfig();

  if (!current) {
    return;
  }

  // Stop health monitor when sync is disabled
  const { getHealthMonitor } = await import('./health-monitor');
  const healthMonitor = getHealthMonitor();
  if (healthMonitor.isActive()) {
    console.log('[SYNC] Stopping health monitor (sync disabled)');
    healthMonitor.stop();
  }

  // Clear crypto manager
  const crypto = getCryptoManager();
  crypto.clear();

  // Clear API token
  const api = getApiClient(current.serverUrl);
  api.setToken(null);

  // Update config
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
    password: password,  // Server will hash with its salt
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
    passwordHash: password,  // Server will hash with its salt
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

  // Step 1: Clear sync queue (don't push local changes)
  await db.syncQueue.clear();
  console.log('[SYNC RESET] Cleared sync queue');

  // Step 2: Reset sync metadata to force full pull
  await db.syncMetadata.put({
    ...config,
    lastSyncAt: 0, // Set to 0 to pull all tasks from server
    vectorClock: {}, // Reset vector clock
    key: 'sync_config',
  });
  console.log('[SYNC RESET] Reset sync metadata (lastSyncAt=0, vectorClock={})');

  // Step 3: Clear all local tasks
  const taskCount = await db.tasks.count();
  await db.tasks.clear();
  console.log(`[SYNC RESET] Cleared ${taskCount} local tasks`);

  console.log('[SYNC RESET] Reset complete. Run sync() to pull all tasks from server.');
}
