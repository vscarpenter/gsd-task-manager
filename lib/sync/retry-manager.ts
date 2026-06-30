/**
 * Retry Manager - handles exponential backoff for failed sync operations
 * Tracks consecutive failures and calculates appropriate retry delays
 */

import { getSyncConfig, updateSyncConfig } from './config';
import { createLogger } from '@/lib/logger';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { sanitizeSyncError } from './error-categorizer';

const logger = createLogger('SYNC_RETRY');

const { MAX_RETRIES, RETRY_DELAYS, MAX_RETRY_AFTER_MS } = SYNC_CONFIG;

/** Optional hints a caller can attach to a recorded failure. */
export interface RecordFailureOptions {
  /** Server-provided Retry-After delay (ms); overrides exponential backoff. */
  retryAfterMs?: number | null;
}

export class RetryManager {
  /**
   * Record a sync failure and update retry metadata
   */
  async recordFailure(error: Error, options?: RecordFailureOptions): Promise<void> {
    const config = await getSyncConfig();
    if (!config) {
      logger.error('Cannot record failure: sync config not found');
      return;
    }

    const consecutiveFailures = config.consecutiveFailures + 1;
    const retryAfterMs = options?.retryAfterMs ?? null;
    const nextRetryDelay = this.resolveRetryDelay(consecutiveFailures, retryAfterMs);
    const nextRetryAt = Date.now() + nextRetryDelay;
    // PocketBase 4xx bodies can echo submitted field values (task titles), so
    // persist only a stable code — the raw message stays in the diagnostic log.
    const failureReason = sanitizeSyncError(error);

    logger.info('Recording sync failure', {
      consecutiveFailures,
      failureReason,
      errorMessage: error.message,
      nextRetryDelay: `${nextRetryDelay / 1000}s`,
      honoredRetryAfter: retryAfterMs !== null,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
    });

    await updateSyncConfig({
      consecutiveFailures,
      lastFailureAt: Date.now(),
      lastFailureReason: failureReason,
      nextRetryAt,
    });
  }

  /**
   * Pick the backoff delay. A server-provided Retry-After wins over the
   * exponential schedule (honor the backend's explicit pacing), but is clamped
   * to MAX_RETRY_AFTER_MS so a bogus/hostile header can't freeze sync.
   */
  private resolveRetryDelay(consecutiveFailures: number, retryAfterMs: number | null): number {
    if (retryAfterMs !== null && retryAfterMs >= 0) {
      return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
    }
    return this.getNextRetryDelay(consecutiveFailures);
  }

  /**
   * Record a sync success and reset failure counter
   */
  async recordSuccess(): Promise<void> {
    const config = await getSyncConfig();
    if (!config) {
      logger.error('Cannot record success: sync config not found');
      return;
    }

    // Only update if there were previous failures
    if (config.consecutiveFailures > 0) {
      logger.info('Recording sync success, resetting failure counter');

      await updateSyncConfig({
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });
    }
  }

  /**
   * Get the next retry delay based on consecutive failures
   * Uses exponential backoff: 5s, 10s, 30s, 60s, 300s
   */
  getNextRetryDelay(failureCount?: number): number {
    const failures = failureCount ?? 0;

    // Cap at max delay
    const index = Math.min(failures - 1, RETRY_DELAYS.length - 1);
    return index >= 0 ? RETRY_DELAYS[index] : RETRY_DELAYS[0];
  }

  /**
   * Check if should retry (not exceeded max retries)
   */
  async shouldRetry(): Promise<boolean> {
    const config = await getSyncConfig();
    if (!config) {
      return false;
    }

    const shouldRetry = config.consecutiveFailures < MAX_RETRIES;
    
    logger.debug('Should retry check', {
      consecutiveFailures: config.consecutiveFailures,
      maxRetries: MAX_RETRIES,
      shouldRetry,
    });

    return shouldRetry;
  }

  /**
   * Get current retry count from config
   */
  async getRetryCount(): Promise<number> {
    const config = await getSyncConfig();
    return config?.consecutiveFailures ?? 0;
  }

  /**
   * Check if sync can run now (nextRetryAt has passed)
   */
  async canSyncNow(): Promise<boolean> {
    const config = await getSyncConfig();
    if (!config) {
      return false;
    }

    // If no retry scheduled, can sync
    if (!config.nextRetryAt) {
      return true;
    }

    // Check if retry time has passed
    const now = Date.now();
    const canSync = now >= config.nextRetryAt;

    if (!canSync) {
      const waitTime = Math.ceil((config.nextRetryAt - now) / 1000);
      logger.debug('Cannot sync yet, must wait', {
        waitTimeSeconds: waitTime,
        nextRetryAt: new Date(config.nextRetryAt).toISOString(),
      });
    }

    return canSync;
  }
}

// Singleton instance
let retryManagerInstance: RetryManager | null = null;

/**
 * Get or create retry manager instance
 */
export function getRetryManager(): RetryManager {
  if (!retryManagerInstance) {
    retryManagerInstance = new RetryManager();
  }
  return retryManagerInstance;
}
