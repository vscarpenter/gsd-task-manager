/**
 * Queue optimizer - consolidates redundant operations in sync queue
 * Reduces network traffic and improves sync efficiency
 */

import { getDb } from '@/lib/db';
import { mergeVectorClocks } from './vector-clock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_QUEUE');

export class QueueOptimizer {
  /**
   * Consolidate operations for a specific task
   * Merges multiple updates into single operation with latest payload
   */
  async consolidateTask(taskId: string): Promise<void> {
    const db = getDb();
    
    // Get all operations for this task, ordered by timestamp
    const operations = await db.syncQueue
      .where('taskId')
      .equals(taskId)
      .sortBy('timestamp');
    
    if (operations.length <= 1) {
      // Nothing to consolidate
      return;
    }
    
    logger.debug('Consolidating operations for task', { taskId, operationCount: operations.length });

    // Check if there's a delete operation (it supersedes everything)
    const deleteOp = operations.find(op => op.operation === 'delete');

    if (deleteOp) {
      // Delete supersedes all previous operations
      // Remove all operations except the delete
      const idsToRemove = operations
        .filter(op => op.id !== deleteOp.id)
        .map(op => op.id);

      if (idsToRemove.length > 0) {
        logger.debug('Delete operation found, removing superseded operations', { taskId, removedCount: idsToRemove.length });
        await db.syncQueue.bulkDelete(idsToRemove);
        
        // Update delete operation to track what was consolidated
        await db.syncQueue.update(deleteOp.id, {
          consolidatedFrom: [...(deleteOp.consolidatedFrom || []), ...idsToRemove],
        });
      }
      
      return;
    }
    
    // No delete operation - consolidate creates and updates
    const createOp = operations.find(op => op.operation === 'create');
    const updateOps = operations.filter(op => op.operation === 'update');
    
    if (createOp && updateOps.length > 0) {
      // Consolidate create + updates into single create with final state
      logger.debug('Consolidating create + updates into single create', { taskId, updateCount: updateOps.length });
      
      // Use the latest update's payload (most recent state)
      // updateOps are already sorted by timestamp from the query
      const latestUpdate = updateOps[updateOps.length - 1];
      
      // Merge all vector clocks
      let mergedClock = createOp.vectorClock;
      for (const update of updateOps) {
        mergedClock = mergeVectorClocks(mergedClock, update.vectorClock);
      }
      
      // Track all consolidated operation IDs
      const consolidatedIds = updateOps.map(op => op.id);
      
      // Update the create operation with latest payload and merged clock
      await db.syncQueue.update(createOp.id, {
        payload: latestUpdate.payload,
        vectorClock: mergedClock,
        timestamp: latestUpdate.timestamp, // Use latest timestamp
        consolidatedFrom: [...(createOp.consolidatedFrom || []), ...consolidatedIds],
      });
      
      // Remove the update operations
      await db.syncQueue.bulkDelete(consolidatedIds);
      
    } else if (updateOps.length > 1) {
      // Multiple updates - consolidate into single update with latest payload
      logger.debug('Consolidating multiple updates into single update', { taskId, updateCount: updateOps.length });
      
      // Keep the first update, merge others into it
      const firstUpdate = updateOps[0];
      const laterUpdates = updateOps.slice(1);
      const latestUpdate = updateOps[updateOps.length - 1];
      
      // Track all consolidated operation IDs
      const consolidatedIds = laterUpdates.map(op => op.id);
      
      // Update the first operation with latest payload and vector clock
      await db.syncQueue.update(firstUpdate.id, {
        payload: latestUpdate.payload,
        vectorClock: latestUpdate.vectorClock, // Use latest vector clock
        timestamp: latestUpdate.timestamp, // Use latest timestamp
        consolidatedFrom: [...(firstUpdate.consolidatedFrom || []), ...consolidatedIds],
      });
      
      // Remove the later update operations
      await db.syncQueue.bulkDelete(consolidatedIds);
    }
  }
  
  /**
   * Consolidate all pending operations in the queue
   * Returns the number of operations removed
   */
  async consolidateAll(): Promise<number> {
    const db = getDb();
    
    // Get count before consolidation
    const countBefore = await db.syncQueue.count();
    
    if (countBefore === 0) {
      return 0;
    }
    
    logger.debug('Starting queue consolidation', { operationCount: countBefore });

    // Get all unique task IDs in the queue
    const allOperations = await db.syncQueue.toArray();
    const taskIds = [...new Set(allOperations.map(op => op.taskId))];

    logger.debug('Found unique tasks in queue', { taskCount: taskIds.length });

    // Log operations per task to detect duplicates
    const taskCounts = new Map<string, number>();
    for (const op of allOperations) {
      taskCounts.set(op.taskId, (taskCounts.get(op.taskId) || 0) + 1);
    }

    const duplicateTasks = Array.from(taskCounts.entries()).filter(([, count]) => count > 1);
    if (duplicateTasks.length > 0) {
      logger.debug('Tasks with multiple operations found', {
        duplicateTaskCount: duplicateTasks.length,
        details: duplicateTasks.map(([taskId, count]) => ({ taskId, count }))
      });
    }
    
    // Consolidate operations for each task
    for (const taskId of taskIds) {
      await this.consolidateTask(taskId);
    }
    
    // Get count after consolidation
    const countAfter = await db.syncQueue.count();
    const removed = countBefore - countAfter;

    logger.info('Queue consolidation complete', { removed, countBefore, countAfter });

    // Verify no duplicate taskIds remain
    const afterOps = await db.syncQueue.toArray();
    const afterTaskIds = afterOps.map(op => op.taskId);
    const afterDuplicates = afterTaskIds.filter((id, index) => afterTaskIds.indexOf(id) !== index);
    if (afterDuplicates.length > 0) {
      logger.error('Duplicate taskIds still exist after consolidation', undefined, {
        duplicates: [...new Set(afterDuplicates)]
      });
    }
    
    return removed;
  }
  
  /**
   * Remove operations superseded by a delete operation
   * This is called when a task is deleted to clean up any pending operations
   */
  async pruneDeleted(taskId: string): Promise<void> {
    const db = getDb();
    
    // Get all operations for this task
    const operations = await db.syncQueue
      .where('taskId')
      .equals(taskId)
      .toArray();
    
    if (operations.length === 0) {
      return;
    }
    
    // Check if there's a delete operation
    const deleteOp = operations.find(op => op.operation === 'delete');
    
    if (!deleteOp) {
      return;
    }
    
    // Remove all operations except the delete
    const idsToRemove = operations
      .filter(op => op.id !== deleteOp.id)
      .map(op => op.id);
    
    if (idsToRemove.length > 0) {
      logger.debug('Pruning operations superseded by delete', { taskId, prunedCount: idsToRemove.length });
      await db.syncQueue.bulkDelete(idsToRemove);
      
      // Update delete operation to track what was pruned
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
