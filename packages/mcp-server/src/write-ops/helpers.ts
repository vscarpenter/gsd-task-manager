/**
 * Helper functions for write operations
 * Includes ID generation, quadrant logic, encryption setup, and sync push
 */

import type { GsdConfig } from '../tools.js';
import type { SyncOperation } from './types.js';
import { getCryptoManager } from '../crypto.js';
import { getDeviceIdFromToken } from '../jwt.js';
import { fetchWithRetry, DEFAULT_RETRY_CONFIG } from '../api/retry.js';
import { getTaskCache } from '../cache.js';

/**
 * Generate unique ID for new tasks
 */
export function generateTaskId(): string {
  // Use crypto.randomUUID() for secure random IDs
  const uuid = crypto.randomUUID();
  // Remove hyphens to match frontend format
  return uuid.replace(/-/g, '');
}

/**
 * Derive quadrant from urgent/important flags
 */
export function deriveQuadrant(urgent: boolean, important: boolean): string {
  if (urgent && important) return 'urgent-important';
  if (!urgent && important) return 'not-urgent-important';
  if (urgent && !important) return 'urgent-not-important';
  return 'not-urgent-not-important';
}

/**
 * Initialize encryption for write operations
 * Includes retry logic for fetching encryption salt
 */
export async function ensureEncryption(config: GsdConfig): Promise<void> {
  if (!config.encryptionPassphrase) {
    throw new Error(
      `❌ Encryption passphrase required for write operations\n\n` +
        `Write operations require encryption to be enabled.\n` +
        `Add GSD_ENCRYPTION_PASSPHRASE to your Claude Desktop config.\n\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }

  const cryptoManager = getCryptoManager();
  if (!cryptoManager.isInitialized()) {
    // Fetch salt with retry logic
    const response = await fetchWithRetry(
      () =>
        fetch(`${config.apiBaseUrl}/api/auth/encryption-salt`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.authToken}`,
            'Content-Type': 'application/json',
          },
        }),
      DEFAULT_RETRY_CONFIG
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch encryption salt: ${response.status}`);
    }

    const data = (await response.json()) as { encryptionSalt: string };
    if (!data.encryptionSalt) {
      throw new Error('Encryption not set up for this account');
    }

    await cryptoManager.deriveKey(config.encryptionPassphrase, data.encryptionSalt);
  }
}

/**
 * Push encrypted task data to sync API
 * Includes retry logic for transient failures
 */
export async function pushToSync(
  config: GsdConfig,
  operations: SyncOperation[]
): Promise<void> {
  const deviceId = getDeviceIdFromToken(config.authToken);
  const payload = JSON.stringify({
    deviceId,
    operations,
    clientVectorClock: {}, // Simplified: let server handle vector clock
  });

  const response = await fetchWithRetry(
    () =>
      fetch(`${config.apiBaseUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      }),
    DEFAULT_RETRY_CONFIG
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `❌ Failed to push task changes (${response.status})\n\n` +
        `Error: ${errorText}\n\n` +
        `Your changes were not saved to the server.\n` +
        `Retried ${DEFAULT_RETRY_CONFIG.maxRetries} times before giving up.`
    );
  }

  // Check response for rejected operations and conflicts
  const result = (await response.json()) as {
    accepted?: string[];
    rejected?: Array<{ taskId: string; reason: string; details: string }>;
    conflicts?: Array<unknown>;
    serverVectorClock?: Record<string, number>;
  };

  // Check for rejected operations
  if (result.rejected && result.rejected.length > 0) {
    const rejectionDetails = result.rejected
      .map((r) => `  - Task ${r.taskId}: ${r.reason} - ${r.details}`)
      .join('\n');
    throw new Error(
      `❌ Worker rejected ${result.rejected.length} operation(s)\n\n` +
        `${rejectionDetails}\n\n` +
        `Your changes were not saved to the server.`
    );
  }

  // Check for conflicts
  if (result.conflicts && result.conflicts.length > 0) {
    console.warn(`⚠️  Warning: ${result.conflicts.length} conflict(s) detected`);
    console.warn('Last-write-wins strategy applied - your changes took precedence');
  }

  // Invalidate cache after successful write
  const cache = getTaskCache();
  cache.invalidate();
}
