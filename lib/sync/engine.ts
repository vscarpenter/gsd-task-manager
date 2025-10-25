/**
 * Sync engine - orchestrates push/pull operations
 * Handles E2E encryption, conflict detection, and offline queue
 */

import { getDb } from '@/lib/db';
import { taskRecordSchema } from '@/lib/schema';
import { getCryptoManager } from './crypto';
import { getApiClient } from './api-client';
import { getSyncQueue } from './queue';
import { getTokenManager } from './token-manager';
import { getRetryManager } from './retry-manager';
import { getQueueOptimizer } from './queue-optimizer';
import {
  compareVectorClocks,
  mergeVectorClocks,
} from './vector-clock';
import {
  categorizeError,
  type ErrorCategory,
} from './error-categorizer';
import type {
  SyncResult,
  SyncConfig,
  ConflictInfo,
  SyncOperation,
  VectorClock,
} from './types';

export class SyncEngine {
  private isRunning = false;
  private tokenManager = getTokenManager();
  private retryManager = getRetryManager();
  private queueOptimizer = getQueueOptimizer();
  private debugMode = false; // Can be enabled for verbose logging

  /**
   * Log structured error with context
   */
  private logError(
    message: string,
    error: Error,
    context?: {
      phase?: 'push' | 'pull' | 'conflict_resolution' | 'metadata_update';
      category?: ErrorCategory;
      operationCounts?: { pushed?: number; pulled?: number; failed?: number };
      conflictDetails?: { taskIds: string[]; vectorClocks: any[] };
      requestDetails?: { url?: string; method?: string; status?: number };
    }
  ): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message,
      errorType: error.constructor.name,
      errorMessage: error.message,
      category: context?.category || categorizeError(error),
      phase: context?.phase,
      operationCounts: context?.operationCounts,
      conflictDetails: context?.conflictDetails,
      // Sanitize sensitive data from request details
      requestDetails: context?.requestDetails
        ? {
            url: context.requestDetails.url?.replace(/token=[^&]+/, 'token=***'),
            method: context.requestDetails.method,
            status: context.requestDetails.status,
          }
        : undefined,
      stack: this.debugMode ? error.stack : undefined,
    };

    console.error('[SYNC ERROR]', errorLog);
  }

  /**
   * Log verbose debug information (only when debug mode enabled)
   */
  private logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log('[SYNC DEBUG VERBOSE]', {
        timestamp: new Date().toISOString(),
        message,
        data,
      });
    }
  }

  /**
   * One-button sync - push local changes, pull remote changes
   * @param priority - 'user' for manual sync (bypasses backoff), 'auto' for automatic sync (respects backoff)
   */
  async sync(priority: 'user' | 'auto' = 'auto'): Promise<SyncResult> {
    if (this.isRunning) {
      console.log('[SYNC DEBUG] Sync already running, skipping');
      return { status: 'already_running' };
    }

    // Declare at function level so they're accessible in catch block
    let pushResult: any = null;
    let pullResult: any = null;

    try {
      this.isRunning = true;

      console.log('[SYNC DEBUG] ========================================');
      console.log('[SYNC DEBUG] Starting sync operation');
      console.log('[SYNC DEBUG] Priority:', priority);
      console.log('[SYNC DEBUG] Timestamp:', new Date().toISOString());
      console.log('[SYNC DEBUG] ========================================');

      // Get sync config
      const config = await this.getSyncConfig();
      if (!config || !config.enabled) {
        throw new Error('Sync not configured');
      }

      // Check if we can sync now (enforce backoff only for automatic syncs)
      // User-triggered syncs bypass the backoff delay
      if (priority === 'auto') {
        const canSync = await this.retryManager.canSyncNow();
        if (!canSync) {
          const retryCount = await this.retryManager.getRetryCount();
          console.log('[SYNC DEBUG] Automatic sync blocked by retry backoff:', {
            consecutiveFailures: retryCount,
            nextRetryAt: config.nextRetryAt ? new Date(config.nextRetryAt).toISOString() : null,
          });
          return {
            status: 'error',
            error: 'Sync in backoff period. Please wait before retrying.',
          };
        }
      } else {
        console.log('[SYNC DEBUG] User-triggered sync bypassing backoff delay');
      }

      console.log('[SYNC DEBUG] Sync config:', {
        deviceId: config.deviceId,
        userId: config.userId,
        lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
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
        console.log(`[SYNC DEBUG] Queue optimization removed ${removedCount} redundant operations`);
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
      const syncStartTime = Date.now();
      
      console.log('[SYNC DEBUG] Sync timing window:', {
        syncStartTime,
        syncStartDate: new Date(syncStartTime).toISOString(),
        previousLastSyncAt: config.lastSyncAt,
        previousLastSyncDate: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
        timeSinceLastSync: config.lastSyncAt ? `${syncStartTime - config.lastSyncAt}ms` : 'initial sync',
      });

      // Execute sync operations with 401 error handling
      let updatedConfig;

      try {
        // Phase 1: Push local changes
        pushResult = await this.pushLocalChanges(config, crypto, api);

        // FIX #5: Reload config after push to get updated vector clock
        updatedConfig = await this.getSyncConfig();
        if (!updatedConfig || !updatedConfig.enabled) {
          throw new Error('Sync config lost or disabled after push');
        }

        // Phase 2: Pull remote changes with updated config
        pullResult = await this.pullRemoteChanges(updatedConfig, crypto, api);
      } catch (error: any) {
        // Handle 401 Unauthorized errors with automatic token refresh
        if (error.message?.includes('401') || error.message?.toLowerCase().includes('unauthorized')) {
          console.log('[SYNC] Received 401 error, attempting token refresh...');
          
          const refreshed = await this.tokenManager.handleUnauthorized();
          
          if (refreshed) {
            console.log('[SYNC] Token refreshed, retrying sync operations...');
            
            // Reload config to get updated token
            const refreshedConfig = await this.getSyncConfig();
            if (!refreshedConfig || !refreshedConfig.enabled) {
              throw new Error('Sync config lost after token refresh');
            }
            
            // Update API client with new token
            api.setToken(refreshedConfig.token);
            
            // Retry sync operations with new token
            pushResult = await this.pushLocalChanges(refreshedConfig, crypto, api);
            
            updatedConfig = await this.getSyncConfig();
            if (!updatedConfig || !updatedConfig.enabled) {
              throw new Error('Sync config lost or disabled after push');
            }
            
            pullResult = await this.pullRemoteChanges(updatedConfig, crypto, api);
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
        console.log('[SYNC CONFLICT]', {
          timestamp: new Date().toISOString(),
          conflictCount: pullResult.conflicts.length,
          taskIds: pullResult.conflicts.map((c: ConflictInfo) => c.taskId),
          vectorClocks: pullResult.conflicts.map((c: ConflictInfo) => ({
            taskId: c.taskId,
            local: c.localClock,
            remote: c.remoteClock,
          })),
          strategy: config.conflictStrategy,
        });
        
        conflictsResolved = await this.autoResolveConflicts(pullResult.conflicts);
        
        console.log('[SYNC CONFLICT] Resolved conflicts:', {
          timestamp: new Date().toISOString(),
          resolvedCount: conflictsResolved,
          totalConflicts: pullResult.conflicts.length,
        });
      }

      // Combine all conflicts for reporting (but only locally-detected ones are auto-resolved)
      const conflicts: ConflictInfo[] = [...pullResult.conflicts];

      // Phase 4: Update sync metadata
      // Pass sync start time to prevent race condition window
      await this.updateSyncMetadata(updatedConfig, pullResult.serverVectorClock, syncStartTime);

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

      console.log('[SYNC DEBUG] ========================================');
      console.log('[SYNC DEBUG] Sync operation complete');
      console.log('[SYNC DEBUG] Result:', {
        status: result.status,
        pushedCount: result.pushedCount,
        pulledCount: result.pulledCount,
        conflictsResolved: result.conflictsResolved,
        conflictsRemaining: result.conflicts?.length || 0,
      });
      console.log('[SYNC DEBUG] Sync timing summary:', {
        syncStartTime,
        syncEndTime,
        syncDuration: `${syncDuration}ms`,
        raceConditionWindow: `Tasks modified between ${new Date(syncStartTime).toISOString()} and ${new Date(syncEndTime).toISOString()} will be captured in next sync`,
      });
      console.log('[SYNC DEBUG] ========================================');

      return result;
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error('Sync failed');
      const errorCategory = categorizeError(syncError);
      
      // Get operation counts for logging
      const queue = getSyncQueue();
      const pendingCount = await queue.getPendingCount();
      
      // Structured error logging with context
      this.logError('Sync operation failed', syncError, {
        category: errorCategory,
        operationCounts: {
          pushed: pushResult?.accepted.length || 0,
          pulled: pullResult?.tasks.length || 0,
          failed: pendingCount,
        },
      });
      
      // Handle error based on category
      console.log('[SYNC ERROR] Error handling decision:', {
        timestamp: new Date().toISOString(),
        errorCategory,
        errorMessage: syncError.message,
      });
      
      // Handle transient errors: log, record failure, schedule retry
      if (errorCategory === 'transient') {
        await this.retryManager.recordFailure(syncError);
        
        const retryCount = await this.retryManager.getRetryCount();
        const shouldRetry = await this.retryManager.shouldRetry();
        
        console.log('[SYNC ERROR] Transient error - will retry with backoff:', {
          timestamp: new Date().toISOString(),
          consecutiveFailures: retryCount,
          shouldRetry,
          nextRetryDelay: shouldRetry ? `${this.retryManager.getNextRetryDelay(retryCount) / 1000}s` : 'max retries exceeded',
        });
        
        if (shouldRetry) {
          const delay = this.retryManager.getNextRetryDelay(retryCount);
          return {
            status: 'error',
            error: `Network error. Will retry automatically in ${Math.round(delay / 1000)}s.`,
          };
        } else {
          return {
            status: 'error',
            error: 'Sync failed after multiple retries. Please check your connection and try again.',
          };
        }
      }
      
      // Handle auth errors: log, attempt token refresh, retry once
      if (errorCategory === 'auth') {
        console.log('[SYNC ERROR] Authentication error - attempting token refresh:', {
          timestamp: new Date().toISOString(),
        });
        
        const refreshed = await this.tokenManager.handleUnauthorized();
        
        if (refreshed) {
          console.log('[SYNC ERROR] Token refreshed successfully - user should retry sync:', {
            timestamp: new Date().toISOString(),
          });
          
          return {
            status: 'error',
            error: 'Authentication refreshed. Please try syncing again.',
          };
        } else {
          console.log('[SYNC ERROR] Token refresh failed - user must re-authenticate:', {
            timestamp: new Date().toISOString(),
          });
          
          return {
            status: 'error',
            error: 'Authentication expired. Please sign in again.',
          };
        }
      }
      
      // Handle permanent errors: log, notify user, don't retry
      if (errorCategory === 'permanent') {
        console.log('[SYNC ERROR] Permanent error - will not retry:', {
          timestamp: new Date().toISOString(),
          errorMessage: syncError.message,
        });
        
        // Don't record failure for permanent errors (no retry needed)
        return {
          status: 'error',
          error: `Sync error: ${syncError.message}. Please check your data and try again.`,
        };
      }
      
      // Fallback for uncategorized errors (treat as transient)
      console.log('[SYNC ERROR] Uncategorized error - treating as transient:', {
        timestamp: new Date().toISOString(),
      });
      
      await this.retryManager.recordFailure(syncError);
      
      return {
        status: 'error',
        error: syncError.message,
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
    
    if (pendingOps.length > 0) {
      console.log('[SYNC DEBUG] Pending operation details:');
      for (const op of pendingOps) {
        console.log(`  - ${op.operation} ${op.taskId} (queue ID: ${op.id})`);
      }
    }

    if (pendingOps.length === 0) {
      console.log('[SYNC DEBUG] No pending operations, skipping push');
      return { accepted: [], rejected: [], conflicts: [], serverVectorClock: {} };
    }

    // Encrypt and prepare operations
    // Track mapping between taskId and queue item IDs for proper cleanup
    const operations: SyncOperation[] = [];
    const taskIdToQueueIds = new Map<string, string[]>();

    for (const op of pendingOps) {
      try {
        console.log(`[SYNC DEBUG] Preparing ${op.operation} operation for task ${op.taskId}`);
        console.log(`[SYNC DEBUG] Operation vector clock:`, op.vectorClock);

        // Track which queue items correspond to this taskId
        if (!taskIdToQueueIds.has(op.taskId)) {
          taskIdToQueueIds.set(op.taskId, []);
        }
        taskIdToQueueIds.get(op.taskId)!.push(op.id);

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
        const encryptError = error instanceof Error ? error : new Error('Encryption failed');
        this.logError(`Failed to encrypt task ${op.taskId}`, encryptError, {
          phase: 'push',
        });
        continue;
      }
    }

    console.log(`[SYNC DEBUG] Pushing ${operations.length} operations to server`);

    // Push to server
    let response;
    try {
      response = await api.push({
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
    } catch (error) {
      const pushError = error instanceof Error ? error : new Error('Push failed');
      this.logError('Push operation failed', pushError, {
        phase: 'push',
        operationCounts: {
          pushed: 0,
          failed: operations.length,
        },
        requestDetails: {
          url: config.serverUrl,
          method: 'POST',
        },
      });
      throw error;
    }

    // Remove accepted operations from queue
    // IMPORTANT: Remove ALL queue items that correspond to accepted taskIds
    // This handles cases where consolidation merged multiple operations
    if (response.accepted.length > 0) {
      const acceptedQueueIds: string[] = [];
      
      for (const acceptedTaskId of response.accepted) {
        const queueIds = taskIdToQueueIds.get(acceptedTaskId);
        if (queueIds) {
          acceptedQueueIds.push(...queueIds);
        } else {
          console.warn(`[SYNC WARNING] Server accepted taskId ${acceptedTaskId} but no queue items found`);
        }
      }
      
      console.log(`[SYNC DEBUG] Removing ${acceptedQueueIds.length} accepted operations from queue`);
      console.log(`[SYNC DEBUG] Accepted taskIds:`, response.accepted);
      console.log(`[SYNC DEBUG] Queue IDs to remove:`, acceptedQueueIds);
      
      if (acceptedQueueIds.length > 0) {
        await queue.dequeueBulk(acceptedQueueIds);
      }
      
      // Verify removal
      const remainingCount = await queue.getPendingCount();
      console.log(`[SYNC DEBUG] Remaining operations in queue after removal: ${remainingCount}`);
      
      // Double-check: log any remaining operations for accepted tasks
      if (remainingCount > 0) {
        const remaining = await queue.getPending();
        const orphanedOps = remaining.filter(op => response.accepted.includes(op.taskId));
        if (orphanedOps.length > 0) {
          console.error(`[SYNC ERROR] Found ${orphanedOps.length} orphaned operations for accepted tasks:`, 
            orphanedOps.map(op => ({ id: op.id, taskId: op.taskId, operation: op.operation }))
          );
        }
      }
    }

    // Handle rejections (increment retry count)
    for (const rejected of response.rejected) {
      console.log(`[SYNC DEBUG] Operation rejected:`, rejected);
      const op = pendingOps.find(o => o.taskId === rejected.taskId);
      if (op) {
        await queue.incrementRetry(op.id);
      }
    }

    // Handle conflicts - remove from queue since server has authoritative version
    // The server's version will be pulled in the pull phase
    if (response.conflicts.length > 0) {
      const conflictedQueueIds: string[] = [];
      
      for (const conflict of response.conflicts) {
        const queueIds = taskIdToQueueIds.get(conflict.taskId);
        if (queueIds) {
          conflictedQueueIds.push(...queueIds);
        }
      }
      
      if (conflictedQueueIds.length > 0) {
        console.log(`[SYNC DEBUG] Removing ${conflictedQueueIds.length} conflicted operations from queue`);
        console.log(`[SYNC DEBUG] Conflicted taskIds:`, response.conflicts.map(c => c.taskId));
        await queue.dequeueBulk(conflictedQueueIds);
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

    let response;
    try {
      response = await api.pull({
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
    } catch (error) {
      const pullError = error instanceof Error ? error : new Error('Pull failed');
      this.logError('Pull operation failed', pullError, {
        phase: 'pull',
        operationCounts: {
          pulled: 0,
          failed: 1,
        },
        requestDetails: {
          url: config.serverUrl,
          method: 'GET',
        },
      });
      throw error;
    }

    const conflicts: ConflictInfo[] = [];

    // Decrypt and apply remote changes
    console.log(`[SYNC DEBUG] Processing ${response.tasks.length} tasks from server`);

    for (const encTask of response.tasks) {
      try {
        console.log(`[SYNC DEBUG] ========================================`);
        console.log(`[SYNC DEBUG] Processing task ${encTask.id}`);
        console.log(`[SYNC DEBUG] Remote vector clock:`, encTask.vectorClock);
        console.log(`[SYNC DEBUG] Remote updated at:`, new Date(encTask.updatedAt).toISOString());

        const decrypted = await crypto.decrypt(encTask.encryptedBlob, encTask.nonce);
        const task = taskRecordSchema.parse(JSON.parse(decrypted));
        console.log(`[SYNC DEBUG] Decrypted task: "${task.title}"`);
        console.log(`[SYNC DEBUG] Task metadata:`, {
          id: task.id,
          completed: task.completed,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        });

        // Check for local conflicts
        const localTask = await db.tasks.get(task.id);

        if (localTask) {
          console.log(`[SYNC DEBUG] Found local version of task`);
          console.log(`[SYNC DEBUG] Local metadata:`, {
            title: localTask.title,
            completed: localTask.completed,
            updatedAt: localTask.updatedAt,
            vectorClock: localTask.vectorClock,
          });

          // BULLETPROOF: Use timestamp comparison for conflict detection
          const localTime = new Date(localTask.updatedAt).getTime();
          const remoteTime = new Date(task.updatedAt).getTime();

          console.log(`[SYNC DEBUG] Timestamp comparison:`, {
            localTime,
            remoteTime,
            localNewer: localTime > remoteTime,
            remoteNewer: remoteTime > localTime,
            identical: localTime === remoteTime,
          });

          // If remote is newer OR same time (use remote as source of truth), apply it
          if (remoteTime >= localTime) {
            console.log(`[SYNC DEBUG] ✓ Remote version is newer or equal - applying`);
          } else {
            console.log(`[SYNC DEBUG] ⚠ Local version is newer - keeping local`);
            continue; // Skip this task, keep local version
          }
        } else {
          console.log(`[SYNC DEBUG] ✓ No local version - creating new task`);
        }

        // Apply the remote version
        const existingClock = localTask?.vectorClock || {};
        const mergedClock = mergeVectorClocks(existingClock, encTask.vectorClock);

        console.log(`[SYNC DEBUG] Saving task to IndexedDB`);
        console.log(`[SYNC DEBUG] Merged vector clock:`, mergedClock);

        await db.tasks.put({
          ...task,
          vectorClock: mergedClock,
        });

        console.log(`[SYNC DEBUG] ✓ Task ${task.id} saved successfully`);
      } catch (error) {
        const processError = error instanceof Error ? error : new Error('Task processing failed');
        this.logError(`Failed to process task ${encTask.id}`, processError, {
          phase: 'pull',
        });
      }
    }

    console.log(`[SYNC DEBUG] Finished processing ${response.tasks.length} tasks`);

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
        // Defensive check: ensure conflict has required task data
        if (!conflict.local || !conflict.remote) {
          console.error(
            `[SYNC ERROR] Cannot auto-resolve conflict for task ${conflict.taskId}: missing task data`,
            { hasLocal: !!conflict.local, hasRemote: !!conflict.remote }
          );
          continue;
        }

        // Compare updatedAt timestamps
        const localTime = new Date(conflict.local.updatedAt).getTime();
        const remoteTime = new Date(conflict.remote.updatedAt).getTime();

        const winner = remoteTime > localTime ? conflict.remote : conflict.local;

        console.log(`[SYNC DEBUG] Resolving conflict for task ${conflict.taskId}:`, {
          localTime: new Date(localTime).toISOString(),
          remoteTime: new Date(remoteTime).toISOString(),
          winner: winner === conflict.remote ? 'remote' : 'local',
        });

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

    // Use sync START time to prevent race condition
    // Tasks modified after sync starts will be caught in the next sync
    // Server uses >= comparison, so no adjustment needed
    console.log('[SYNC DEBUG] Updating sync metadata:', {
      previousLastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt).toISOString() : null,
      newLastSyncAt: new Date(syncStartTime).toISOString(),
      syncStartTime,
      timingWindow: config.lastSyncAt ? `${syncStartTime - config.lastSyncAt}ms` : 'initial sync',
    });

    await db.syncMetadata.put({
      ...config,
      lastSyncAt: syncStartTime,
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
