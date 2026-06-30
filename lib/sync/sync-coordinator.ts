/**
 * Sync Coordinator — manages sync request queuing and deduplication
 *
 * Wraps the PocketBase sync engine with a single-execution guard so that
 * only one sync runs at a time, with additional requests queued and
 * deduplicated by priority.
 */

import { fullSync } from './pb-sync-engine';
import { getRetryManager } from './retry-manager';
import { isTransientSyncFailure, sanitizeSyncError } from './error-categorizer';
import type { PBSyncResult, PBSyncConfig } from './types';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_ENGINE');

export interface SyncStatus {
  isRunning: boolean;
  pendingRequests: number;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
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

    // Hold the running flag across the ENTIRE lifecycle — backoff checks, the
    // sync itself, and the queue drain. Because it is never cleared mid-await,
    // a concurrent caller always hits the guard above and queues, so two
    // fullSync runs can never overlap (even while a queued auto awaits backoff).
    this.isRunning = true;
    try {
      await this.runRequest(priority);
      await this.drainQueue();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a single request, honoring auto-priority backoff. Assumes the caller
   * holds `isRunning`. A blocked auto is a no-op (its slot is simply skipped).
   */
  private async runRequest(priority: 'user' | 'auto'): Promise<void> {
    if (priority === 'auto' && !(await this.canRunAutoSync())) {
      return;
    }
    await this.executeSync(priority);
  }

  /** Whether an auto sync may run now (user-triggered syncs bypass backoff). */
  private async canRunAutoSync(): Promise<boolean> {
    if (!(await this.retryManager.canSyncNow())) {
      logger.debug('Auto sync blocked by retry backoff');
      return false;
    }
    if (!(await this.retryManager.shouldRetry())) {
      logger.warn('Auto sync blocked: max retries exceeded');
      return false;
    }
    return true;
  }

  isSyncing(): boolean {
    return this.isRunning;
  }

  async getStatus(): Promise<SyncStatus> {
    const [config, retryCount] = await Promise.all([
      this.getSyncConfig(),
      this.retryManager.getRetryCount(),
    ]);

    return {
      isRunning: this.isRunning,
      pendingRequests: this.pendingRequests.length,
      lastSyncAt: config?.lastSyncAt ?? null,
      lastSuccessfulSyncAt: config?.lastSuccessfulSyncAt ?? null,
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
    // isRunning is owned by requestSync for the whole lifecycle — not toggled here.
    try {
      logger.debug('Starting sync execution', { priority });
      const result = await fullSync(priority);
      this.lastResult = result;
      logger.debug('Sync completed', { status: result.status });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      // PB 4xx bodies can echo task titles — store/log only the stable code.
      const errorCode = sanitizeSyncError(errorObj);
      if (isTransientSyncFailure(errorObj)) {
        logger.warn('Sync failed (transient)', { errorCode });
      } else {
        logger.error('Sync failed', errorObj, { errorCode });
      }
      this.lastResult = {
        status: 'error',
        error: errorCode,
      };
    }
  }

  /**
   * Drain queued requests one at a time. Assumes the caller holds `isRunning`,
   * so requests that arrive mid-drain queue rather than starting a parallel
   * sync. Re-reads the queue each iteration to pick up anything enqueued while
   * the previous request was running.
   */
  private async drainQueue(): Promise<void> {
    while (this.pendingRequests.length > 0) {
      const next = this.pendingRequests.shift();
      if (!next) break;
      logger.debug('Processing queued sync request', { priority: next.priority });
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- intentionally sequential/throttled (rate-limit); parallelizing risks 429s
      await this.runRequest(next.priority);
    }
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
