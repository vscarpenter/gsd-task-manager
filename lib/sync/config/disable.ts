/**
 * Sync disable functionality
 *
 * Clears PB auth store, sync queue, and resets IndexedDB sync metadata.
 */

import { getDb } from "@/lib/db";
import { clearPocketBase } from "../pocketbase-client";
import type { PBSyncConfig } from "../types";
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
 *
 * Returns false, and writes nothing, when no sync_config row exists.
 */
async function resetSyncConfigState(): Promise<boolean> {
  const db = getDb();

  // One transaction, the disabled config first: closing the tab partway must
  // never leave Trash deletes queued and unremembered behind a signed-out config.
  // The row is read here too. A copy read before the transaction could predate
  // a sign-in, and the signed-out row would then forget whose tasks these are.
  return db.transaction('rw', [db.syncMetadata, db.syncQueue, db.syncHistory], async () => {
    const current = (await db.syncMetadata.get('sync_config')) as PBSyncConfig | undefined;
    if (!current) return false;
    const localTaskOwnerUserId = current.localTaskOwnerUserId ?? current.userId ?? null;

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
    return true;
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
  // Persist the disabled config before any other awaited step. An in-flight
  // sync re-reads this row before each local write and before each pushed row,
  // so it stops at its next step. A request already sent still completes.
  const hadConfig = await resetSyncConfigState();

  // Clear PocketBase auth state (token + localStorage)
  clearPocketBase();
  await clearBrowserCaches();

  if (hadConfig) logger.info('Sync disabled');
}
