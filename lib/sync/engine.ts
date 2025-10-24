/**
 * Sync engine - orchestrates push/pull operations
 * Handles E2E encryption, conflict detection, and offline queue
 */

import { getDb } from '@/lib/db';
import { taskRecordSchema } from '@/lib/schema';
import { getCryptoManager } from './crypto';
import { getApiClient } from './api-client';
import { getSyncQueue } from './queue';
import {
  compareVectorClocks,
  mergeVectorClocks,
} from './vector-clock';
import type {
  SyncResult,
  SyncConfig,
  ConflictInfo,
  SyncOperation,
  VectorClock,
} from './types';

export class SyncEngine {
  private isRunning = false;

  /**
   * One-button sync - push local changes, pull remote changes
   */
  async sync(): Promise<SyncResult> {
    if (this.isRunning) {
      console.log('[SYNC DEBUG] Sync already running, skipping');
      return { status: 'already_running' };
    }

    try {
      this.isRunning = true;

      console.log('[SYNC DEBUG] ========================================');
      console.log('[SYNC DEBUG] Starting sync operation');
      console.log('[SYNC DEBUG] Timestamp:', new Date().toISOString());
      console.log('[SYNC DEBUG] ========================================');

      // Get sync config
      const config = await this.getSyncConfig();
      if (!config || !config.enabled) {
        throw new Error('Sync not configured');
      }

      console.log('[SYNC DEBUG] Sync config:', {
        deviceId: config.deviceId,
        userId: config.userId,
        lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
        vectorClock: config.vectorClock,
      });

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
      const syncStartTime = Date.now();

      // Phase 1: Push local changes
      const pushResult = await this.pushLocalChanges(config, crypto, api);

      // FIX #5: Reload config after push to get updated vector clock
      const updatedConfig = await this.getSyncConfig();
      if (!updatedConfig || !updatedConfig.enabled) {
        throw new Error('Sync config lost or disabled after push');
      }

      // Phase 2: Pull remote changes with updated config
      const pullResult = await this.pullRemoteChanges(updatedConfig, crypto, api);

      // Phase 3: Handle conflicts
      const conflicts: ConflictInfo[] = [...pushResult.conflicts, ...pullResult.conflicts];
      let conflictsResolved = 0;

      if (conflicts.length > 0 && config.conflictStrategy === 'last_write_wins') {
        conflictsResolved = await this.autoResolveConflicts(conflicts);
      }

      // Phase 4: Update sync metadata
      // FIX #2: Pass sync start time to prevent race condition window
      await this.updateSyncMetadata(updatedConfig, pullResult.serverVectorClock, syncStartTime);

      const result: SyncResult = {
        status: conflicts.length > 0 && updatedConfig.conflictStrategy === 'manual' ? 'conflict' : 'success',
        pushedCount: pushResult.accepted.length,
        pulledCount: pullResult.tasks.length,
        conflictsResolved,
        conflicts: updatedConfig.conflictStrategy === 'manual' ? conflicts : [],
        timestamp: Date.now(),
      };

      console.log('[SYNC DEBUG] ========================================');
      console.log('[SYNC DEBUG] Sync operation complete');
      console.log('[SYNC DEBUG] Result:', {
        status: result.status,
        pushedCount: result.pushedCount,
        pulledCount: result.pulledCount,
        conflictsResolved: result.conflictsResolved,
        conflictsRemaining: result.conflicts?.length || 0,
      });
      console.log('[SYNC DEBUG] ========================================');

      return result;
    } catch (error) {
      console.error('[SYNC ERROR] Sync failed:', error);
      console.error('[SYNC ERROR] Error details:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Push local pending changes to server
   */
  private async pushLocalChanges(
    config: SyncConfig,
    crypto: ReturnType<typeof getCryptoManager>,
    api: ReturnType<typeof getApiClient>
  ) {
    const queue = getSyncQueue();
    const pendingOps = await queue.getPending();

    // FIX #6: Debug logging for push operation
    console.log('[SYNC DEBUG] Starting push phase');
    console.log('[SYNC DEBUG] Pending operations:', pendingOps.length);

    if (pendingOps.length === 0) {
      console.log('[SYNC DEBUG] No pending operations, skipping push');
      return { accepted: [], rejected: [], conflicts: [], serverVectorClock: {} };
    }

    // Encrypt and prepare operations
    const operations: SyncOperation[] = [];

    for (const op of pendingOps) {
      try {
        console.log(`[SYNC DEBUG] Preparing ${op.operation} operation for task ${op.taskId}`);
        console.log(`[SYNC DEBUG] Operation vector clock:`, op.vectorClock);

        if (op.operation === 'delete') {
          operations.push({
            type: 'delete',
            taskId: op.taskId,
            vectorClock: op.vectorClock,
          });
        } else if (op.payload) {
          const plaintext = JSON.stringify(op.payload);
          const { ciphertext, nonce } = await crypto.encrypt(plaintext);
          const checksum = await crypto.hash(plaintext);

          operations.push({
            type: op.operation,
            taskId: op.taskId,
            encryptedBlob: ciphertext,
            nonce,
            vectorClock: op.vectorClock,
            checksum,
          });
        }
      } catch (error) {
        console.error(`[SYNC ERROR] Failed to encrypt task ${op.taskId}:`, error);
        continue;
      }
    }

    console.log(`[SYNC DEBUG] Pushing ${operations.length} operations to server`);

    // Push to server
    const response = await api.push({
      deviceId: config.deviceId,
      operations,
      clientVectorClock: config.vectorClock,
    });

    console.log('[SYNC DEBUG] Push response:', {
      accepted: response.accepted.length,
      rejected: response.rejected.length,
      conflicts: response.conflicts.length,
      serverVectorClock: response.serverVectorClock,
    });

    // Remove accepted operations from queue
    if (response.accepted.length > 0) {
      const acceptedIds = pendingOps
        .filter(op => response.accepted.includes(op.taskId))
        .map(op => op.id);
      console.log(`[SYNC DEBUG] Removing ${acceptedIds.length} accepted operations from queue`);
      await queue.dequeueBulk(acceptedIds);
    }

    // Handle rejections (increment retry count)
    for (const rejected of response.rejected) {
      console.log(`[SYNC DEBUG] Operation rejected:`, rejected);
      const op = pendingOps.find(o => o.taskId === rejected.taskId);
      if (op) {
        await queue.incrementRetry(op.id);
      }
    }

    console.log('[SYNC DEBUG] Push phase complete');

    return response;
  }

  /**
   * Pull remote changes from server
   */
  private async pullRemoteChanges(
    config: SyncConfig,
    crypto: ReturnType<typeof getCryptoManager>,
    api: ReturnType<typeof getApiClient>
  ) {
    const db = getDb();

    // FIX #6: Debug logging for pull operation
    console.log('[SYNC DEBUG] Starting pull phase');
    console.log('[SYNC DEBUG] Pull params:', {
      deviceId: config.deviceId,
      lastVectorClock: config.vectorClock,
      sinceTimestamp: config.lastSyncAt,
      sinceDate: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
    });

    const response = await api.pull({
      deviceId: config.deviceId,
      lastVectorClock: config.vectorClock,
      sinceTimestamp: config.lastSyncAt || undefined,
      limit: 50,
    });

    console.log('[SYNC DEBUG] Pull response:', {
      tasksCount: response.tasks.length,
      deletedCount: response.deletedTaskIds.length,
      conflictsCount: response.conflicts.length,
      serverVectorClock: response.serverVectorClock,
    });

    const conflicts: ConflictInfo[] = [];

    // Decrypt and apply remote changes
    for (const encTask of response.tasks) {
      try {
        console.log(`[SYNC DEBUG] Processing task ${encTask.id}`);
        console.log(`[SYNC DEBUG] Remote vector clock:`, encTask.vectorClock);

        const decrypted = await crypto.decrypt(encTask.encryptedBlob, encTask.nonce);
        const task = taskRecordSchema.parse(JSON.parse(decrypted));
        console.log(`[SYNC DEBUG] Decrypted task: ${task.title} (updated: ${task.updatedAt})`);

        // Check for local conflicts
        const localTask = await db.tasks.get(task.id);

        if (localTask && !localTask.completed) {
          console.log(`[SYNC DEBUG] Found local task: ${localTask.title} (updated: ${localTask.updatedAt})`);
          console.log(`[SYNC DEBUG] Local vector clock:`, localTask.vectorClock);

          // FIX #3 (SECURITY): Check if we can safely skip conflict detection
          // Only skip if we KNOW the task was NOT modified locally (i.e., lastSyncAt exists AND task is older)
          // If lastSyncAt is null (reinstall/reset), we MUST check vector clocks to prevent data loss
          const taskNotModifiedSinceLastSync = config.lastSyncAt &&
            new Date(localTask.updatedAt).getTime() <= config.lastSyncAt;

          console.log(`[SYNC DEBUG] Task not modified since last sync: ${taskNotModifiedSinceLastSync}`);
          console.log(`[SYNC DEBUG] Will check vector clocks: ${!taskNotModifiedSinceLastSync}`);

          // If we don't know when last sync was (null), OR task was modified after sync,
          // check vector clocks to prevent data loss
          if (!taskNotModifiedSinceLastSync) {
            const comparison = compareVectorClocks(
              localTask.vectorClock || {},
              encTask.vectorClock
            );

            console.log(`[SYNC DEBUG] Vector clock comparison: ${comparison}`);

            if (comparison === 'concurrent') {
              console.log(`[SYNC DEBUG] CONFLICT DETECTED - Adding to conflicts list`);
              conflicts.push({
                taskId: task.id,
                local: localTask,
                remote: task,
                localClock: localTask.vectorClock || {},
                remoteClock: encTask.vectorClock,
              });
              continue;
            }
          } else {
            console.log(`[SYNC DEBUG] Skipping conflict check - task confirmed unmodified since last sync`);
          }
        } else if (localTask) {
          console.log(`[SYNC DEBUG] Local task exists but is completed, applying remote`);
        } else {
          console.log(`[SYNC DEBUG] No local task found, creating new`);
        }

        // No conflict or remote is newer, apply change
        // FIX #2: Merge vector clocks instead of replacing them
        const existingClock = localTask?.vectorClock || {};
        const mergedClock = mergeVectorClocks(existingClock, encTask.vectorClock);

        console.log(`[SYNC DEBUG] Merged vector clock:`, mergedClock);
        console.log(`[SYNC DEBUG] Saving task ${task.id} to IndexedDB`);

        await db.tasks.put({
          ...task,
          vectorClock: mergedClock,
        });

        console.log(`[SYNC DEBUG] Task ${task.id} saved successfully`);
      } catch (error) {
        console.error(`[SYNC ERROR] Failed to process task ${encTask.id}:`, error);
        console.error('[SYNC ERROR] Error details:', error);
      }
    }

    // Apply deletions
    if (response.deletedTaskIds.length > 0) {
      console.log(`[SYNC DEBUG] Deleting ${response.deletedTaskIds.length} tasks:`, response.deletedTaskIds);
      await db.tasks.bulkDelete(response.deletedTaskIds);
    }

    console.log('[SYNC DEBUG] Pull phase complete:', {
      tasksProcessed: response.tasks.length,
      tasksDeleted: response.deletedTaskIds.length,
      conflicts: conflicts.length,
    });

    return {
      tasks: response.tasks,
      deletedTaskIds: response.deletedTaskIds,
      serverVectorClock: response.serverVectorClock,
      conflicts,
    };
  }

  /**
   * Auto-resolve conflicts using last-write-wins strategy
   */
  private async autoResolveConflicts(conflicts: ConflictInfo[]): Promise<number> {
    const db = getDb();
    let resolved = 0;

    for (const conflict of conflicts) {
      try {
        // Compare updatedAt timestamps
        const localTime = new Date(conflict.local.updatedAt).getTime();
        const remoteTime = new Date(conflict.remote.updatedAt).getTime();

        const winner = remoteTime > localTime ? conflict.remote : conflict.local;

        await db.tasks.put({
          ...winner,
          vectorClock: mergeVectorClocks(conflict.localClock, conflict.remoteClock),
        });

        resolved++;
      } catch (error) {
        console.error(`Failed to resolve conflict for task ${conflict.taskId}:`, error);
      }
    }

    return resolved;
  }

  /**
   * Update sync metadata after successful sync
   */
  private async updateSyncMetadata(config: SyncConfig, serverClock: VectorClock, syncStartTime: number): Promise<void> {
    const db = getDb();

    const mergedClock = mergeVectorClocks(config.vectorClock, serverClock);

    // FIX #2: Use sync START time instead of END time to prevent race condition
    // Tasks updated after sync starts will be caught in the next sync
    // FIX #4: Subtract 1ms to work properly with >= in server queries
    // This prevents re-fetching the same tasks on next sync
    await db.syncMetadata.put({
      ...config,
      lastSyncAt: syncStartTime - 1,
      vectorClock: mergedClock,
      key: 'sync_config',
    });
  }

  /**
   * Get sync configuration from IndexedDB
   */
  private async getSyncConfig(): Promise<SyncConfig | null> {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config');
    return config as SyncConfig | null;
  }

  /**
   * Update sync configuration
   */
  async updateConfig(updates: Partial<SyncConfig>): Promise<void> {
    const db = getDb();
    const current = await this.getSyncConfig();

    if (!current) {
      throw new Error('Sync config not initialized');
    }

    await db.syncMetadata.put({
      ...current,
      ...updates,
      key: 'sync_config',
    });
  }

  /**
   * Check if sync is enabled
   */
  async isEnabled(): Promise<boolean> {
    const config = await this.getSyncConfig();
    return config?.enabled || false;
  }

  /**
   * Get current sync status
   */
  async getStatus() {
    const config = await this.getSyncConfig();
    const queue = getSyncQueue();
    const pendingCount = await queue.getPendingCount();

    return {
      enabled: config?.enabled || false,
      lastSyncAt: config?.lastSyncAt || null,
      pendingCount,
      isRunning: this.isRunning,
    };
  }
}

// Singleton instance
let engineInstance: SyncEngine | null = null;

/**
 * Get or create sync engine instance
 */
export function getSyncEngine(): SyncEngine {
  if (!engineInstance) {
    engineInstance = new SyncEngine();
  }
  return engineInstance;
}
