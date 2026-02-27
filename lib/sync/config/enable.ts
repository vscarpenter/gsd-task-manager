/**
 * Sync enable functionality (Supabase backend)
 */

import { getDb } from "@/lib/db";
import { getCryptoManager } from "../crypto";
import { getSyncQueue } from "../queue";
import type { SyncConfig } from "../types";
import { getSyncConfig, updateAutoSyncConfig } from "./get-set";
import { createLogger } from "@/lib/logger";

const logger = createLogger('SYNC_CONFIG');

/**
 * Initialize crypto manager with user password
 */
async function initializeCrypto(password: string, salt: string): Promise<void> {
  const crypto = getCryptoManager();
  await crypto.deriveKey(password, salt);
}

/**
 * Queue existing tasks for initial sync
 */
async function queueExistingTasks(): Promise<void> {
  const db = getDb();
  const taskCount = await db.tasks.count();

  if (taskCount > 0) {
    const queue = getSyncQueue();
    const populatedCount = await queue.populateFromExistingTasks();
    logger.info('Initial sync setup', { populatedCount });
  }
}

/**
 * Enable sync (called after successful Supabase OAuth)
 */
export async function enableSync(
  userId: string,
  email: string,
  salt: string,
  password: string,
  provider?: string
): Promise<void> {
  const current = await getSyncConfig();

  if (!current) {
    throw new Error("Sync config not initialized");
  }

  // Initialize crypto manager with password
  await initializeCrypto(password, salt);

  // Update config with auth credentials
  const db = getDb();
  await db.syncMetadata.put({
    ...current,
    enabled: true,
    userId,
    email,
    provider: provider ?? null,
    key: "sync_config",
  } satisfies SyncConfig);

  // Set default auto-sync config if not present
  if (current.autoSyncEnabled === undefined) {
    await updateAutoSyncConfig(true, 2);
  }

  // Queue existing tasks for initial sync
  await queueExistingTasks();

  logger.info('Sync enabled', { userId, email });
}
