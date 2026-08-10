/**
 * Shared helpers for PocketBase sync operations.
 */

import { getPocketBase, getCurrentUserId } from './pocketbase-client';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { PBSyncConfig, RemoteTaskIndexEntry } from './types';
import { getPocketBaseTaskIdentity } from './task-mapper';

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
 * Fetch all existing remote task records for the current user in one request.
 * Returns a Map of task_id -> { pbRecordId, clientUpdatedAt } for efficient
 * lookups + LWW timestamp comparison in the push path.
 */
export async function fetchRemoteTaskIndex(ownerId: string): Promise<{
  index: Map<string, RemoteTaskIndexEntry>;
  fetchSucceeded: boolean;
}> {
  assertSafeRecordId(ownerId, 'ownerId');
  const pb = getPocketBase();
  const index = new Map<string, RemoteTaskIndexEntry>();

  try {
    const records = await pb.collection('tasks').getFullList({
      filter: `owner = "${escapeFilterValue(ownerId)}"`,
      fields: 'id,task_id,client_updated_at',
    });
    for (const r of records) {
      const identity = getPocketBaseTaskIdentity(r);
      if (identity) {
        index.set(identity.taskId, {
          pbRecordId: identity.pbRecordId,
          clientUpdatedAt: identity.clientUpdatedAt,
        });
      }
    }
    return { index, fetchSucceeded: true };
  } catch {
    logger.warn('Could not fetch remote task index; will check individually');
    return { index, fetchSucceeded: false };
  }
}

export async function fetchRemoteTaskEntry(
  ownerId: string,
  taskId: string
): Promise<{ entry: RemoteTaskIndexEntry | null; fetchSucceeded: boolean }> {
  assertSafeRecordId(ownerId, 'ownerId');
  assertSafeRecordId(taskId, 'taskId');
  const pb = getPocketBase();
  try {
    const record = await pb.collection('tasks').getFirstListItem(
      `owner = "${escapeFilterValue(ownerId)}" && task_id = "${escapeFilterValue(taskId)}"`,
      { fields: 'id,task_id,client_updated_at' }
    );
    const identity = getPocketBaseTaskIdentity(record);
    return {
      entry: identity ? {
        pbRecordId: identity.pbRecordId,
        clientUpdatedAt: identity.clientUpdatedAt,
      } : null,
      fetchSucceeded: Boolean(identity),
    };
  } catch (error) {
    if ((error as { status?: number })?.status === 404) {
      return { entry: null, fetchSucceeded: true };
    }
    logger.warn('Could not fetch fresh remote task entry');
    return { entry: null, fetchSucceeded: false };
  }
}

/**
 * Decide whether a remote edit outranks a local archive.
 *
 * Archiving a task enqueues a remote delete, but `pb-push` abandons that delete
 * as stale when the remote was modified after the delete was queued — the
 * engine's edit-beats-delete LWW rule. The pull and realtime paths therefore
 * treat `archivedTasks` as a *conditional* tombstone: it suppresses a remote
 * record only while that record is no newer than the archive decision.
 *
 * Returns false for missing or unparseable timestamps so an unprovable claim
 * never resurrects a task — the archive stands unless the remote is demonstrably
 * newer. Shared by both apply paths so the two guards cannot drift apart.
 */
export function isRemoteNewerThanArchive(
  remoteUpdatedAt: string | undefined,
  archivedAt: string | undefined,
): boolean {
  if (!remoteUpdatedAt || !archivedAt) return false;
  const remoteTime = new Date(remoteUpdatedAt).getTime();
  const archivedTime = new Date(archivedAt).getTime();
  if (Number.isNaN(remoteTime) || Number.isNaN(archivedTime)) return false;
  return remoteTime > archivedTime;
}
