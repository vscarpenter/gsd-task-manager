/**
 * Sync queue manager for offline operations
 * Tracks pending sync operations when offline.
 */

import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';
import type { SyncQueueItem } from './types';
import { generateId } from '@/lib/id-generator';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_QUEUE');

const MAX_LAST_ERROR_LENGTH = 500;

function truncateError(message: string): string {
  return message.length <= MAX_LAST_ERROR_LENGTH
    ? message
    : message.slice(0, MAX_LAST_ERROR_LENGTH);
}

function isPending(item: SyncQueueItem): boolean {
  // Items predating v14 may have undefined status — treat as pending.
  return (item.status ?? 'pending') === 'pending';
}

export class SyncQueue {
  /**
   * Add operation to sync queue
   */
  async enqueue(
    operation: 'create' | 'update' | 'delete',
    taskId: string,
    payload: TaskRecord | null
  ): Promise<void> {
    const db = getDb();

    const item: SyncQueueItem = {
      id: generateId(),
      taskId,
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      payload,
      status: 'pending',
    };

    await db.syncQueue.add(item);
  }

  /**
   * Get all pending operations (excludes items in 'failed' status).
   */
  async getPending(): Promise<SyncQueueItem[]> {
    const db = getDb();
    const all = await db.syncQueue.orderBy('timestamp').toArray();
    return all.filter(isPending);
  }

  /**
   * Get count of pending operations (excludes items in 'failed' status).
   */
  async getPendingCount(): Promise<number> {
    const db = getDb();
    const all = await db.syncQueue.toArray();
    return all.filter(isPending).length;
  }

  /**
   * Get all items currently in 'failed' status. These have exhausted their
   * retry budget and need user attention (manual retry or dismissal).
   */
  async getFailed(): Promise<SyncQueueItem[]> {
    const db = getDb();
    const all = await db.syncQueue.toArray();
    return all.filter(item => item.status === 'failed');
  }

  /**
   * Remove operation from queue (after successful sync)
   */
  async dequeue(id: string): Promise<void> {
    const db = getDb();
    await db.syncQueue.delete(id);
  }

  /**
   * Remove multiple operations from queue
   */
  async dequeueBulk(ids: string[]): Promise<void> {
    const db = getDb();
    await db.syncQueue.bulkDelete(ids);
  }

  /**
   * Record a failed push attempt. Increments retryCount, stamps lastError and
   * lastAttemptAt, and — when retries are exhausted — atomically transitions
   * the item to 'failed' status (instead of deleting it). Failed items are
   * preserved for diagnosis / manual recovery.
   */
  async recordAttemptFailure(id: string, errorMessage: string): Promise<void> {
    const db = getDb();
    const item = await db.syncQueue.get(id);

    if (!item) return;

    const nextRetryCount = item.retryCount + 1;
    const exhausted = nextRetryCount >= SYNC_CONFIG.MAX_RETRIES;
    const now = Date.now();

    const update: Partial<SyncQueueItem> = {
      retryCount: nextRetryCount,
      lastError: truncateError(errorMessage),
      lastAttemptAt: now,
    };

    if (exhausted) {
      update.status = 'failed';
      update.failedAt = now;
      logger.warn('Sync queue item marked failed after exhausting retries', {
        id,
        taskId: item.taskId,
        operation: item.operation,
        retryCount: nextRetryCount,
        lastError: update.lastError,
      });
    }

    await db.syncQueue.update(id, update);
  }

  /**
   * Clear all pending operations (use with caution!)
   */
  async clear(): Promise<void> {
    const db = getDb();
    await db.syncQueue.clear();
  }

  /**
   * Get operations for a specific task
   */
  async getForTask(taskId: string): Promise<SyncQueueItem[]> {
    const db = getDb();
    return db.syncQueue.where('taskId').equals(taskId).toArray();
  }

  /**
   * Populate queue with all existing tasks (for initial sync)
   * Called when sync is first enabled to push all local tasks.
   */
  async populateFromExistingTasks(): Promise<number> {
    const db = getDb();
    const tasks = await db.tasks.toArray();

    if (tasks.length === 0) return 0;

    let count = 0;
    for (const task of tasks) {
      const existing = await this.getForTask(task.id);
      if (existing.length === 0) {
        await this.enqueue('create', task.id, task);
        count++;
      }
    }

    return count;
  }

}

// Singleton instance
let queueInstance: SyncQueue | null = null;

/**
 * Get or create sync queue instance
 */
export function getSyncQueue(): SyncQueue {
  if (!queueInstance) {
    queueInstance = new SyncQueue();
  }
  return queueInstance;
}
