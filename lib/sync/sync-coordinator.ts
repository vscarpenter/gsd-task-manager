/**
 * Sync Coordinator — manages sync request queuing and deduplication
 *
 * Wraps the PocketBase sync engine with a single-execution guard so that
 * only one sync runs at a time, with additional requests queued and
 * deduplicated by priority.
 */

import { fullSync } from './pb-sync-engine';
import { getRetryManager } from './retry-manager';
import type { PBSyncResult, PBSyncConfig } from './types';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_ENGINE');

export interface SyncStatus {
  isRunning: boolean;
  pendingRequests: number;
  lastSyncAt: string | null;
  lastError: string | null;
  retryCount: number;
  nextRetryAt: number | null;
  lastResult: PBSyncResult | null;
}

interface QueuedSyncRequest {
  priority: 'user' | 'auto';
  timestamp: number;
}

export class SyncCoordinator {
  private retryManager = getRetryManager();

  private isRunning = false;
  private pendingRequests: QueuedSyncRequest[] = [];
  private lastResult: PBSyncResult | null = null;

  /**
   * Request a sync operation
   * If sync is already running, the request is queued.
   * Multiple pending requests are deduplicated (highest priority wins).
   */
  async requestSync(priority: 'user' | 'auto' = 'auto'): Promise<void> {
    logger.debug('Sync requested', { priority });

    if (this.isRunning) {
      logger.debug('Sync already running, queuing request');
      this.queueRequest(priority);
      return;
    }

    // Set running flag early to prevent concurrent entry during async checks
    this.isRunning = true;

    // Enforce retry backoff for auto syncs (user-triggered syncs bypass backoff)
    if (priority === 'auto') {
      const canSync = await this.retryManager.canSyncNow();
      if (!canSync) {
        logger.debug('Auto sync blocked by retry backoff');
        this.isRunning = false;
        return;
      }

      const shouldRetry = await this.retryManager.shouldRetry();
      if (!shouldRetry) {
        logger.warn('Auto sync blocked: max retries exceeded');
        this.isRunning = false;
        return;
      }
    }

    // isRunning is already true; executeSync will reset it in finally
    await this.executeSync(priority);
    await this.processQueue();
  }

  isSyncing(): boolean {
    return this.isRunning;
  }

  async getStatus(): Promise<SyncStatus> {
    const config = await this.getSyncConfig();
    const retryCount = await this.retryManager.getRetryCount();

    return {
      isRunning: this.isRunning,
      pendingRequests: this.pendingRequests.length,
      lastSyncAt: config?.lastSyncAt ?? null,
      lastError: (this.lastResult?.status === 'error' || this.lastResult?.status === 'partial')
        ? this.lastResult.error || null
        : null,
      retryCount,
      nextRetryAt: config?.nextRetryAt ?? null,
      lastResult: this.lastResult,
    };
  }

  cancelPending(): void {
    logger.debug('Cancelling pending requests', { count: this.pendingRequests.length });
    this.pendingRequests = [];
  }

  private queueRequest(priority: 'user' | 'auto'): void {
    const existingIndex = this.pendingRequests.findIndex(req => req.priority === priority);

    if (existingIndex >= 0) {
      this.pendingRequests[existingIndex].timestamp = Date.now();
    } else {
      this.pendingRequests.push({ priority, timestamp: Date.now() });
    }

    // Deduplicate: user priority supersedes auto
    if (this.pendingRequests.length > 1) {
      const hasUser = this.pendingRequests.some(req => req.priority === 'user');
      if (hasUser) {
        this.pendingRequests = this.pendingRequests.filter(req => req.priority === 'user');
      }
    }
  }

  private async executeSync(priority: 'user' | 'auto'): Promise<void> {
    this.isRunning = true;

    try {
      logger.debug('Starting sync execution', { priority });
      const result = await fullSync(priority);
      this.lastResult = result;
      logger.info('Sync completed', { status: result.status });
    } catch (error) {
      logger.error('Sync failed', error instanceof Error ? error : new Error(String(error)));
      this.lastResult = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.pendingRequests.length === 0) return;

    const nextRequest = this.pendingRequests.shift();
    if (!nextRequest) return;

    // Enforce retry backoff for queued auto syncs
    if (nextRequest.priority === 'auto') {
      const canSync = await this.retryManager.canSyncNow();
      if (!canSync) {
        logger.debug('Queued auto sync blocked by retry backoff');
        return;
      }
    }

    logger.debug('Processing queued sync request', { priority: nextRequest.priority });
    await this.executeSync(nextRequest.priority);
    await this.processQueue();
  }

  private async getSyncConfig(): Promise<PBSyncConfig | null> {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config');
    return config as PBSyncConfig | null;
  }
}

// Singleton instance
let coordinatorInstance: SyncCoordinator | null = null;

export function getSyncCoordinator(): SyncCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new SyncCoordinator();
  }
  return coordinatorInstance;
}
