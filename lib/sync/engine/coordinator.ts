/**
 * Sync coordinator - orchestrates push/pull operations
 * Handles sync state, error handling, and metadata updates
 */

import { getCryptoManager } from '../crypto';
import { getApiClient } from '../api-client';
import { getTokenManager } from '../token-manager';
import { getRetryManager } from '../retry-manager';
import { getQueueOptimizer } from '../queue-optimizer';
import { createLogger } from '@/lib/logger';
import type { SyncResult, ConflictInfo, SyncConfig, VectorClock, RejectedOperation } from '../types';
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
} from '@/lib/sync/notifications';

const logger = createLogger('SYNC_ENGINE');

// ============================================================================
// Types for internal sync operations
// ============================================================================

interface SyncContext {
  crypto: ReturnType<typeof getCryptoManager>;
  api: ReturnType<typeof getApiClient>;
}

/** Rejected operation with enriched operation info for notifications */
interface RejectedOpNotification {
  taskId: string;
  reason: string;
  details: string;
  operation?: string;
}

/** Conflicted operation with enriched operation info for notifications */
interface ConflictedOpNotification {
  taskId: string;
  reason: string;
  operation?: string;
}

/** Result from push operation */
interface PushResult {
  accepted: string[];
  rejected: RejectedOperation[];
  conflicts: ConflictInfo[];
  serverVectorClock: VectorClock;
  rejectedOps?: RejectedOpNotification[];
  conflictedOps?: ConflictedOpNotification[];
}

/** Result from pull operation - tasks are encrypted blobs used for counting */
interface PullResult {
  tasks: { id: string }[];
  deletedTaskIds: string[];
  conflicts: ConflictInfo[];
  serverVectorClock: VectorClock;
}

interface SyncOperationResult {
  pushResult: PushResult;
  pullResult: PullResult;
  updatedConfig: NonNullable<Awaited<ReturnType<typeof getSyncConfig>>>;
}

// ============================================================================
// SyncEngine Class
// ============================================================================

export class SyncEngine {
  private isRunning = false;
  private tokenManager = getTokenManager();
  private retryManager = getRetryManager();
  private queueOptimizer = getQueueOptimizer();

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /** Check if sync can proceed based on backoff rules */
  private async checkBackoffStatus(priority: 'user' | 'auto', config: SyncConfig): Promise<SyncResult | null> {
    if (priority === 'auto') {
      const canSync = await this.retryManager.canSyncNow();
      if (!canSync) {
        const retryCount = await this.retryManager.getRetryCount();
        logger.debug('Automatic sync blocked by retry backoff', {
          consecutiveFailures: retryCount,
          nextRetryAt: config.nextRetryAt ? new Date(config.nextRetryAt).toISOString() : null,
        });
        return { status: 'error', error: 'Sync in backoff period. Please wait before retrying.' };
      }
    } else {
      logger.debug('User-triggered sync bypassing backoff delay');
    }
    return null;
  }

  /** Validate and prepare sync prerequisites: token, queue optimization, crypto */
  private async prepareSyncPrerequisites(config: SyncConfig): Promise<SyncContext> {
    const tokenValid = await this.tokenManager.ensureValidToken();
    if (!tokenValid) {
      throw new Error('Failed to refresh authentication token. Please sign in again.');
    }

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

    return { crypto, api };
  }

  /** Execute push and pull with automatic 401 retry */
  private async executeSyncOperations(
    config: SyncConfig,
    syncContext: SyncContext
  ): Promise<SyncOperationResult> {
    const { crypto, api } = syncContext;

    try {
      const pushResult = await pushLocalChanges(config, syncContext);
      const updatedConfig = await getSyncConfig();
      if (!updatedConfig || !updatedConfig.enabled) {
        throw new Error('Sync config lost or disabled after push');
      }

      const pullResult = await pullRemoteChanges(updatedConfig, syncContext);
      return { pushResult, pullResult, updatedConfig };
    } catch (error: unknown) {
      return this.handleAuthRetry(error, { crypto, api });
    }
  }

  /** Handle 401 errors with token refresh and retry */
  private async handleAuthRetry(
    error: unknown,
    syncContext: SyncContext
  ): Promise<SyncOperationResult> {
    const { crypto, api } = syncContext;

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('401') && !errorMessage.toLowerCase().includes('unauthorized')) {
      throw error;
    }

    logger.info('Received 401 error, attempting token refresh');
    const refreshed = await this.tokenManager.handleUnauthorized();

    if (!refreshed) {
      throw new Error('Authentication expired. Please sign in again.');
    }

    logger.info('Token refreshed, retrying sync operations');
    const refreshedConfig = await getSyncConfig();
    if (!refreshedConfig || !refreshedConfig.enabled) {
      throw new Error('Sync config lost after token refresh');
    }

    api.setToken(refreshedConfig.token);

    const pushResult = await pushLocalChanges(refreshedConfig, { crypto, api });
    const updatedConfig = await getSyncConfig();
    if (!updatedConfig || !updatedConfig.enabled) {
      throw new Error('Sync config lost or disabled after push');
    }

