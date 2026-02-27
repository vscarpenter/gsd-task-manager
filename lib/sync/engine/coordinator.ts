/**
 * Sync coordinator - orchestrates push/pull operations against Supabase.
 * Handles sync state, error recovery, and metadata updates.
 *
 * Key changes from the Cloudflare Workers version:
 * - No token management / 401 retry loops (Supabase Auth handles JWTs internally)
 * - Supabase session check replaces manual token validation
 * - Start/stop RealtimeListener on enable/disable
 * - Uses timestamp-based LWW instead of vector clocks
 */

"use client";

import { getSupabaseClient } from '@/lib/supabase';
import { getCryptoManager } from '../crypto';
import { getRetryManager } from '../retry-manager';
import { getQueueOptimizer } from '../queue-optimizer';
import { createLogger } from '@/lib/logger';
import type { SyncResult, SyncConfig } from '../types';
import { pushLocalChanges } from './push-handler';
import { pullRemoteChanges } from './pull-handler';
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
  notifySyncSuccess,
} from '@/lib/sync/notifications';
import { startRealtimeListener, stopRealtimeListener } from '../realtime-listener';

const logger = createLogger('SYNC_ENGINE');

// ============================================================================
// SyncEngine Class
// ============================================================================

export class SyncEngine {
  private isRunning = false;
  private retryManager = getRetryManager();

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /** Check whether backoff rules allow syncing now */
  private async checkBackoffStatus(
    triggeredBy: 'user' | 'auto',
    config: SyncConfig
  ): Promise<SyncResult | null> {
    if (triggeredBy === 'auto') {
      const canSync = await this.retryManager.canSyncNow();
      if (!canSync) {
        logger.debug('Automatic sync blocked by retry backoff', {
          nextRetryAt: config.nextRetryAt
            ? new Date(config.nextRetryAt).toISOString()
            : null,
        });
        return { status: 'error', error: 'Sync in backoff period. Please wait before retrying.' };
      }
    } else {
      logger.debug('User-triggered sync bypassing backoff delay');
    }
    return null;
  }

