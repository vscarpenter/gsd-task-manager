/**
 * Sync coordinator - orchestrates push/pull operations
 * Handles sync state, error handling, and metadata updates
 */

import { getCryptoManager } from '../crypto';
import { getApiClient } from '../api-client';
import { getTokenManager } from '../token-manager';
import { getRetryManager } from '../retry-manager';
import { getQueueOptimizer } from '../queue-optimizer';
import { categorizeError, type ErrorCategory } from '../error-categorizer';
import { createLogger } from '@/lib/logger';
import type { SyncResult, ConflictInfo } from '../types';
import { pushLocalChanges } from './push-handler';
import { pullRemoteChanges } from './pull-handler';
import { autoResolveConflicts } from './conflict-resolver';
import { handleSyncError } from './error-handler';
import {
  getSyncConfig,
  updateSyncMetadata,
  updateConfig as updateConfigMetadata,
  isEnabled as isSyncEnabled,
  getStatus as getSyncStatus,
  queueExistingTasks as queueAllExistingTasks,
} from './metadata-manager';
import { recordSyncSuccess } from '@/lib/sync-history';
import {
  notifyRejectedOperations,
  notifyConflicts,
  notifySyncSuccess,
  notifySyncError,
} from '@/lib/sync/notifications';

const logger = createLogger('SYNC_ENGINE');

export class SyncEngine {
  private isRunning = false;
  private tokenManager = getTokenManager();
  private retryManager = getRetryManager();
  private queueOptimizer = getQueueOptimizer();

