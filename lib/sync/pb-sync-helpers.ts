/**
 * Shared helpers for PocketBase sync operations.
 */

import { getPocketBase, getCurrentUserId } from './pocketbase-client';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { PBSyncConfig } from './types';

const logger = createLogger('SYNC_ENGINE');

/** Delay between API requests to avoid PocketBase rate limiting (429) */
export const THROTTLE_MS = 100;

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Escape a string value for safe use in PocketBase filter expressions */
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Get the current device ID from sync config in IndexedDB */
export async function getDeviceId(): Promise<string> {
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');
  return (config as PBSyncConfig | undefined)?.deviceId ?? 'unknown';
}

/** Get the current authenticated user ID, or null */
export { getCurrentUserId };

/**
 * Fetch all existing remote task_ids for the current user in one request.
 * Returns a Map of task_id -> PocketBase record id for efficient lookups.
 */
export async function fetchRemoteTaskIndex(ownerId: string): Promise<{ index: Map<string, string>; fetchSucceeded: boolean }> {
  const pb = getPocketBase();
  const index = new Map<string, string>();

  try {
    const records = await pb.collection('tasks').getFullList({
      filter: `owner = "${escapeFilterValue(ownerId)}"`,
      fields: 'id,task_id',
    });
    for (const r of records) {
      index.set(r['task_id'] as string, r.id);
    }
    return { index, fetchSucceeded: true };
  } catch {
    logger.warn('Could not fetch remote task index; will check individually');
    return { index, fetchSucceeded: false };
  }
}
