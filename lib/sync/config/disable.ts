/**
 * Sync disable functionality
 *
 * Clears PB auth store, sync queue, and resets IndexedDB sync metadata.
 */

import { getDb } from "@/lib/db";
import { clearPocketBase } from "../pocketbase-client";
import type { PBSyncConfig } from "../types";
import { getSyncConfig } from "./get-set";
import { rememberForResurrect, trashDeleteTaskIds } from "../resurrect-ids";
import { createLogger } from "@/lib/logger";
import { clearAppCaches } from "@/lib/browser-cache";

const logger = createLogger('SYNC_CONFIG');

/**
 * Reset sync config to disabled state and wipe per-user sync artefacts.
 *
 * Important on shared/kiosk devices: the next user on the same browser
 * profile must not see the previous user's sync metadata, queued
 * operations, or sync-history entries (which carry device IDs, task
 * counts, and error messages that may contain task content).
 */
async function resetSyncConfigState(current: PBSyncConfig): Promise<void> {
  const db = getDb();
  const localTaskOwnerUserId = current.localTaskOwnerUserId ?? current.userId ?? null;

  // One transaction, the disabled config first: closing the tab partway must
  // never leave Trash deletes queued and unremembered behind a signed-out config.
  await db.transaction('rw', [db.syncMetadata, db.syncQueue, db.syncHistory], async () => {
    await db.syncMetadata.put({
      ...current,
      enabled: false,
      userId: null,
      email: null,
      provider: null,
      lastSyncAt: null,
      lastClientUpdatedAt: null,
      // The local rows stay, so the contract they were pulled under stays with
      // them. Only a completed pull may stamp a newer one (ADR 0019).
      pullCursorVersion: current.pullCursorVersion,
      lastServerUpdatedAt: null,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
      localTaskOwnerUserId,
      key: "sync_config",
    });

    // A Trash delete still queued now never reaches the server, so it counts as a
    // signed-out delete: remember its id before the queue goes (resurrect on sight).
    await rememberForResurrect(trashDeleteTaskIds(await db.syncQueue.toArray()));
    await db.syncQueue.clear();

    // Clear sync history, for privacy on shared devices.
    await db.syncHistory.clear();
  });
}

async function clearBrowserCaches(): Promise<void> {
  try {
    const clearedCaches = await clearAppCaches();
    if (clearedCaches.length > 0) {
      logger.info('Cleared app caches during sync disable', {
        clearedCacheCount: clearedCaches.length,
      });
    }
  } catch (err) {
    logger.warn('Failed to clear app caches during sync disable', {
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Disable sync (logout)
 */
export async function disableSync(): Promise<void> {
  const current = await getSyncConfig();

  if (!current) {
    clearPocketBase();
    await clearBrowserCaches();
    return;
  }

  // Persist the disabled config before any other awaited step. An in-flight
  // sync re-reads this row before each write, so it stops at the first await.
  await resetSyncConfigState(current);

  // Clear PocketBase auth state (token + localStorage)
  clearPocketBase();
  await clearBrowserCaches();

  logger.info('Sync disabled');
}
