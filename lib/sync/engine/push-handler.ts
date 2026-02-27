/**
 * Push handler - pushes local pending changes to Supabase
 * Handles encryption, queue management, and conflict detection
 */

import type { CryptoManager } from '../crypto';
import { getSyncQueue } from '../queue';
import { pushEncryptedTask, softDeleteTask } from '../supabase-sync-client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_PUSH');

/**
 * Context object containing dependencies for push operations
 */
export interface PushContext {
  crypto: CryptoManager;
  userId: string;
  deviceId: string;
}

/**
 * Push local pending changes to Supabase
 * Processes each operation individually: encrypts and upserts for create/update,
 * soft-deletes for delete operations.
 */
export async function pushLocalChanges(context: PushContext): Promise<{
  acceptedCount: number;
  conflictCount: number;
  errorCount: number;
}> {
  const { crypto, userId, deviceId } = context;
  const queue = getSyncQueue();
  const pendingOps = await queue.getPending();

  logger.debug('Starting push phase', { pendingCount: pendingOps.length });

  if (pendingOps.length === 0) {
    logger.debug('No pending operations, skipping push');
    return { acceptedCount: 0, conflictCount: 0, errorCount: 0 };
  }

  let acceptedCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  for (const op of pendingOps) {
    try {
      if (op.operation === 'delete') {
        await processDeleteOp(op.id, op.taskId, userId, deviceId, queue);
        acceptedCount++;
        continue;
      }

      if (!op.payload) {
        logger.warn('Skipping operation with no payload', {
          taskId: op.taskId,
          operation: op.operation,
        });
        errorCount++;
        continue;
      }

      const result = await processUpsertOp(
        op.id,
        op.taskId,
        op.payload,
        crypto,
        userId,
        deviceId,
        queue
      );

      if (result === 'accepted') {
        acceptedCount++;
      } else if (result === 'conflict') {
        conflictCount++;
      }
    } catch (error) {
      const opError = error instanceof Error ? error : new Error('Operation failed');
      logger.error('Failed to push operation', opError, {
        taskId: op.taskId,
        operation: op.operation,
      });
      await queue.incrementRetry(op.id);
      errorCount++;
    }
  }

  logger.info('Push phase complete', { acceptedCount, conflictCount, errorCount });

  return { acceptedCount, conflictCount, errorCount };
}

/**
 * Process a delete operation: soft-delete on Supabase, then dequeue
 */
async function processDeleteOp(
  queueId: string,
  taskId: string,
  userId: string,
  deviceId: string,
  queue: ReturnType<typeof getSyncQueue>
): Promise<void> {
  logger.debug('Pushing delete operation', { taskId });
  await softDeleteTask(taskId, userId, deviceId);
  await queue.dequeue(queueId);
  logger.debug('Delete operation accepted', { taskId });
}

/**
 * Process a create/update operation: encrypt, push to Supabase, handle conflicts
 * Returns 'accepted' or 'conflict' based on the server response.
 */
async function processUpsertOp(
  queueId: string,
  taskId: string,
  payload: NonNullable<import('../types').SyncQueueItem['payload']>,
  crypto: CryptoManager,
  userId: string,
  deviceId: string,
  queue: ReturnType<typeof getSyncQueue>
): Promise<'accepted' | 'conflict'> {
  const plaintext = JSON.stringify(payload);
  const { ciphertext, nonce } = await crypto.encrypt(plaintext);
  const checksum = await crypto.hash(plaintext);

  logger.debug('Pushing upsert operation', { taskId });

  const result = await pushEncryptedTask({
    id: taskId,
    userId,
    encryptedBlob: ciphertext,
    nonce,
    checksum,
    deviceId,
  });

  if (result.conflict) {
    // Version mismatch — remove from queue; the pull phase will fetch
    // the authoritative remote version and apply LWW resolution.
    logger.debug('Conflict detected, deferring to pull phase', {
      taskId,
      serverVersion: result.newVersion,
    });
    await queue.dequeue(queueId);
    return 'conflict';
  }

  await queue.dequeue(queueId);
  logger.debug('Upsert operation accepted', { taskId, newVersion: result.newVersion });
  return 'accepted';
}
