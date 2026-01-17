/**
 * Error handler - handles sync errors with categorized recovery strategies
 * Manages transient, auth, and permanent errors with appropriate retry logic
 */

import { getSyncQueue } from '../queue';
import { categorizeError } from '../error-categorizer';
import { createLogger } from '@/lib/logger';
import type { RetryManager } from '../retry-manager';
import type { TokenManager } from '../token-manager';
import type { SyncResult } from '../types';
import { recordSyncError } from '@/lib/sync-history';
import { notifySyncError } from '@/lib/sync/notifications';

const logger = createLogger('SYNC_ERROR');

/** Partial push result for error logging context */
interface PartialPushResult {
  accepted: string[];
}

/** Partial pull result for error logging context */
interface PartialPullResult {
  tasks: unknown[];
}

/**
 * Handle sync error with categorized recovery strategy
 */
export async function handleSyncError(
  error: unknown,
  pushResult: PartialPushResult | null,
  pullResult: PartialPullResult | null,
  retryManager: RetryManager,
  tokenManager: TokenManager,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  syncStartTime: number
): Promise<SyncResult> {
  const syncError = error instanceof Error ? error : new Error('Sync failed');
  const errorCategory = categorizeError(syncError);

  // Get operation counts for logging
  const queue = getSyncQueue();
  const pendingCount = await queue.getPendingCount();

  // Log error with context
  logger.error(`Sync operation failed: ${syncError.message}`, syncError, {
    category: errorCategory,
    pushed: pushResult?.accepted.length || 0,
    pulled: pullResult?.tasks.length || 0,
    pendingCount,
  });

  // Record sync error to history (best-effort, don't block retry logic if history write fails)
  const syncEndTime = Date.now();
  const syncDuration = syncEndTime - syncStartTime;
  try {
    await recordSyncError(syncError.message, deviceId, triggeredBy, syncDuration);
  } catch (historyError) {
    logger.error(
      'Failed to record sync error to history',
      historyError instanceof Error ? historyError : new Error(String(historyError))
    );
  }

  // Handle transient errors: log, record failure, schedule retry
  if (errorCategory === 'transient') {
    await retryManager.recordFailure(syncError);

    const retryCount = await retryManager.getRetryCount();
    const shouldRetry = await retryManager.shouldRetry();

    logger.error(`Transient error - will retry with backoff: ${syncError.message}`, syncError, {
      consecutiveFailures: retryCount,
      shouldRetry,
      nextRetryDelay: shouldRetry ? `${retryManager.getNextRetryDelay(retryCount) / 1000}s` : 'max retries exceeded',
    });

    if (shouldRetry) {
      const delay = retryManager.getNextRetryDelay(retryCount);
      const errorMsg = `Network error. Will retry automatically in ${Math.round(delay / 1000)}s.`;

      // Notify user for manual syncs
      if (triggeredBy === 'user') {
        notifySyncError(errorMsg, false, { enabled: true });
      }

      return {
        status: 'error',
        error: errorMsg,
      };
    } else {
      const errorMsg = 'Sync failed after multiple retries. Please check your connection and try again.';

      // Notify user for manual syncs (permanent failure)
      if (triggeredBy === 'user') {
        notifySyncError(errorMsg, true, { enabled: true });
      }

      return {
        status: 'error',
        error: errorMsg,
      };
    }
  }

  // Handle auth errors: log, attempt token refresh, retry once
  if (errorCategory === 'auth') {
    logger.info('Authentication error - attempting token refresh');

    const refreshed = await tokenManager.handleUnauthorized();

    if (refreshed) {
      logger.info('Token refreshed successfully - user should retry sync');
      const errorMsg = 'Authentication refreshed. Please try syncing again.';

      // Notify user for manual syncs
      if (triggeredBy === 'user') {
        notifySyncError(errorMsg, false, { enabled: true });
      }

      return {
        status: 'error',
        error: errorMsg,
      };
    } else {
      logger.warn('Token refresh failed - user must re-authenticate');
      const errorMsg = 'Authentication expired. Please sign in again.';

      // Notify user (permanent auth failure)
      if (triggeredBy === 'user') {
        notifySyncError(errorMsg, true, { enabled: true });
      }

      return {
        status: 'error',
        error: errorMsg,
      };
    }
  }

  // Handle permanent errors: log, notify user, don't retry
  if (errorCategory === 'permanent') {
    logger.error(`Permanent error - will not retry: ${syncError.message}`, syncError, {
      category: 'permanent',
      errorType: syncError.constructor.name,
    });

    const errorMsg = `Sync error: ${syncError.message}. Please check your data and try again.`;

    // Notify user (permanent error)
    if (triggeredBy === 'user') {
      notifySyncError(errorMsg, true, { enabled: true });
    }

    // Don't record failure for permanent errors (no retry needed)
    return {
      status: 'error',
      error: errorMsg,
    };
  }

  // Fallback for uncategorized errors (treat as transient)
  logger.warn('Uncategorized error - treating as transient');

  await retryManager.recordFailure(syncError);

  return {
    status: 'error',
    error: syncError.message,
  };
}
