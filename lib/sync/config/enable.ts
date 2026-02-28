/**
 * Sync enable functionality
 *
 * Simplified for PocketBase: no crypto init or API client token setup.
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
 * Start health monitoring
 */
async function startHealthMonitor(): Promise<void> {
  const { getHealthMonitor } = await import("../health-monitor");
  const healthMonitor = getHealthMonitor();

  if (!healthMonitor.isActive()) {
    logger.info('Starting health monitor (sync enabled)');
    healthMonitor.start();
  }
}

/**
 * Enable sync after successful PocketBase OAuth login
 *
 * Called from SyncAuthDialog after OAuth success.
 * PocketBase SDK already has the auth token stored — we just
 * need to queue existing tasks and start the health monitor.
 */
export async function enableSync(): Promise<void> {
  // Queue existing local tasks for initial push
  await queueExistingTasks();

  // Start health monitor
  await startHealthMonitor();

  logger.info('Sync enabled');
}
