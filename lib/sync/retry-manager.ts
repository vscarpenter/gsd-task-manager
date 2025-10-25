/**
 * Retry Manager - handles exponential backoff for failed sync operations
 * Tracks consecutive failures and calculates appropriate retry delays
 */

import { getSyncConfig, updateSyncConfig } from './config';

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAYS = [5000, 10000, 30000, 60000, 300000]; // 5s, 10s, 30s, 60s, 300s in milliseconds

export class RetryManager {
  /**
   * Record a sync failure and update retry metadata
   */
  async recordFailure(error: Error): Promise<void> {
    const config = await getSyncConfig();
    if (!config) {
      console.error('[RETRY] Cannot record failure: sync config not found');
      return;
    }

    const consecutiveFailures = config.consecutiveFailures + 1;
    const nextRetryDelay = this.getNextRetryDelay(consecutiveFailures);
    const nextRetryAt = Date.now() + nextRetryDelay;

    console.log('[RETRY] Recording sync failure:', {
      consecutiveFailures,
      errorMessage: error.message,
      nextRetryDelay: `${nextRetryDelay / 1000}s`,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
    });

    await updateSyncConfig({
      consecutiveFailures,
      lastFailureAt: Date.now(),
      lastFailureReason: error.message,
      nextRetryAt,
    });
  }

  /**
   * Record a sync success and reset failure counter
   */
  async recordSuccess(): Promise<void> {
    const config = await getSyncConfig();
    if (!config) {
      console.error('[RETRY] Cannot record success: sync config not found');
      return;
    }

    // Only update if there were previous failures
    if (config.consecutiveFailures > 0) {
      console.log('[RETRY] Recording sync success, resetting failure counter');

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
    const config = failureCount !== undefined ? { consecutiveFailures: failureCount } : null;
    const failures = config?.consecutiveFailures ?? 0;

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
    
    console.log('[RETRY] Should retry check:', {
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
      console.log('[RETRY] Cannot sync yet, must wait:', {
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
