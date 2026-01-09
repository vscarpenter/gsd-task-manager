/**
 * Encryption passphrase dialog helpers
 *
 * Extracted from components/sync/encryption-passphrase-dialog.tsx
 * for better code organization and maintainability.
 */

import { generateEncryptionSalt } from "@/lib/sync/crypto";
import { ENCRYPTION_CONFIG } from "@/lib/constants/sync";
import { createLogger } from "@/lib/logger";

const logger = createLogger('SYNC_CRYPTO');

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Validation & Error Handling Helpers
// ============================================================================

/** Validate passphrase meets requirements */
export function validatePassphrase(
  passphrase: string,
  confirmPassphrase: string,
  isNewUser: boolean
): ValidationResult {
  if (isNewUser && passphrase !== confirmPassphrase) {
    return { valid: false, error: "Passphrases do not match" };
  }
  if (passphrase.length < ENCRYPTION_CONFIG.PASSPHRASE_MIN_LENGTH) {
    return { valid: false, error: `Passphrase must be at least ${ENCRYPTION_CONFIG.PASSPHRASE_MIN_LENGTH} characters` };
  }
  return { valid: true };
}

/** Get appropriate error message for encryption setup failure */
export function getEncryptionErrorMessage(isNewUser: boolean): string {
  return isNewUser
    ? "Failed to create encryption passphrase"
    : "Incorrect passphrase";
}

// ============================================================================
// Salt Management Helpers
// ============================================================================

/** Parse salt from server string or generate new salt */
export function getOrCreateSalt(serverEncryptionSalt?: string | null): Uint8Array {
  if (serverEncryptionSalt) {
    const saltArray = serverEncryptionSalt.split(',').map(Number);
    return new Uint8Array(saltArray);
  }
  return generateEncryptionSalt();
}

/** Build API URL for encryption salt endpoint */
export function buildSaltApiUrl(): string {
  return window.location.hostname === 'localhost'
    ? 'http://localhost:8787/api/auth/encryption-salt'
    : `${window.location.origin}/api/auth/encryption-salt`;
}

/** Upload salt to server for new users */
export async function uploadSaltToServer(salt: Uint8Array): Promise<void> {
  const { getDb } = await import('@/lib/db');
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');

  if (config && config.key === 'sync_config' && config.token) {
    const saltString = Array.from(salt).join(',');
    await fetch(buildSaltApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
      body: JSON.stringify({ encryptionSalt: saltString }),
    });
  }
}

// ============================================================================
// Post-Setup Sync Helpers
// ============================================================================

/**
 * Reference type for timeout tracking (generic, not React-specific)
 */
export interface TimeoutRef {
  current: NodeJS.Timeout | null;
}

/** Queue existing tasks for sync and trigger auto-sync */
export async function queueAndTriggerSync(
  syncTimeoutRef: TimeoutRef
): Promise<void> {
  const { getSyncEngine } = await import('@/lib/sync/engine');
  const engine = getSyncEngine();
  const queuedCount = await engine.queueExistingTasks();

  if (queuedCount > 0) {
    logger.info('Queued existing tasks for initial sync', { queuedCount });

    const { toast } = await import('sonner');
    toast.success(`${queuedCount} task${queuedCount === 1 ? '' : 's'} queued for sync`);

    // Trigger automatic sync after dialog close animation
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const { getSyncCoordinator } = await import('@/lib/sync/sync-coordinator');
        const coordinator = getSyncCoordinator();
        await coordinator.requestSync('auto');
      } catch (err) {
        logger.error('Auto-sync after encryption setup failed', err instanceof Error ? err : undefined);
      }
    }, ENCRYPTION_CONFIG.AUTO_SYNC_DELAY_MS);
  }
}

/** Handle task queueing errors gracefully */
export async function handleQueueError(err: unknown): Promise<void> {
  logger.error('Failed to queue existing tasks', err instanceof Error ? err : undefined);
  const { toast } = await import('sonner');
  toast.error('Failed to queue tasks for sync. You can manually sync from Settings.', {
    duration: 5000,
  });
}