  /**
   * One-button sync - push local changes, pull remote changes
   * @param priority - 'user' for manual sync (bypasses backoff), 'auto' for automatic sync (respects backoff)
   */
  async sync(priority: 'user' | 'auto' = 'auto'): Promise<SyncResult> {
    if (this.isRunning) {
      logger.debug('Sync already running, skipping');
      return { status: 'already_running' };
    }

    // Declare at function level so they're accessible in catch block
    let pushResult: any = null;
    let pullResult: any = null;
    let syncStartTime = Date.now(); // Declare here for error handler access

    try {
      this.isRunning = true;

      logger.info('Starting sync operation', { priority });

      // Get sync config
      const config = await getSyncConfig();
      if (!config || !config.enabled) {
        throw new Error('Sync not configured');
      }

      // Check if we can sync now (enforce backoff only for automatic syncs)
      // User-triggered syncs bypass the backoff delay
      if (priority === 'auto') {
        const canSync = await this.retryManager.canSyncNow();
        if (!canSync) {
          const retryCount = await this.retryManager.getRetryCount();
          logger.debug('Automatic sync blocked by retry backoff', {
            consecutiveFailures: retryCount,
            nextRetryAt: config.nextRetryAt ? new Date(config.nextRetryAt).toISOString() : null,
          });
          return {
            status: 'error',
            error: 'Sync in backoff period. Please wait before retrying.',
          };
        }
      } else {
        logger.debug('User-triggered sync bypassing backoff delay');
      }

      logger.debug('Sync config loaded', {
        deviceId: config.deviceId,
        userId: config.userId || undefined,
        lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : undefined,
        vectorClock: config.vectorClock,
        consecutiveFailures: config.consecutiveFailures,
      });

      // Ensure token is valid before sync operations
      const tokenValid = await this.tokenManager.ensureValidToken();
      if (!tokenValid) {
        throw new Error('Failed to refresh authentication token. Please sign in again.');
      }

      // Optimize queue before sync to reduce redundant operations
      const removedCount = await this.queueOptimizer.consolidateAll();
      if (removedCount > 0) {
        logger.debug('Queue optimization complete', { removedCount });
      }

      const crypto = getCryptoManager();
      if (!crypto.isInitialized()) {
        throw new Error('Encryption not initialized');
      }

      const api = getApiClient(config.serverUrl);
      api.setToken(config.token);

      // FIX #1: Removed queue auto-population to prevent infinite re-sync loop
      // Queue population now happens ONCE in enableSync() when sync is first enabled
      // This prevents already-synced tasks from being re-queued on every sync

      // Capture sync start time BEFORE push/pull operations
      // This timestamp will be used as lastSyncAt to prevent race conditions
      syncStartTime = Date.now();

      logger.debug('Sync timing window captured', {
        syncStartTime,
        previousLastSyncAt: config.lastSyncAt,
        timeSinceLastSync: config.lastSyncAt ? `${syncStartTime - config.lastSyncAt}ms` : 'initial sync',
      });

      // Create context object for push/pull handlers
      const syncContext = {
        crypto,
        api,
      };

      // Execute sync operations with 401 error handling
      let updatedConfig;

      try {
        // Phase 1: Push local changes
        pushResult = await pushLocalChanges(config, syncContext);

        // FIX #5: Reload config after push to get updated vector clock
        updatedConfig = await getSyncConfig();
        if (!updatedConfig || !updatedConfig.enabled) {
          throw new Error('Sync config lost or disabled after push');
        }

        // Phase 2: Pull remote changes with updated config
        pullResult = await pullRemoteChanges(updatedConfig, syncContext);
      } catch (error: any) {
        // Handle 401 Unauthorized errors with automatic token refresh
        if (error.message?.includes('401') || error.message?.toLowerCase().includes('unauthorized')) {
          logger.info('Received 401 error, attempting token refresh');

          const refreshed = await this.tokenManager.handleUnauthorized();

          if (refreshed) {
            logger.info('Token refreshed, retrying sync operations');

            // Reload config to get updated token
            const refreshedConfig = await getSyncConfig();
            if (!refreshedConfig || !refreshedConfig.enabled) {
              throw new Error('Sync config lost after token refresh');
            }

            // Update API client with new token
            api.setToken(refreshedConfig.token);

            // Retry sync operations with new token
            pushResult = await pushLocalChanges(refreshedConfig, { crypto, api });

            updatedConfig = await getSyncConfig();
            if (!updatedConfig || !updatedConfig.enabled) {
              throw new Error('Sync config lost or disabled after push');
            }

            pullResult = await pullRemoteChanges(updatedConfig, { crypto, api });
          } else {
            throw new Error('Authentication expired. Please sign in again.');
          }
        } else {
          // Re-throw non-401 errors
          throw error;
        }
      }

      // Phase 3: Handle conflicts
      // NOTE: Only auto-resolve locally-detected conflicts from pull phase
      // Server-returned conflicts (from push) lack task data (local/remote) and cannot be auto-resolved
      // Those conflicts are informational only and will be handled on next pull
      let conflictsResolved = 0;

      if (pullResult.conflicts.length > 0 && config.conflictStrategy === 'last_write_wins') {
        // Log conflict details before resolution
        const conflictLogger = createLogger('SYNC_CONFLICT');
        conflictLogger.info('Auto-resolving conflicts', {
          conflictCount: pullResult.conflicts.length,
          taskIds: pullResult.conflicts.map((c: ConflictInfo) => c.taskId),
          strategy: config.conflictStrategy,
        });

        conflictsResolved = await autoResolveConflicts(pullResult.conflicts);

        conflictLogger.info('Conflicts resolved', {
          resolvedCount: conflictsResolved,
          totalConflicts: pullResult.conflicts.length,
        });
      }

      // Combine all conflicts for reporting (but only locally-detected ones are auto-resolved)
      const conflicts: ConflictInfo[] = [...pullResult.conflicts];

      // Phase 4: Update sync metadata
      // Pass sync start time to prevent race condition window
      await updateSyncMetadata(updatedConfig, pullResult.serverVectorClock, syncStartTime);

      // Record successful sync (resets retry counter)
      await this.retryManager.recordSuccess();

      const syncEndTime = Date.now();
      const syncDuration = syncEndTime - syncStartTime;

      const result: SyncResult = {
        status: conflicts.length > 0 && updatedConfig.conflictStrategy === 'manual' ? 'conflict' : 'success',
        pushedCount: pushResult.accepted.length,
        pulledCount: pullResult.tasks.length,
        conflictsResolved,
        conflicts: updatedConfig.conflictStrategy === 'manual' ? conflicts : [],
        timestamp: syncEndTime,
      };

      logger.info('Sync operation complete', {
        status: result.status,
        pushedCount: result.pushedCount,
        pulledCount: result.pulledCount,
        conflictsResolved: result.conflictsResolved,
        conflictsRemaining: result.conflicts?.length || 0,
        syncDuration: `${syncDuration}ms`,
      });

      // ENHANCEMENT: Show user-friendly notifications for sync results
      // Only show notifications for user-triggered syncs to avoid notification spam
      const shouldNotify = priority === 'user';

      // Notify about rejected operations
      if (shouldNotify && pushResult.rejectedOps && pushResult.rejectedOps.length > 0) {
        notifyRejectedOperations(pushResult.rejectedOps, { enabled: true });
      }

      // Notify about conflicts
      if (shouldNotify && pushResult.conflictedOps && pushResult.conflictedOps.length > 0) {
        notifyConflicts(pushResult.conflictedOps, { enabled: true });
      }

      // Notify about successful sync (if there were changes)
      if (shouldNotify && result.status === 'success') {
        notifySyncSuccess(
          result.pushedCount || 0,
          result.pulledCount || 0,
          result.conflictsResolved || 0,
          { enabled: true }
        );
      }

      // Record successful sync to history (best-effort, don't fail sync if history write fails)
      try {
        await recordSyncSuccess(
          result.pushedCount || 0,
          result.pulledCount || 0,
          result.conflictsResolved || 0,
          config.deviceId,
          priority,
          syncDuration
        );
      } catch (historyError) {
        logger.error(
          'Failed to record sync success to history',
          historyError instanceof Error ? historyError : new Error(String(historyError))
        );
      }

      return result;
    } catch (error) {
      // Get config for deviceId (may not be available if error occurred early)
      const config = await getSyncConfig();
      const deviceId = config?.deviceId || 'unknown';

      // Delegate error handling to error handler
      return await handleSyncError(
        error,
        pushResult,
        pullResult,
        this.retryManager,
        this.tokenManager,
        deviceId,
        priority,
        syncStartTime
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update sync configuration
   */
  async updateConfig(updates: Partial<import('../types').SyncConfig>): Promise<void> {
    return updateConfigMetadata(updates);
  }

  /**
   * Check if sync is enabled
   */
  async isEnabled(): Promise<boolean> {
    return isSyncEnabled();
  }

  /**
   * Get current sync status
   */
  async getStatus() {
    return getSyncStatus(this.isRunning);
  }

  /**
   * Queue all existing tasks for initial sync
   * Called when sync is first enabled or re-enabled
   * @returns Number of tasks queued
   */
  async queueExistingTasks(): Promise<number> {
    return queueAllExistingTasks();
  }
}
