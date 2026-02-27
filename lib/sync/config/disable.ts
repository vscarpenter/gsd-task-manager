/**
 * Sync disable functionality (Supabase backend)
 */

import { getDb } from "@/lib/db";
import { getCryptoManager } from "../crypto";
import type { SyncConfig } from "../types";
import { getSyncConfig } from "./get-set";
import { stopRealtimeListener } from "../realtime-listener";
import { getSupabaseClient } from "@/lib/supabase";
import { createLogger } from "@/lib/logger";

const logger = createLogger('SYNC_CONFIG');

/**
 * Reset sync config to disabled state
 */
async function resetSyncConfigState(current: SyncConfig): Promise<void> {
  const db = getDb();

  await db.syncMetadata.put({
    ...current,
    enabled: false,
    userId: null,
    email: null,
    lastSyncAt: null,
    key: "sync_config",
  } satisfies SyncConfig);

  // Clear sync queue
  await db.syncQueue.clear();
}

/**
 * Disable sync (logout)
 */
export async function disableSync(): Promise<void> {
  const current = await getSyncConfig();

  if (!current) {
    return;
  }

  // Stop Realtime listener
  stopRealtimeListener();

  // Clear crypto key
  const crypto = getCryptoManager();
  crypto.clear();

  // Sign out of Supabase
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    logger.warn('Supabase sign out failed (may not have been signed in)');
  }

  // Reset config
  await resetSyncConfigState(current);

  logger.info('Sync disabled');
}
