/**
 * Sync queue manager for offline operations
 * Tracks pending sync operations when offline
 */

import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';
import type { SyncQueueItem, VectorClock } from './types';
import { generateId } from '@/lib/id-generator';

export class SyncQueue {
  /**
   * Add operation to sync queue
   */
  async enqueue(
    operation: 'create' | 'update' | 'delete',
    taskId: string,
    payload: TaskRecord | null,
    vectorClock: VectorClock
  ): Promise<void> {
    const db = getDb();

    const item: SyncQueueItem = {
      id: generateId(),
      taskId,
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      payload,
      vectorClock,
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