  /** Verify that a valid Supabase auth session exists */
  private async ensureSupabaseSession(): Promise<void> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      throw new Error('Authentication expired. Please sign in again.');
    }
  }

  /** Consolidate the sync queue and verify crypto readiness */
  private async preparePrerequisites(): Promise<void> {
    const optimizer = getQueueOptimizer();
    const removedCount = await optimizer.consolidateAll();
    if (removedCount > 0) {
      logger.debug('Queue optimization complete', { removedCount });
    }

    const crypto = getCryptoManager();
    if (!crypto.isInitialized()) {
      throw new Error('Encryption not initialized');
    }
  }

  /** Build and return the final SyncResult */
  private buildSyncResult(
    pushAccepted: number,
    pulledCount: number,
    conflictsResolved: number,
    syncEndTime: number
  ): SyncResult {
    return {
      status: 'success',
      pushedCount: pushAccepted,
      pulledCount,
      conflictsResolved,
      conflicts: [],
      timestamp: syncEndTime,
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * One-button sync: push local changes, then pull remote changes.
   * @param triggeredBy - 'user' for manual sync (bypasses backoff), 'auto' for background sync
   */
  async sync(triggeredBy: 'user' | 'auto' = 'auto'): Promise<SyncResult> {
    if (this.isRunning) {
      logger.debug('Sync already running, skipping');
      return { status: 'already_running' };
    }

    let syncStartTime = Date.now();

    try {
      this.isRunning = true;
      logger.info('Starting sync operation', { triggeredBy });

      // Phase 1: Validate config
      const config = await getSyncConfig();
      if (!config || !config.enabled) {
        throw new Error('Sync not configured');
      }
      if (!config.userId) {
        throw new Error('Sync user ID not set');
      }

      const backoffResult = await this.checkBackoffStatus(triggeredBy, config);
      if (backoffResult) return backoffResult;

      logger.debug('Sync config loaded', {
        deviceId: config.deviceId,
        userId: config.userId,
        lastSyncAt: config.lastSyncAt
          ? new Date(config.lastSyncAt).toISOString()
          : null,
      });

      // Phase 2: Verify Supabase session and prepare prerequisites
      await this.ensureSupabaseSession();
      await this.preparePrerequisites();

      syncStartTime = Date.now();
      logger.debug('Sync timing window captured', {
        syncStartTime,
        previousLastSyncAt: config.lastSyncAt,
        timeSinceLastSync: config.lastSyncAt
          ? `${syncStartTime - config.lastSyncAt}ms`
          : 'initial sync',
      });

      // Phase 3: Push local pending changes
      const crypto = getCryptoManager();
      const pushResult = await pushLocalChanges({
        crypto,
        userId: config.userId,
        deviceId: config.deviceId,
      });

      // Phase 4: Pull remote changes
      const lastSyncIso = config.lastSyncAt
        ? new Date(config.lastSyncAt).toISOString()
        : null;

      const pullResult = await pullRemoteChanges(lastSyncIso, {
        crypto,
        userId: config.userId,
      });

      // Phase 5: Update metadata and record success
      await updateSyncMetadata(config, syncStartTime);
      await this.retryManager.recordSuccess();

      const syncEndTime = Date.now();
      const syncDuration = syncEndTime - syncStartTime;

      const totalConflicts = pushResult.conflictCount + pullResult.conflictCount;
      const result = this.buildSyncResult(
        pushResult.acceptedCount,
        pullResult.pulledCount,
        totalConflicts,
        syncEndTime
      );

      logger.info('Sync operation complete', {
        status: result.status,
        pushedCount: result.pushedCount,
        pulledCount: result.pulledCount,
        deletedCount: pullResult.deletedCount,
        conflictsResolved: result.conflictsResolved,
        syncDuration: `${syncDuration}ms`,
      });

      // Phase 6: Notifications and history
      if (triggeredBy === 'user') {
        notifySyncSuccess(
          result.pushedCount || 0,
          result.pulledCount || 0,
          result.conflictsResolved || 0,
          { enabled: true }
        );
      }

      await this.recordToHistory(result, config.deviceId, triggeredBy, syncDuration);

      return result;
    } catch (error) {
      const config = await getSyncConfig();
      const deviceId = config?.deviceId || 'unknown';

      return await handleSyncError(
        error,
        this.retryManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );
    } finally {
      this.isRunning = false;
    }
  }

  /** Record sync to history (best-effort, never throws) */
  private async recordToHistory(
    result: SyncResult,
    deviceId: string,
    triggeredBy: 'user' | 'auto',
    syncDuration: number
  ): Promise<void> {
    try {
      await recordSyncSuccess(
        result.pushedCount || 0,
        result.pulledCount || 0,
        result.conflictsResolved || 0,
        deviceId,
        triggeredBy,
        syncDuration
      );
    } catch (historyError) {
      logger.error(
        'Failed to record sync success to history',
        historyError instanceof Error ? historyError : new Error(String(historyError))
      );
    }
  }

  /** Check if sync is enabled */
  async isEnabled(): Promise<boolean> {
    return isSyncEnabled();
  }

  /** Get current sync status */
  async getStatus() {
    return getSyncStatus(this.isRunning);
  }

  /** Update sync configuration */
  async updateConfig(updates: Partial<SyncConfig>): Promise<void> {
    return updateConfigMetadata(updates);
  }

  /** Queue all existing tasks for initial sync */
  async queueExistingTasks(): Promise<number> {
    return queueAllExistingTasks();
  }

  /** Start Realtime listener for cross-device push notifications */
  startRealtime(userId: string, deviceId: string): void {
    startRealtimeListener(userId, deviceId);
  }

  /** Stop Realtime listener */
  stopRealtime(): void {
    stopRealtimeListener();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let syncEngineInstance: SyncEngine | null = null;

/** Get or create singleton SyncEngine instance */
export function getSyncEngine(): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine();
  }
  return syncEngineInstance;
}