    const pullResult = await pullRemoteChanges(updatedConfig, { crypto, api });
    return { pushResult, pullResult, updatedConfig };
  }

  /** Resolve conflicts if needed based on strategy */
  private async resolveConflicts(pullResult: PullResult, config: SyncConfig): Promise<number> {
    if (pullResult.conflicts.length === 0 || config.conflictStrategy !== 'last_write_wins') {
      return 0;
    }

    const conflictLogger = createLogger('SYNC_CONFLICT');
    conflictLogger.info('Auto-resolving conflicts', {
      conflictCount: pullResult.conflicts.length,
      taskIds: pullResult.conflicts.map((c: ConflictInfo) => c.taskId),
      strategy: config.conflictStrategy,
    });

    const conflictsResolved = await autoResolveConflicts(pullResult.conflicts);

    conflictLogger.info('Conflicts resolved', {
      resolvedCount: conflictsResolved,
      totalConflicts: pullResult.conflicts.length,
    });

    return conflictsResolved;
  }

  /** Send user notifications about sync results */
  private notifySyncResults(pushResult: PushResult, result: SyncResult, priority: 'user' | 'auto'): void {
    if (priority !== 'user') return;

    if (pushResult.rejectedOps && pushResult.rejectedOps.length > 0) {
      notifyRejectedOperations(pushResult.rejectedOps, { enabled: true });
    }
    if (pushResult.conflictedOps && pushResult.conflictedOps.length > 0) {
      notifyConflicts(pushResult.conflictedOps, { enabled: true });
    }
    if (result.status === 'success') {
      notifySyncSuccess(result.pushedCount || 0, result.pulledCount || 0, result.conflictsResolved || 0, { enabled: true });
    }
  }

  /** Record sync to history (best-effort) */
  private async recordToHistory(
    result: SyncResult,
    deviceId: string,
    priority: 'user' | 'auto',
    syncDuration: number
  ): Promise<void> {
    try {
      await recordSyncSuccess(
        result.pushedCount || 0,
        result.pulledCount || 0,
        result.conflictsResolved || 0,
        deviceId,
        priority,
        syncDuration
      );
    } catch (historyError) {
      logger.error('Failed to record sync success to history', historyError instanceof Error ? historyError : new Error(String(historyError)));
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * One-button sync - push local changes, pull remote changes
   * @param priority - 'user' for manual sync (bypasses backoff), 'auto' for automatic sync (respects backoff)
   */
  async sync(priority: 'user' | 'auto' = 'auto'): Promise<SyncResult> {
    if (this.isRunning) {
      logger.debug('Sync already running, skipping');
      return { status: 'already_running' };
    }

    let pushResult: PushResult | null = null;
    let pullResult: PullResult | null = null;
    let syncStartTime = Date.now();

    try {
      this.isRunning = true;
      logger.info('Starting sync operation', { priority });

      // Phase 1: Validate config and check backoff
      const config = await getSyncConfig();
      if (!config || !config.enabled) {
        throw new Error('Sync not configured');
      }

      const backoffResult = await this.checkBackoffStatus(priority, config);
      if (backoffResult) return backoffResult;

      this.logConfigStatus(config);

      // Phase 2: Prepare prerequisites (token, queue optimization, crypto)
      const syncContext = await this.prepareSyncPrerequisites(config);
      syncStartTime = Date.now();
      this.logTimingWindow(config, syncStartTime);

      // Phase 3: Execute push/pull operations
      const operationResult = await this.executeSyncOperations(config, syncContext);
      pushResult = operationResult.pushResult;
      pullResult = operationResult.pullResult;
      const { updatedConfig } = operationResult;

      // Phase 4: Resolve conflicts
      const conflictsResolved = await this.resolveConflicts(pullResult, updatedConfig);
      const conflicts: ConflictInfo[] = [...pullResult.conflicts];

      // Phase 5: Finalize sync
      await updateSyncMetadata(updatedConfig, pullResult.serverVectorClock, syncStartTime);
      await this.retryManager.recordSuccess();

      const syncEndTime = Date.now();
      const syncDuration = syncEndTime - syncStartTime;

      const result = this.buildSyncResult(pushResult, pullResult, conflicts, conflictsResolved, updatedConfig, syncEndTime);
      this.logSyncComplete(result, syncDuration);

      // Phase 6: Notifications and history
      this.notifySyncResults(pushResult, result, priority);
      await this.recordToHistory(result, config.deviceId, priority, syncDuration);

      return result;
    } catch (error) {
      const config = await getSyncConfig();
      const deviceId = config?.deviceId || 'unknown';

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

  /** Log current config status for debugging */
  private logConfigStatus(config: SyncConfig): void {
    logger.debug('Sync config loaded', {
      deviceId: config.deviceId,
      userId: config.userId || undefined,
      lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : undefined,
      vectorClock: config.vectorClock,
      consecutiveFailures: config.consecutiveFailures,
    });
  }

  /** Log sync timing window for debugging */
  private logTimingWindow(config: SyncConfig, syncStartTime: number): void {
    logger.debug('Sync timing window captured', {
      syncStartTime,
      previousLastSyncAt: config.lastSyncAt,
      timeSinceLastSync: config.lastSyncAt ? `${syncStartTime - config.lastSyncAt}ms` : 'initial sync',
    });
  }

  /** Build the final SyncResult object */
  private buildSyncResult(
    pushResult: PushResult,
    pullResult: PullResult,
    conflicts: ConflictInfo[],
    conflictsResolved: number,
    config: SyncConfig,
    syncEndTime: number
  ): SyncResult {
    return {
      status: conflicts.length > 0 && config.conflictStrategy === 'manual' ? 'conflict' : 'success',
      pushedCount: pushResult.accepted.length,
      pulledCount: pullResult.tasks.length,
      conflictsResolved,
      conflicts: config.conflictStrategy === 'manual' ? conflicts : [],
      timestamp: syncEndTime,
    };
  }

  /** Log sync completion details */
  private logSyncComplete(result: SyncResult, syncDuration: number): void {
    logger.info('Sync operation complete', {
      status: result.status,
      pushedCount: result.pushedCount,
      pulledCount: result.pulledCount,
      conflictsResolved: result.conflictsResolved,
      conflictsRemaining: result.conflicts?.length || 0,
      syncDuration: `${syncDuration}ms`,
    });
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
