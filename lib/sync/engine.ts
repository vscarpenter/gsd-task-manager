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
      return { status: 'already_running' };
    }

    try {
      this.isRunning = true;

      // Get sync config
      const config = await this.getSyncConfig();
      if (!config || !config.enabled) {
        throw new Error('Sync not configured');
      }

      const crypto = getCryptoManager();
      if (!crypto.isInitialized()) {
        throw new Error('Encryption not initialized');
      }

      const api = getApiClient(config.serverUrl);
      api.setToken(config.token);

      // Check if we need to populate queue with existing tasks
      const queue = getSyncQueue();
      const pendingCount = await queue.getPendingCount();
      const db = getDb();
      const taskCount = await db.tasks.count();

      // If queue is empty but we have tasks, populate the queue
      if (pendingCount === 0 && taskCount > 0) {
        const count = await queue.populateFromExistingTasks();
        if (count > 0) {
          console.log(`Populated sync queue with ${count} existing tasks`);
        }
      }

      // Phase 1: Push local changes
      const pushResult = await this.pushLocalChanges(config, crypto, api);

      // Phase 2: Pull remote changes
      const pullResult = await this.pullRemoteChanges(config, crypto, api);

      // Phase 3: Handle conflicts
      const conflicts: ConflictInfo[] = [...pushResult.conflicts, ...pullResult.conflicts];
      let conflictsResolved = 0;

      if (conflicts.length > 0 && config.conflictStrategy === 'last_write_wins') {
        conflictsResolved = await this.autoResolveConflicts(conflicts);
      }

      // Phase 4: Update sync metadata
      await this.updateSyncMetadata(config, pullResult.serverVectorClock);

      return {
        status: conflicts.length > 0 && config.conflictStrategy === 'manual' ? 'conflict' : 'success',
        pushedCount: pushResult.accepted.length,
        pulledCount: pullResult.tasks.length,
        conflictsResolved,
        conflicts: config.conflictStrategy === 'manual' ? conflicts : [],
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Sync error:', error);
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

    if (pendingOps.length === 0) {
      return { accepted: [], rejected: [], conflicts: [], serverVectorClock: {} };
    }

    // Encrypt and prepare operations
    const operations: SyncOperation[] = [];

    for (const op of pendingOps) {
      try {
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
        console.error(`Failed to encrypt task ${op.taskId}:`, error);
        continue;
      }
    }

    // Push to server
    const response = await api.push({
      deviceId: config.deviceId,
      operations,
      clientVectorClock: config.vectorClock,
    });

    // Remove accepted operations from queue
    if (response.accepted.length > 0) {
      const acceptedIds = pendingOps
        .filter(op => response.accepted.includes(op.taskId))
        .map(op => op.id);
      await queue.dequeueBulk(acceptedIds);
    }

    // Handle rejections (increment retry count)
    for (const rejected of response.rejected) {
      const op = pendingOps.find(o => o.taskId === rejected.taskId);
      if (op) {
        await queue.incrementRetry(op.id);
      }
    }

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

    const response = await api.pull({
      deviceId: config.deviceId,
      lastVectorClock: config.vectorClock,
      sinceTimestamp: config.lastSyncAt || undefined,
      limit: 50,
    });

    const conflicts: ConflictInfo[] = [];

    // Decrypt and apply remote changes
    for (const encTask of response.tasks) {
      try {
        console.log(`Decrypting task ${encTask.id}...`);
        const decrypted = await crypto.decrypt(encTask.encryptedBlob, encTask.nonce);
        console.log(`Decrypted successfully, parsing...`);
        const task = taskRecordSchema.parse(JSON.parse(decrypted));
        console.log(`Parsed task ${task.id}: ${task.title}`);

        // Check for local conflicts
        const localTask = await db.tasks.get(task.id);

        if (localTask && !localTask.completed) {
          const comparison = compareVectorClocks(
            localTask.vectorClock || {},
            encTask.vectorClock
          );

          if (comparison === 'concurrent') {
            conflicts.push({
              taskId: task.id,
              local: localTask,
              remote: task,
              localClock: localTask.vectorClock || {},
              remoteClock: encTask.vectorClock,
            });
            continue;
          }
        }

        // No conflict or remote is newer, apply change
        console.log(`Saving task ${task.id} to IndexedDB...`);
        await db.tasks.put({
          ...task,
          vectorClock: encTask.vectorClock,
        });
        console.log(`Task ${task.id} saved successfully`);
      } catch (error) {
        console.error(`Failed to process task ${encTask.id}:`, error);
        console.error('Error details:', error);
      }
    }

    // Apply deletions
    if (response.deletedTaskIds.length > 0) {
      await db.tasks.bulkDelete(response.deletedTaskIds);
    }

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
  private async updateSyncMetadata(config: SyncConfig, serverClock: VectorClock): Promise<void> {
    const db = getDb();

    const mergedClock = mergeVectorClocks(config.vectorClock, serverClock);

    await db.syncMetadata.put({
      ...config,
      lastSyncAt: Date.now(),
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
