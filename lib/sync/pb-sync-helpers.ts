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

/** Maximum allowed length for filter values to prevent query parser issues */
const MAX_FILTER_VALUE_LENGTH = 500;

/** Escape a string value for safe use in PocketBase filter expressions */
export function escapeFilterValue(value: string): string {
  if (value.length > MAX_FILTER_VALUE_LENGTH) {
    throw new Error(`Filter value exceeds maximum length of ${MAX_FILTER_VALUE_LENGTH}`);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Validate that a value matches a safe ID format for use in PocketBase filters.
 * Accepts PocketBase record IDs (15-char alphanumeric) and common test ID formats.
 * Rejects values containing filter syntax characters (", ', &&, ||, etc.)
 */
export function assertSafeRecordId(value: string, label = 'id'): void {
  if (value.length === 0 || value.length > 50) {
    throw new Error(`Invalid ${label} format: unexpected length`);
  }
  // Allow alphanumeric, hyphens, and underscores only
  if (!/^[a-z0-9_-]+$/i.test(value)) {
    throw new Error(`Invalid ${label} format: contains unsafe characters`);
  }
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
  assertSafeRecordId(ownerId, 'ownerId');
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
