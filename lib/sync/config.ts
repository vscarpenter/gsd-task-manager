/**
 * Sync configuration utilities
 * Helper functions for managing sync settings
 */

import { getDb } from '@/lib/db';
import { getCryptoManager } from './crypto';
import { getApiClient } from './api-client';
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

    // Use same-origin for deployed environments (CloudFront will proxy /api/* to worker)
    // For local development, connect directly to worker
    const serverUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:8787'
      : typeof window !== 'undefined'
      ? window.location.origin
      : 'https://gsd.vinny.dev';

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
      serverUrl
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
  return config as SyncConfig | null;
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
