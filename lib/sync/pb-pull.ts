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

/** Overlap window subtracted from the persisted cursor to avoid boundary misses. */
const CURSOR_OVERLAP_MS = 30 * 1000;

/** PocketBase date fields use a space separator: "2026-06-10 18:55:13.123Z". */
function toPocketBaseDate(iso: string): string {
  return iso.replace('T', ' ');
}

/** Normalize a PocketBase date back to ISO form so `new Date()` parses it everywhere. */
function fromPocketBaseDate(pbDate: string): string {
  return pbDate.replace(' ', 'T');
}

/**
 * Find the max server-stamped `updated` across all fetched records.
 * Every fetched record advances the watermark — including LWW no-ops, which
 * never need re-fetching. No clock-skew clamp is needed: a single server
 * clock cannot skew against itself.
 */
function findMaxServerUpdated(records: RecordModel[]): string | null {
  let max: string | null = null;
  for (const record of records) {
    const raw = record['updated'] as string | undefined;
    if (!raw) continue;
    const iso = fromPocketBaseDate(raw);
    if (!max || iso > max) max = iso;
  }
  return max;
}

/**
 * Apply fetched remote records to local IndexedDB using LWW resolution.
 */
async function applyRemoteRecords(records: RecordModel[]): Promise<{
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

  let pulledCount = 0;

  for (const record of validRecords) {
    const taskId = record['task_id'] as string;
    const localTask = localTaskMap.get(taskId);
    const remoteTask = pocketBaseToTaskRecord(record, localTask ?? null);
    if (!remoteTask) continue;

    if (!localTask) {
      await db.tasks.add(remoteTask);
      pulledCount++;
    } else {
      const remoteTime = new Date(remoteTask.updatedAt).getTime();
      const localTime = new Date(localTask.updatedAt).getTime();
      if (remoteTime > localTime) {
        await db.tasks.put(remoteTask);
        pulledCount++;
      }
    }
  }

  return { pulledCount, skippedCount };
}

/**
 * Pull remote changes from PocketBase into local IndexedDB.
 * Fetches tasks whose server-stamped `updated` is at or past the cursor.
 * LWW: remote wins if remote client_updated_at > local updatedAt.
 */
export async function pullRemoteChanges(lastServerUpdatedAt: string | null): Promise<{ pulledCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const pb = getPocketBase();
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, authenticated: false, maxObservedTimestamp: null };
  }

  assertSafeRecordId(ownerId, 'ownerId');

  let filter = `owner = "${escapeFilterValue(ownerId)}"`;
  if (lastServerUpdatedAt) {
    // `updated` is PocketBase's server-stamped autodate, so a device with a
    // skewed clock can never write a record behind this cursor. `>=` (paired
    // with the 30s overlap subtracted when persisting the cursor) re-catches
    // boundary records; re-fetches are no-ops via LWW.
    filter += ` && updated >= "${escapeFilterValue(toPocketBaseDate(lastServerUpdatedAt))}"`;
  }

  const records = await pb.collection('tasks').getFullList({
    filter,
    sort: 'updated',
  });

  const { pulledCount, skippedCount } = await applyRemoteRecords(records);
  if (skippedCount > 0) {
    logger.warn('Skipped invalid remote records during pull', { skippedCount });
  }

  // Advance the cursor from everything fetched — the server watermark covers
  // LWW no-ops too — minus a 30s overlap so the next pull's `>=` filter
  // catches anything written near the boundary.
  const maxFetched = findMaxServerUpdated(records);
  const maxObservedTimestamp = maxFetched
    ? new Date(new Date(maxFetched).getTime() - CURSOR_OVERLAP_MS).toISOString()
    : null;

  await reconcileDeletedTasks(ownerId);

  logger.debug('Pull completed', { pulledCount, fetched: records.length });
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
