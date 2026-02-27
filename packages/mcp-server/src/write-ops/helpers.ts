/**
 * Helper functions for write operations
 * Includes ID generation, quadrant logic, encryption setup, and sync push
 */

import type { GsdConfig } from '../types.js';
import type { SyncOperation } from './types.js';
import { getCryptoManager } from '../crypto.js';
import { getSupabaseClient, resolveUserId } from '../api/client.js';
import { initializeEncryption } from '../encryption/manager.js';
import { getTaskCache } from '../cache.js';

/**
 * Generate unique ID for new tasks
 */
export function generateTaskId(): string {
  const uuid = crypto.randomUUID();
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

  await initializeEncryption(config);
}

/**
 * Push encrypted task data to Supabase
 */
export async function pushToSync(
  config: GsdConfig,
  operations: SyncOperation[]
): Promise<void> {
  const userId = await resolveUserId(config);
  const supabase = getSupabaseClient(config);
  const cryptoManager = getCryptoManager();

  for (const op of operations) {
    if (op.type === 'delete') {
      // Soft-delete the task
      const { error } = await supabase
        .from('encrypted_tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', op.taskId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(
          `❌ Failed to delete task ${op.taskId}\n\n` +
            `Error: ${error.message}`
        );
      }
      continue;
    }

    // Encrypt task data
    const taskJson = JSON.stringify(op.data);
    const { ciphertext, nonce } = await cryptoManager.encrypt(taskJson);
    const checksum = await computeChecksum(taskJson);

    // Upsert encrypted task
    const { error } = await supabase
      .from('encrypted_tasks')
      .upsert({
        id: op.taskId,
        user_id: userId,
        encrypted_blob: ciphertext,
        nonce,
        version: 1,
        deleted_at: null,
        updated_at: new Date().toISOString(),
        last_modified_device: 'mcp-server',
        checksum,
      }, {
        onConflict: 'id,user_id',
      });

    if (error) {
      throw new Error(
        `❌ Failed to push task ${op.taskId}\n\n` +
          `Error: ${error.message}\n\n` +
          `Your changes were not saved to the server.`
      );
    }
  }

  // Invalidate cache after successful write
  const cache = getTaskCache();
  cache.invalidate();
}

/**
 * Compute simple checksum for integrity verification
 */
async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
