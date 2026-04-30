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
    };

    await db.syncQueue.add(item);
  }

  /**
   * Get all pending operations
   */
  async getPending(): Promise<SyncQueueItem[]> {
    const db = getDb();
    return db.syncQueue.orderBy('timestamp').toArray();
  }

  /**
   * Get count of pending operations
   */
  async getPendingCount(): Promise<number> {
    const db = getDb();
    return db.syncQueue.count();
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
   * Increment retry count for failed operation
   */
  async incrementRetry(id: string): Promise<void> {
    const db = getDb();
    const item = await db.syncQueue.get(id);

    if (item) {
      await db.syncQueue.update(id, {
        retryCount: item.retryCount + 1,
      });
    }
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

  /**
   * Remove items that have exceeded the maximum retry count.
   * Prevents the queue from growing unboundedly when push operations
   * repeatedly fail for a specific task (e.g., validation errors).
   *
   * @returns Number of pruned items
   */
  async pruneExhaustedRetries(): Promise<number> {
    const db = getDb();
    const all = await db.syncQueue.toArray();
    const exhausted = all.filter(item => item.retryCount >= SYNC_CONFIG.MAX_RETRIES);

    if (exhausted.length === 0) return 0;

    const ids = exhausted.map(item => item.id);
    await db.syncQueue.bulkDelete(ids);

    logger.warn('Pruned exhausted sync queue items', {
      prunedCount: exhausted.length,
      taskIds: exhausted.map(item => item.taskId).join(', '),
    });

    return exhausted.length;
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
