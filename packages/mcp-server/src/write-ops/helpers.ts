/**
 * Helper functions for write operations
 * Includes ID generation, quadrant logic, encryption setup, and sync push
 */

import type { GsdConfig } from '../tools.js';
import type { SyncOperation } from './types.js';
import { getCryptoManager } from '../crypto.js';
import { getDeviceIdFromToken } from '../jwt.js';

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
    // Fetch salt and initialize (same as read operations)
    const response = await fetch(`${config.apiBaseUrl}/api/auth/encryption-salt`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    });

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
 */
export async function pushToSync(
  config: GsdConfig,
  operations: SyncOperation[]
): Promise<void> {
  const deviceId = getDeviceIdFromToken(config.authToken);

  const response = await fetch(`${config.apiBaseUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId,
      operations,
      clientVectorClock: {}, // Simplified: let server handle vector clock
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `❌ Failed to push task changes (${response.status})\n\n` +
        `Error: ${errorText}\n\n` +
        `Your changes were not saved to the server.`
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
}
