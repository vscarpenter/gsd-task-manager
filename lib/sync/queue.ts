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

export function isPendingSyncQueueItem(item: SyncQueueItem): boolean {
  // Items predating v14 may have undefined status — treat as pending.
  return (item.status ?? 'pending') === 'pending';
}

/**
 * A row that has exhausted its retry budget. `getPending()` never returns one
 * and nothing re-arms it, so it can neither reach the server nor be retried.
 * Module-private on purpose: `classifyRemoteDeletion` is the only supported way
 * to ask what a queue row means for a remote deletion.
 */
function isFailedSyncQueueItem(item: SyncQueueItem): boolean {
  return item.status === 'failed';
}

/** What a task's queue rows say about a deletion that arrived from the server. */
export type RemoteDeletionVerdict = 'protect' | 'abandon' | 'apply';

export interface RemoteDeletionDecision {
  verdict: RemoteDeletionVerdict;
  /** Queue rows released with the task. Empty only when the task stays. */
  staleRowIds: string[];
}

/**
 * Decide what a remote deletion may do to one local task.
 *
 * Protection exists because a queued push re-creates the remote record
 * (edit-beats-delete under LWW), so deleting locally now would lose the unsynced
 * edit until the next pull round-trips. That reasoning holds only for a row a
 * push will actually attempt, so protection is scoped to exactly the set
 * `getPending()` returns.
 *
 * A retry-exhausted row will never be pushed, so it may not shield the task —
 * but its content never reached the server either, so the caller moves the task
 * to Trash rather than dropping it. Either way the caller deletes `staleRowIds`
 * in the same transaction, so a dead row can never outlive the task it guarded
 * and shield it forever.
 *
 * Shared by `reconcileDeletedTasks` and the realtime delete handler so the two
 * guards cannot drift apart. See docs/audits/AUDIT-2026-07-10.md.
 */
export function classifyRemoteDeletion(rowsForTask: SyncQueueItem[]): RemoteDeletionDecision {
  // Pending wins first: a fresh retryable row outranks a stale exhausted one.
  if (rowsForTask.some(isPendingSyncQueueItem)) return { verdict: 'protect', staleRowIds: [] };

  // Every row goes, including any carrying a status outside the union — the
  // task is leaving, so nothing of its queue may survive it.
  const staleRowIds = rowsForTask.map((row) => row.id);
  const verdict = rowsForTask.some(isFailedSyncQueueItem) ? 'abandon' : 'apply';
  return { verdict, staleRowIds };
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
    return all.filter(isPendingSyncQueueItem);
  }

  /**
   * Get count of pending operations (excludes items in 'failed' status).
   */
  async getPendingCount(): Promise<number> {
    const db = getDb();
    const all = await db.syncQueue.toArray();
    return all.filter(isPendingSyncQueueItem).length;
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

    const enqueued = await Promise.all(
      tasks.map(async (task) => {
        const existing = await this.getForTask(task.id);
        if (existing.length === 0) {
          await this.enqueue('create', task.id, task);
          return 1;
        }
        return 0;
      })
    );

    return enqueued.reduce((sum: number, n) => sum + n, 0);
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
