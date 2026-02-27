/**
 * Error handler - handles sync errors with categorized recovery strategies
 * Manages transient, auth, and permanent errors with appropriate retry logic.
 * No token management — Supabase Auth handles JWT refresh internally.
 */

import { getSyncQueue } from '../queue';
import { categorizeError } from '../error-categorizer';
import { createLogger } from '@/lib/logger';
import type { RetryManager } from '../retry-manager';
import type { SyncResult } from '../types';
import { recordSyncError } from '@/lib/sync-history';
import { notifySyncError } from '@/lib/sync/notifications';

const logger = createLogger('SYNC_ERROR');

/**
 * Handle sync error with categorized recovery strategy.
 *
 * - Transient errors: record failure and schedule retry with exponential backoff.
 * - Auth errors: prompt user to sign in again (Supabase handles token refresh).
 * - Permanent errors: log and surface to user without retry.
 */
export async function handleSyncError(
  error: unknown,
  retryManager: RetryManager,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  syncStartTime: number
): Promise<SyncResult> {
  const syncError = error instanceof Error ? error : new Error('Sync failed');
  const errorCategory = categorizeError(syncError);

  const queue = getSyncQueue();
  const pendingCount = await queue.getPendingCount();

  logger.error(`Sync operation failed: ${syncError.message}`, syncError, {
    category: errorCategory,
    pendingCount,
  });

  // Record sync error to history (best-effort)
  const syncDuration = Date.now() - syncStartTime;
  try {
    await recordSyncError(syncError.message, deviceId, triggeredBy, syncDuration);
  } catch (historyError) {
    logger.error(
      'Failed to record sync error to history',
      historyError instanceof Error ? historyError : new Error(String(historyError))
    );
  }

  if (errorCategory === 'transient') {
    return handleTransientError(syncError, retryManager, triggeredBy);
  }

  if (errorCategory === 'auth') {
    return handleAuthError(triggeredBy);
  }

  if (errorCategory === 'permanent') {
    return handlePermanentError(syncError, triggeredBy);
  }

  // Fallback for uncategorized errors (treat as transient)
  logger.warn('Uncategorized error — treating as transient');
  await retryManager.recordFailure(syncError);

  return { status: 'error', error: syncError.message };
}

/**
 * Handle transient errors: record failure and optionally schedule retry
 */
async function handleTransientError(
  syncError: Error,
  retryManager: RetryManager,
  triggeredBy: 'user' | 'auto'
): Promise<SyncResult> {
  await retryManager.recordFailure(syncError);

  const retryCount = await retryManager.getRetryCount();
  const shouldRetry = await retryManager.shouldRetry();

  logger.error(`Transient error — will retry with backoff: ${syncError.message}`, syncError, {
    consecutiveFailures: retryCount,
    shouldRetry,
  });

  if (shouldRetry) {
    const delay = retryManager.getNextRetryDelay(retryCount);
    const errorMsg = `Network error. Will retry automatically in ${Math.round(delay / 1000)}s.`;

    if (triggeredBy === 'user') {
      notifySyncError(errorMsg, false, { enabled: true });
    }

    return { status: 'error', error: errorMsg };
  }

  const errorMsg = 'Sync failed after multiple retries. Please check your connection and try again.';

  if (triggeredBy === 'user') {
    notifySyncError(errorMsg, true, { enabled: true });
  }

  return { status: 'error', error: errorMsg };
}

/**
 * Handle auth errors: prompt user to re-authenticate.
 * No token refresh — Supabase Auth handles JWT lifecycle internally.
 */
function handleAuthError(triggeredBy: 'user' | 'auto'): SyncResult {
  logger.warn('Authentication error — user must sign in again');
  const errorMsg = 'Authentication expired. Please sign in again.';

  if (triggeredBy === 'user') {
    notifySyncError(errorMsg, true, { enabled: true });
  }

  return { status: 'error', error: errorMsg };
}

/**
 * Handle permanent errors: log, notify, no retry
 */
function handlePermanentError(
  syncError: Error,
  triggeredBy: 'user' | 'auto'
): SyncResult {
  logger.error(`Permanent error — will not retry: ${syncError.message}`, syncError, {
    category: 'permanent',
  });

  const errorMsg = `Sync error: ${syncError.message}. Please check your data and try again.`;

  if (triggeredBy === 'user') {
    notifySyncError(errorMsg, true, { enabled: true });
  }

  return { status: 'error', error: errorMsg };
}
