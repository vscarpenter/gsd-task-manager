/**
 * Pull engine: PocketBase -> local
 *
 * Fetches remote changes and applies them to local IndexedDB using LWW resolution.
 * Also reconciles deletions by comparing full remote index against local tasks.
 */

import { getPocketBase } from './pocketbase-client';
import { pocketBaseToTaskRecord } from './task-mapper';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { escapeFilterValue, getCurrentUserId, fetchRemoteTaskIndex, assertSafeRecordId } from './pb-sync-helpers';
import type { RecordModel } from 'pocketbase';

const logger = createLogger('SYNC_ENGINE');

/** Five minutes — anything further into the future is treated as clock skew. */
const FUTURE_TIMESTAMP_CLAMP_MS = 5 * 60 * 1000;

/** Overlap window subtracted from the persisted cursor to avoid boundary misses. */
const CURSOR_OVERLAP_MS = 30 * 1000;

/**
 * Clamp a client-supplied timestamp so it cannot exceed `now + 5min`.
 * Anything further into the future is treated as clock skew, not a real event.
 * A NaN/malformed input falls back to the current time.
 */
function clampFutureTimestamp(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return new Date().toISOString();
  const ceiling = Date.now() + FUTURE_TIMESTAMP_CLAMP_MS;
  return ts > ceiling ? new Date(ceiling).toISOString() : iso;
}

/** Find the max client_updated_at across records that were successfully applied. */
function findMaxAppliedTimestamp(appliedRecords: RecordModel[]): string | null {
  let max: string | null = null;
  for (const record of appliedRecords) {
    const raw = record['client_updated_at'] as string | undefined;
    if (!raw) continue;
    const clamped = clampFutureTimestamp(raw);
    if (!max || clamped > max) max = clamped;
  }
  return max;
}

/**
 * Apply fetched remote records to local IndexedDB using LWW resolution.
 * Returns the records that were actually applied (post-validation, post-LWW)
 * so the caller can compute a cursor from real, persisted events only.
 */
async function applyRemoteRecords(records: RecordModel[]): Promise<{
  appliedRecords: RecordModel[];
  pulledCount: number;
  skippedCount: number;
}> {
  const db = getDb();
  // First pass: validate records without local state (just to filter invalid ones)
  const validRecords: RecordModel[] = [];
  for (const record of records) {
    const test = pocketBaseToTaskRecord(record, null);
    if (test) {
      validRecords.push(record);
    }
  }

  const skippedCount = records.length - validRecords.length;

  // Pre-fetch matching local tasks in bulk to preserve device-local fields
  const taskIds = validRecords.map(r => r['task_id'] as string);
  const localTasksRaw = await db.tasks.bulkGet(taskIds);
  const localTaskMap = new Map(
    localTasksRaw
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .map(t => [t.id, t])
  );

  const appliedRecords: RecordModel[] = [];
  let pulledCount = 0;

  for (const record of validRecords) {
    const taskId = record['task_id'] as string;
    const localTask = localTaskMap.get(taskId);
    const remoteTask = pocketBaseToTaskRecord(record, localTask ?? null);
    if (!remoteTask) continue;

    if (!localTask) {
      await db.tasks.add(remoteTask);
      appliedRecords.push(record);
      pulledCount++;
    } else {
      const remoteTime = new Date(remoteTask.updatedAt).getTime();
      const localTime = new Date(localTask.updatedAt).getTime();
      if (remoteTime >= localTime) {
        await db.tasks.put(remoteTask);
        appliedRecords.push(record);
        pulledCount++;
      }
    }
  }

  return { appliedRecords, pulledCount, skippedCount };
}

/**
 * Pull remote changes from PocketBase into local IndexedDB.
 * Fetches tasks updated after the last sync timestamp.
 * LWW: remote wins if remote client_updated_at >= local updatedAt.
 */
export async function pullRemoteChanges(lastSyncAt: string | null): Promise<{ pulledCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const pb = getPocketBase();
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, authenticated: false, maxObservedTimestamp: null };
  }

  assertSafeRecordId(ownerId, 'ownerId');

  let filter = `owner = "${escapeFilterValue(ownerId)}"`;
  if (lastSyncAt) {
    // `>=` (paired with the 30s overlap subtracted when persisting the cursor)
    // protects against boundary misses caused by clock drift across devices.
    // Re-fetched records are no-ops via LWW.
    filter += ` && client_updated_at >= "${escapeFilterValue(lastSyncAt)}"`;
  }

  const records = await pb.collection('tasks').getFullList({
    filter,
    sort: '-client_updated_at',
  });

  const { appliedRecords, pulledCount, skippedCount } = await applyRemoteRecords(records);
  if (skippedCount > 0) {
    logger.warn('Skipped invalid remote records during pull', { skippedCount });
  }

  // Advance the cursor only from records we actually applied — never from
  // skipped/invalid ones — and subtract a 30s overlap window so the next
  // pull's `>=` filter catches anything written near the boundary.
  const maxApplied = findMaxAppliedTimestamp(appliedRecords);
  const maxObservedTimestamp = maxApplied
    ? new Date(new Date(maxApplied).getTime() - CURSOR_OVERLAP_MS).toISOString()
    : null;

  await reconcileDeletedTasks(ownerId);

  logger.info('Pull completed', { pulledCount, fetched: records.length });
  return { pulledCount, authenticated: true, maxObservedTimestamp };
}

/**
 * Remove local tasks that no longer exist remotely.
 * Tasks with pending sync operations are preserved.
 */
async function reconcileDeletedTasks(ownerId: string): Promise<void> {
  const { index: remoteIndex, fetchSucceeded } = await fetchRemoteTaskIndex(ownerId);
  if (!fetchSucceeded) {
    logger.warn('Skipping deletion reconciliation: remote index unavailable');
    return;
  }

  const db = getDb();
  const localTasks = await db.tasks.toArray();
  const remoteTaskIds = new Set(remoteIndex.keys());

  const allPendingOps = await db.syncQueue.toArray();
  const pendingTaskIds = new Set(allPendingOps.map(op => op.taskId));

  for (const local of localTasks) {
    if (!remoteTaskIds.has(local.id) && !pendingTaskIds.has(local.id)) {
      await db.tasks.delete(local.id);
      logger.debug('Deleted locally: task removed from server', { taskId: local.id });
    }
  }
}
