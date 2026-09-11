/**
 * Sync session fence.
 *
 * A sync belongs to the account that was signed in when it started. Sign-out,
 * Reset Everything, and a new sign-in all rewrite the persisted sync_config row.
 * Every sync write re-reads that row inside its own Dexie transaction and stops
 * once sync is off or the row names another account. Reading persisted state
 * instead of memory also covers a second tab and a sync that outlives a reload.
 */

import { getDb } from '@/lib/db';
import type { PBSyncConfig } from './types';

/** Thrown when a sync write belongs to a session that has already ended. */
export class StaleSyncSessionError extends Error {
  constructor() {
    super('Sync session ended before this write');
    this.name = 'StaleSyncSessionError';
  }
}

/** The account a sync runs for, or null when no signed-in sync session exists. */
export function getSessionOwner(config: PBSyncConfig | undefined): string | null {
  if (!config?.enabled || !config.userId) return null;
  return config.userId;
}

/**
 * Throw unless sync_config still names `ownerId` as the enabled account.
 * Call it before the first write, inside a transaction that scopes
 * db.syncMetadata, so the check and the write commit or abort together.
 */
export async function assertSyncSessionCurrent(ownerId: string): Promise<void> {
  const config = (await getDb().syncMetadata.get('sync_config')) as PBSyncConfig | undefined;
  if (getSessionOwner(config) !== ownerId) {
    throw new StaleSyncSessionError();
  }
}
