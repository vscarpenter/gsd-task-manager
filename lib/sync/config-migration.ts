/**
 * Sync configuration migration utilities
 * Handles legacy config updates and initialization
 */

import { getDb } from '@/lib/db';
import { ENV_CONFIG } from '@/lib/env-config';
import type { SyncConfig } from './types';

/**
 * Generate a default device name based on user agent
 */
function getDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return 'Desktop';
  }

  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';

  return 'Desktop';
}

/**
 * Create initial sync configuration
 */
async function createInitialConfig(): Promise<void> {
  const db = getDb();
  const deviceId = crypto.randomUUID();
  const deviceName = getDefaultDeviceName();

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

/**
 * Initialize sync configuration if it doesn't exist
 */
export async function ensureSyncConfigInitialized(): Promise<void> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');

  if (!config) {
    await createInitialConfig();
  }
}

/**
 * Migrate legacy config to include retry tracking fields
 */
export function migrateLegacyConfig(config: SyncConfig): SyncConfig {
  const migratedConfig = { ...config };

  if (migratedConfig.consecutiveFailures === undefined) {
    migratedConfig.consecutiveFailures = 0;
  }

  if (migratedConfig.lastFailureAt === undefined) {
    migratedConfig.lastFailureAt = null;
  }

  if (migratedConfig.lastFailureReason === undefined) {
    migratedConfig.lastFailureReason = null;
  }

  if (migratedConfig.nextRetryAt === undefined) {
    migratedConfig.nextRetryAt = null;
  }

  return migratedConfig;
}
