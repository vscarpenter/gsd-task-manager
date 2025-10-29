/**
 * Pull handler - pulls remote changes from server
 * Handles decryption, conflict detection, and local database updates
 */

import { getDb } from '@/lib/db';
import { taskRecordSchema } from '@/lib/schema';
import { mergeVectorClocks } from '../vector-clock';
import { createLogger } from '@/lib/logger';
import type { CryptoManager } from '../crypto';
import type { SyncApiClient } from '../api-client';
import type { SyncConfig, ConflictInfo } from '../types';

const logger = createLogger('SYNC_PULL');

/**
 * Context object containing dependencies for pull operations
 */
export interface PullContext {
  crypto: CryptoManager;
  api: SyncApiClient;
}

/**
 * Pull remote changes from server
 */
export async function pullRemoteChanges(
  config: SyncConfig,
  context: PullContext
) {
  const { crypto, api } = context;
  const db = getDb();

  logger.debug('Starting pull phase', {
    deviceId: config.deviceId,
    sinceTimestamp: config.lastSyncAt,
  });

  let response;
  try {
    response = await api.pull({
      deviceId: config.deviceId,
      lastVectorClock: config.vectorClock,
      sinceTimestamp: config.lastSyncAt || undefined,
      limit: 50,
    });

    logger.info('Pull response received', {
      tasksCount: response.tasks.length,
      deletedCount: response.deletedTaskIds.length,
      conflictsCount: response.conflicts.length,
    });
  } catch (error) {
    const pullError = error instanceof Error ? error : new Error('Pull failed');
    logger.error('Pull operation failed', pullError, {
      url: config.serverUrl,
    });
    throw error;
  }

  const conflicts: ConflictInfo[] = [];

  logger.debug('Processing tasks from server', { taskCount: response.tasks.length });

  for (const encTask of response.tasks) {
    try {
      logger.debug('Processing task', {
        taskId: encTask.id,
        vectorClock: encTask.vectorClock,
        updatedAt: new Date(encTask.updatedAt).toISOString(),
      });

      const decrypted = await crypto.decrypt(encTask.encryptedBlob, encTask.nonce);
      const task = taskRecordSchema.parse(JSON.parse(decrypted));

      logger.debug('Task decrypted', {
        taskId: task.id,
        title: task.title,
        completed: task.completed,
      });

      // Check for local conflicts
      const localTask = await db.tasks.get(task.id);

      if (localTask) {
        logger.debug('Found local version of task', {
          taskId: task.id,
          localUpdatedAt: localTask.updatedAt,
          remoteUpdatedAt: task.updatedAt,
        });

        // BULLETPROOF: Use timestamp comparison for conflict detection
        const localTime = new Date(localTask.updatedAt).getTime();
        const remoteTime = new Date(task.updatedAt).getTime();

        // If remote is newer OR same time (use remote as source of truth), apply it
        if (remoteTime >= localTime) {
          logger.debug('Applying remote version (newer or equal)', { taskId: task.id });
        } else {
          logger.debug('Keeping local version (newer)', { taskId: task.id });
          continue; // Skip this task, keep local version
        }
      } else {
        logger.debug('Creating new task from remote', { taskId: task.id });
      }

      // Apply the remote version
      const existingClock = localTask?.vectorClock || {};
      const mergedClock = mergeVectorClocks(existingClock, encTask.vectorClock);

      await db.tasks.put({
        ...task,
        vectorClock: mergedClock,
      });

      logger.debug('Task saved successfully', { taskId: task.id });
    } catch (error) {
      const processError = error instanceof Error ? error : new Error('Task processing failed');
      logger.error('Failed to process task', processError, { taskId: encTask.id });
    }
  }

  logger.debug('Finished processing tasks', { processedCount: response.tasks.length });

  // Apply deletions
  if (response.deletedTaskIds.length > 0) {
    logger.debug('Deleting tasks', {
      deleteCount: response.deletedTaskIds.length,
      taskIds: response.deletedTaskIds,
    });
    await db.tasks.bulkDelete(response.deletedTaskIds);
  }

  logger.debug('Pull phase complete', {
    tasksProcessed: response.tasks.length,
    tasksDeleted: response.deletedTaskIds.length,
    conflictsCount: conflicts.length,
  });

  return {
    tasks: response.tasks,
    deletedTaskIds: response.deletedTaskIds,
    serverVectorClock: response.serverVectorClock,
    conflicts,
  };
}
