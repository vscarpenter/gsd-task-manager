/**
 * Pull handler - pulls remote changes from Supabase
 * Handles decryption, LWW conflict resolution, and local database updates
 */

import { getDb } from '@/lib/db';
import { taskRecordSchema } from '@/lib/schema';
import { pullTasksSince, pullDeletedTaskIds } from '../supabase-sync-client';
import { createLogger } from '@/lib/logger';
import type { CryptoManager } from '../crypto';

const logger = createLogger('SYNC_PULL');

/**
 * Context object containing dependencies for pull operations
 */
export interface PullContext {
  crypto: CryptoManager;
  userId: string;
}

/**
 * Pull remote changes from Supabase.
 * Fetches updated and deleted tasks since lastSyncAt, decrypts each payload,
 * applies LWW resolution against local state, and removes locally-deleted tasks.
 */
export async function pullRemoteChanges(
  lastSyncAt: string | null,
  context: PullContext
): Promise<{
  pulledCount: number;
  deletedCount: number;
  conflictCount: number;
}> {
  const { crypto, userId } = context;
  const db = getDb();

  logger.debug('Starting pull phase', { sinceTimestamp: lastSyncAt });

  const [encryptedTasks, deletedIds] = await Promise.all([
    pullTasksSince(userId, lastSyncAt),
    pullDeletedTaskIds(userId, lastSyncAt),
  ]);

  logger.info('Pull response received', {
    tasksCount: encryptedTasks.length,
    deletedCount: deletedIds.length,
  });

  let pulledCount = 0;
  let conflictCount = 0;

  for (const encTask of encryptedTasks) {
    try {
      const decrypted = await crypto.decrypt(encTask.encrypted_blob, encTask.nonce);
      const task = taskRecordSchema.parse(JSON.parse(decrypted));

      const localTask = await db.tasks.get(task.id);

      if (localTask) {
        const localTime = new Date(localTask.updatedAt).getTime();
        const remoteTime = new Date(encTask.updated_at).getTime();

        if (remoteTime >= localTime) {
          logger.debug('Applying remote version (newer or equal)', { taskId: task.id });
        } else {
          logger.debug('Keeping local version (newer)', { taskId: task.id });
          conflictCount++;
          continue;
        }
      }

      await db.tasks.put(task);
      pulledCount++;
      logger.debug('Task saved', { taskId: task.id });
    } catch (error) {
      const processError = error instanceof Error ? error : new Error('Task processing failed');
      logger.error('Failed to process pulled task', processError, {
        taskId: encTask.id,
      });
    }
  }

  // Apply deletions
  let deletedCount = 0;
  if (deletedIds.length > 0) {
    logger.debug('Deleting locally-cached tasks', { deleteCount: deletedIds.length });
    await db.tasks.bulkDelete(deletedIds);
    deletedCount = deletedIds.length;
  }

  logger.info('Pull phase complete', { pulledCount, deletedCount, conflictCount });

  return { pulledCount, deletedCount, conflictCount };
}
