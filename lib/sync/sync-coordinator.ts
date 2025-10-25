/**
 * Sync Coordinator - manages sync request queuing and deduplication
 * Ensures only one sync runs at a time and queues additional requests
 */

import { getSyncEngine } from './engine';
import { getRetryManager } from './retry-manager';
import { getSyncQueue } from './queue';
import type { SyncResult, SyncConfig } from './types';
import { getDb } from '@/lib/db';

export interface SyncStatus {
  isRunning: boolean;
  pendingRequests: number;
  lastSyncAt: number | null;
  lastError: string | null;
  retryCount: number;
  nextRetryAt: number | null;
  lastResult: SyncResult | null;
}

interface QueuedSyncRequest {
  priority: 'user' | 'auto';
  timestamp: number;
}

export class SyncCoordinator {
  private engine = getSyncEngine();
  private retryManager = getRetryManager();
  private syncQueue = getSyncQueue();
  
  private isRunning = false;
  private pendingRequests: QueuedSyncRequest[] = [];
  private lastResult: SyncResult | null = null;

  /**
   * Request a sync operation
   * If sync is already running, the request is queued
   * Multiple pending requests are deduplicated (highest priority wins)
   */
  async requestSync(priority: 'user' | 'auto' = 'auto'): Promise<void> {
    console.log('[SYNC COORDINATOR] Sync requested with priority:', priority);

    // If sync is already running, queue the request
    if (this.isRunning) {
      console.log('[SYNC COORDINATOR] Sync already running, queuing request');
      this.queueRequest(priority);
      return;
    }

    // Execute sync immediately
    await this.executeSync(priority);

    // Process any queued requests
    await this.processQueue();
  }

  /**
   * Check if sync is currently running
   */
  isSyncing(): boolean {
    return this.isRunning;
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const config = await this.getSyncConfig();
    const retryCount = await this.retryManager.getRetryCount();
    const pendingCount = await this.syncQueue.getPendingCount();

    return {
      isRunning: this.isRunning,
      pendingRequests: this.pendingRequests.length,
      lastSyncAt: config?.lastSyncAt || null,
      lastError: this.lastResult?.status === 'error' ? this.lastResult.error || null : null,
      retryCount,
      nextRetryAt: config?.nextRetryAt || null,
      lastResult: this.lastResult,
    };
  }

  /**
   * Cancel all pending sync requests
   */
  cancelPending(): void {
    console.log(`[SYNC COORDINATOR] Cancelling ${this.pendingRequests.length} pending requests`);
    this.pendingRequests = [];
  }

  /**
   * Queue a sync request
   * Deduplicates by keeping the highest priority request
   */
  private queueRequest(priority: 'user' | 'auto'): void {
    // Check if we already have a pending request
    const existingIndex = this.pendingRequests.findIndex(req => req.priority === priority);

    if (existingIndex >= 0) {
      // Update timestamp of existing request
      console.log('[SYNC COORDINATOR] Updating existing queued request');
      this.pendingRequests[existingIndex].timestamp = Date.now();
    } else {
      // Add new request
      console.log('[SYNC COORDINATOR] Adding new queued request');
      this.pendingRequests.push({
        priority,
        timestamp: Date.now(),
      });
    }

    // Deduplicate: if we have both user and auto requests, keep only user (higher priority)
    if (this.pendingRequests.length > 1) {
      const hasUser = this.pendingRequests.some(req => req.priority === 'user');
      if (hasUser) {
        console.log('[SYNC COORDINATOR] Deduplicating: keeping only user priority request');
        this.pendingRequests = this.pendingRequests.filter(req => req.priority === 'user');
      }
    }

    console.log(`[SYNC COORDINATOR] Queue size: ${this.pendingRequests.length}`);
  }

  /**
   * Execute a sync operation
   */
  private async executeSync(priority: 'user' | 'auto'): Promise<void> {
    this.isRunning = true;

    try {
      console.log('[SYNC COORDINATOR] Starting sync execution with priority:', priority);
      const result = await this.engine.sync(priority);
      this.lastResult = result;
      console.log('[SYNC COORDINATOR] Sync completed:', result.status);
    } catch (error) {
      console.error('[SYNC COORDINATOR] Sync failed:', error);
      this.lastResult = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process queued sync requests
   * Executes the next request in the queue after current sync completes
   */
  private async processQueue(): Promise<void> {
    // If no pending requests, we're done
    if (this.pendingRequests.length === 0) {
      console.log('[SYNC COORDINATOR] No pending requests to process');
      return;
    }

    // Get the next request (highest priority first)
    const nextRequest = this.pendingRequests.shift();
    
    if (!nextRequest) {
      return;
    }

    console.log('[SYNC COORDINATOR] Processing queued sync request:', nextRequest.priority);

    // Execute the queued sync
    await this.executeSync(nextRequest.priority);

    // Recursively process remaining queue
    await this.processQueue();
  }

  /**
   * Get sync configuration from IndexedDB
   */
  private async getSyncConfig(): Promise<SyncConfig | null> {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config');
    return config as SyncConfig | null;
  }
}

// Singleton instance
let coordinatorInstance: SyncCoordinator | null = null;

/**
 * Get or create sync coordinator instance
 */
export function getSyncCoordinator(): SyncCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new SyncCoordinator();
  }
  return coordinatorInstance;
}
