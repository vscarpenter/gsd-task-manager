/**
 * Push handler - pushes local pending changes to server
 * Handles encryption, queue management, and server response processing
 */

import type { CryptoManager } from '../crypto';
import type { SyncApiClient } from '../api-client';
import type { SyncConfig, SyncOperation } from '../types';
import { getSyncQueue } from '../queue';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_PUSH');

/**
 * Context object containing dependencies for push operations
 */
export interface PushContext {
  crypto: CryptoManager;
  api: SyncApiClient;
}

/**
 * Push local pending changes to server
 */
export async function pushLocalChanges(
  config: SyncConfig,
  context: PushContext
) {
  const { crypto, api } = context;
  const queue = getSyncQueue();
  const pendingOps = await queue.getPending();

  logger.debug('Starting push phase', { pendingCount: pendingOps.length });

  if (pendingOps.length > 0) {
    logger.debug('Pending operations', {
      operations: pendingOps.map(op => ({
        operation: op.operation,
        taskId: op.taskId,
        queueId: op.id,
      })),
    });
  }

  if (pendingOps.length === 0) {
    logger.debug('No pending operations, skipping push');
    return { accepted: [], rejected: [], conflicts: [], serverVectorClock: {} };
  }

  // Encrypt and prepare operations
  // Track mapping between taskId and queue item IDs for proper cleanup
  const operations: SyncOperation[] = [];
  const taskIdToQueueIds = new Map<string, string[]>();

  for (const op of pendingOps) {
    try {
      logger.debug('Preparing operation', {
        operation: op.operation,
        taskId: op.taskId,
        vectorClock: op.vectorClock,
      });

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
      logger.error('Failed to encrypt task', encryptError, {
        taskId: op.taskId,
        operation: op.operation,
      });
      continue;
    }
  }

  logger.info('Pushing operations to server', { operationCount: operations.length });

  // Push to server
  let response;
  try {
    response = await api.push({
      deviceId: config.deviceId,
      operations,
      clientVectorClock: config.vectorClock,
    });

    logger.info('Push response received', {
      accepted: response.accepted.length,
      rejected: response.rejected.length,
      conflicts: response.conflicts.length,
    });
  } catch (error) {
    const pushError = error instanceof Error ? error : new Error('Push failed');
    logger.error('Push operation failed', pushError, {
      operationCount: operations.length,
      url: config.serverUrl,
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
        logger.warn('Server accepted taskId but no queue items found', {
          taskId: acceptedTaskId,
        });
      }
    }

    logger.debug('Removing accepted operations from queue', {
      queueIdsCount: acceptedQueueIds.length,
      acceptedTaskIds: response.accepted,
    });

    if (acceptedQueueIds.length > 0) {
      await queue.dequeueBulk(acceptedQueueIds);
    }

    // Verify removal
    const remainingCount = await queue.getPendingCount();
    logger.debug('Queue cleanup complete', { remainingCount });

    // Double-check: log any remaining operations for accepted tasks
    if (remainingCount > 0) {
      const remaining = await queue.getPending();
      const orphanedOps = remaining.filter(op => response.accepted.includes(op.taskId));
      if (orphanedOps.length > 0) {
        logger.error('Found orphaned operations for accepted tasks', undefined, {
          orphanedCount: orphanedOps.length,
          orphanedOps: orphanedOps.map(op => ({
            id: op.id,
            taskId: op.taskId,
            operation: op.operation,
          })),
        });
      }
    }
  }

  // Handle rejections (increment retry count)
  for (const rejected of response.rejected) {
    logger.debug('Operation rejected', { rejection: rejected });
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
      logger.debug('Removing conflicted operations from queue', {
        conflictedCount: conflictedQueueIds.length,
        conflictedTaskIds: response.conflicts.map((c: { taskId: string }) => c.taskId),
      });
      await queue.dequeueBulk(conflictedQueueIds);
    }
  }

  logger.debug('Push phase complete');

  // Return enriched response with operation details for notifications
  return {
    ...response,
    rejectedOps: response.rejected.map(r => {
      const op = pendingOps.find(o => o.taskId === r.taskId);
      return {
        ...r,
        operation: op?.operation,
      };
    }),
    conflictedOps: response.conflicts.map((c: { taskId: string }) => {
      const op = pendingOps.find(o => o.taskId === c.taskId);
      return {
        taskId: c.taskId,
        operation: op?.operation,
        reason: 'concurrent_edit',
      };
    }),
  };
}
