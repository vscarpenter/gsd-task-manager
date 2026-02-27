/**
 * Queue optimizer - consolidates redundant operations in sync queue
 * Reduces network traffic and improves sync efficiency
 */

import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_QUEUE');

export class QueueOptimizer {
  /**
   * Consolidate operations for a specific task.
   * Merges multiple operations into a single operation with the latest payload.
   */
  async consolidateTask(taskId: string): Promise<void> {
    const db = getDb();

    const operations = await db.syncQueue
      .where('taskId')
      .equals(taskId)
      .sortBy('timestamp');

    if (operations.length <= 1) {
      return;
    }

    logger.debug('Consolidating operations for task', {
      taskId,
      operationCount: operations.length,
    });

    // Delete supersedes everything
    const deleteOp = operations.find(op => op.operation === 'delete');

    if (deleteOp) {
      const idsToRemove = operations
        .filter(op => op.id !== deleteOp.id)
        .map(op => op.id);

      if (idsToRemove.length > 0) {
        logger.debug('Delete operation found, removing superseded operations', {
          taskId,
          removedCount: idsToRemove.length,
        });
        await db.syncQueue.bulkDelete(idsToRemove);

        await db.syncQueue.update(deleteOp.id, {
          consolidatedFrom: [...(deleteOp.consolidatedFrom || []), ...idsToRemove],
        });
      }

      return;
    }

    // No delete — consolidate creates and updates
    const createOp = operations.find(op => op.operation === 'create');
    const updateOps = operations.filter(op => op.operation === 'update');

    if (createOp && updateOps.length > 0) {
      // Collapse create + updates into a single create with the final state
      logger.debug('Consolidating create + updates into single create', {
        taskId,
        updateCount: updateOps.length,
      });

      const latestUpdate = updateOps[updateOps.length - 1];
      const consolidatedIds = updateOps.map(op => op.id);

      await db.syncQueue.update(createOp.id, {
        payload: latestUpdate.payload,
        timestamp: latestUpdate.timestamp,
        consolidatedFrom: [...(createOp.consolidatedFrom || []), ...consolidatedIds],
      });

      await db.syncQueue.bulkDelete(consolidatedIds);
    } else if (updateOps.length > 1) {
      // Multiple updates — keep the first, merge others into it
      logger.debug('Consolidating multiple updates into single update', {
        taskId,
        updateCount: updateOps.length,
      });

      const firstUpdate = updateOps[0];
      const laterUpdates = updateOps.slice(1);
      const latestUpdate = updateOps[updateOps.length - 1];
      const consolidatedIds = laterUpdates.map(op => op.id);

      await db.syncQueue.update(firstUpdate.id, {
        payload: latestUpdate.payload,
        timestamp: latestUpdate.timestamp,
        consolidatedFrom: [...(firstUpdate.consolidatedFrom || []), ...consolidatedIds],
      });

      await db.syncQueue.bulkDelete(consolidatedIds);
    }
  }

  /**
   * Consolidate all pending operations in the queue.
   * @returns Number of operations removed
   */
  async consolidateAll(): Promise<number> {
    const db = getDb();

    const countBefore = await db.syncQueue.count();

    if (countBefore === 0) {
      return 0;
    }

    logger.debug('Starting queue consolidation', { operationCount: countBefore });

    const allOperations = await db.syncQueue.toArray();
    const taskIds = [...new Set(allOperations.map(op => op.taskId))];

    logger.debug('Found unique tasks in queue', { taskCount: taskIds.length });

    // Log tasks with multiple operations (potential consolidation targets)
    const taskCounts = new Map<string, number>();
    for (const op of allOperations) {
      taskCounts.set(op.taskId, (taskCounts.get(op.taskId) || 0) + 1);
    }

    const duplicateTasks = Array.from(taskCounts.entries()).filter(([, count]) => count > 1);
    if (duplicateTasks.length > 0) {
      logger.debug('Tasks with multiple operations found', {
        duplicateTaskCount: duplicateTasks.length,
        details: duplicateTasks.map(([taskId, count]) => ({ taskId, count })),
      });
    }

    for (const taskId of taskIds) {
      await this.consolidateTask(taskId);
    }

    const countAfter = await db.syncQueue.count();
    const removed = countBefore - countAfter;

    logger.info('Queue consolidation complete', { removed, countBefore, countAfter });

    // Verify no duplicate taskIds remain after consolidation
    const afterOps = await db.syncQueue.toArray();
    const afterTaskIds = afterOps.map(op => op.taskId);
    const afterDuplicates = afterTaskIds.filter(
      (id, index) => afterTaskIds.indexOf(id) !== index
    );
    if (afterDuplicates.length > 0) {
      logger.error('Duplicate taskIds still exist after consolidation', undefined, {
        duplicates: [...new Set(afterDuplicates)],
      });
    }

    return removed;
  }

  /**
   * Remove operations superseded by a delete operation.
   * Called when a task is deleted to clean up any pending operations.
   */
  async pruneDeleted(taskId: string): Promise<void> {
    const db = getDb();

    const operations = await db.syncQueue
      .where('taskId')
      .equals(taskId)
      .toArray();

    if (operations.length === 0) {
      return;
    }

    const deleteOp = operations.find(op => op.operation === 'delete');

    if (!deleteOp) {
      return;
    }

    const idsToRemove = operations
      .filter(op => op.id !== deleteOp.id)
      .map(op => op.id);

    if (idsToRemove.length > 0) {
      logger.debug('Pruning operations superseded by delete', {
        taskId,
        prunedCount: idsToRemove.length,
      });
      await db.syncQueue.bulkDelete(idsToRemove);

      await db.syncQueue.update(deleteOp.id, {
        consolidatedFrom: [...(deleteOp.consolidatedFrom || []), ...idsToRemove],
      });
    }
  }
}

// Singleton instance
let optimizerInstance: QueueOptimizer | null = null;

/**
 * Get or create queue optimizer instance
 */
export function getQueueOptimizer(): QueueOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new QueueOptimizer();
  }
  return optimizerInstance;
}
