/**
 * Sync enable functionality
 *
 * PocketBase SDK manages auth tokens automatically via localStorage.
 */

import { getSyncQueue } from "../queue";
import { createLogger } from "@/lib/logger";

const logger = createLogger('SYNC_CONFIG');

/**
 * Queue existing tasks for initial sync push
 */
async function queueExistingTasks(): Promise<void> {
  const queue = getSyncQueue();
  const populatedCount = await queue.populateFromExistingTasks();
  if (populatedCount > 0) {
    logger.info('Initial sync setup', { populatedCount });
  }
}

/**
 * Enable sync after successful PocketBase OAuth login
 *
 * Called from SyncAuthDialog after OAuth success.
 * PocketBase SDK already has the auth token stored, so the only
 * work left is queueing the existing tasks.
 */
export async function enableSync(): Promise<void> {
  // Queue existing local tasks for initial push
  await queueExistingTasks();

  logger.info('Sync enabled');
}
