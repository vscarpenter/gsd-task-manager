/**
 * Pull engine: PocketBase -> local
 *
 * Fetches remote changes and applies them to local IndexedDB using LWW resolution.
 * Also reconciles deletions by comparing full remote index against local tasks.
 */

import { pocketBaseToTaskRecord } from './task-mapper';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { escapeFilterValue, getCurrentUserId, fetchRemoteTaskIndex, assertSafeRecordId, isRemoteNewerThanArchive, fetchBoundedRemoteTasks } from './pb-sync-helpers';
import type { RecordModel } from 'pocketbase';
import { classifyRemoteDeletion } from './queue';
import { toTrashedRecord } from '@/lib/trash';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import type { TaskRecord } from '@/lib/types';
import type { SyncQueueItem } from './types';

const logger = createLogger('SYNC_ENGINE');

/** Overlap window subtracted from the persisted cursor to avoid boundary misses. */
const CURSOR_OVERLAP_MS = 30 * 1000;

interface PreparedRemoteRecord {
  record: RecordModel;
  remoteTask: TaskRecord;
}

function prepareRemoteRecords(records: RecordModel[]): PreparedRemoteRecord[] {
  const prepared: PreparedRemoteRecord[] = [];
  for (const record of records) {
    const remoteTask = pocketBaseToTaskRecord(record, null);
    if (remoteTask) {
      prepared.push({ record, remoteTask });
    }
  }
  return prepared;
}

function findMaxAppliedClientUpdated(records: PreparedRemoteRecord[]): string | null {
  let maxTime = Number.NEGATIVE_INFINITY;
  const ceiling = Date.now() + SYNC_CONFIG.MAX_CLIENT_CLOCK_SKEW_MS;
  for (const { remoteTask } of records) {
    const parsed = new Date(remoteTask.updatedAt).getTime();
    if (!Number.isNaN(parsed)) maxTime = Math.max(maxTime, Math.min(parsed, ceiling));
  }
  return Number.isFinite(maxTime) ? new Date(maxTime).toISOString() : null;
}

async function applyPreparedRecord(
  db: ReturnType<typeof getDb>,
  prepared: PreparedRemoteRecord
): Promise<number> {
  const { record, remoteTask } = prepared;
  const archived = await db.archivedTasks.get(remoteTask.id);
  if (archived && !isRemoteNewerThanArchive(remoteTask.updatedAt, archived.archivedAt)) return 0;
  const deleted = await db.deletedTasks.get(remoteTask.id);
  if (deleted && !isRemoteNewerThanArchive(remoteTask.updatedAt, deleted.deletedAt)) return 0;

  const localTask = await db.tasks.get(remoteTask.id);
  const merged = localTask ? pocketBaseToTaskRecord(record, localTask) : remoteTask;
  if (!merged) return 0;
  const remoteWins = !localTask ||
    new Date(merged.updatedAt).getTime() > new Date(localTask.updatedAt).getTime();
  if (!remoteWins) return 0;
  if (archived) await db.archivedTasks.delete(remoteTask.id);
  if (deleted) await db.deletedTasks.delete(remoteTask.id);
  if (localTask) await db.tasks.put(merged);
  else await db.tasks.add(merged);
  return 1;
}

/**
 * Apply fetched remote records to local IndexedDB using LWW resolution.
 */
async function applyRemoteRecords(records: RecordModel[]): Promise<{
  pulledCount: number;
  skippedCount: number;
  appliedRecords: PreparedRemoteRecord[];
}> {
  const db = getDb();
  const acceptedRecords = prepareRemoteRecords(records);
  let pulledCount = 0;
  const appliedRecords: PreparedRemoteRecord[] = [];
  await db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks], async () => {
    for (const prepared of acceptedRecords) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one atomic Dexie transaction preserves tombstone/live invariants
      const applied = await applyPreparedRecord(db, prepared);
      pulledCount += applied;
      if (applied > 0) appliedRecords.push(prepared);
    }
  });
  return {
    pulledCount,
    skippedCount: records.length - acceptedRecords.length,
    appliedRecords,
  };
}

/**
 * Pull remote changes from PocketBase into local IndexedDB.
 * Fetches tasks whose client-stamped `client_updated_at` is at or past the cursor.
 * LWW: remote wins if remote client_updated_at > local updatedAt.
 */
export async function pullRemoteChanges(lastClientUpdatedAt: string | null): Promise<{ pulledCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, authenticated: false, maxObservedTimestamp: null };
  }

  assertSafeRecordId(ownerId, 'ownerId');

  let filter = `owner = "${escapeFilterValue(ownerId)}"`;
  if (lastClientUpdatedAt) {
    // PocketBase 0.23+ doesn't allow collection queries to sort/filter on the
    // system `updated` field. Keep the cursor on the same custom field as LWW.
    // `>=`, paired with the overlap below, re-catches boundary records.
    filter += ` && client_updated_at >= "${escapeFilterValue(lastClientUpdatedAt)}"`;
  }

  const records = await fetchBoundedRemoteTasks({
    filter,
    sort: 'client_updated_at,task_id,id',
  });

  const { pulledCount, skippedCount, appliedRecords } = await applyRemoteRecords(records);
  if (skippedCount > 0) {
    logger.warn('Skipped invalid remote records during pull', { skippedCount });
  }

  // Only records actually committed locally may advance the watermark.
  // Invalid, archive-suppressed, and LWW-skipped records remain eligible for
  // a later overlapping pull instead of poisoning the cursor.
  const maxApplied = findMaxAppliedClientUpdated(appliedRecords);
  const maxObservedTimestamp = maxApplied
    ? new Date(new Date(maxApplied).getTime() - CURSOR_OVERLAP_MS).toISOString()
    : null;

  await reconcileDeletedTasks(ownerId);

  logger.debug('Pull completed', { pulledCount, fetched: records.length });
  return { pulledCount, authenticated: true, maxObservedTimestamp };
}

/**
 * Remove local tasks that no longer exist remotely.
 * Tasks with pending sync operations are preserved.
 *
 * Self-healing by design: this re-fetches the remote index and deletes locals
 * absent from it. On a single PocketBase node, getFullList reflects committed
 * writes, so a task just pushed (and dequeued) in this same fullSync is present.
 * On a replicated/proxied backend, read-after-write lag could briefly hide such
 * a task and delete it locally. Recovery relies on the recently-pushed record's
 * `client_updated_at` falling inside the next pull's CURSOR_OVERLAP_MS window,
 * so it is re-fetched and re-added (it still exists remotely). The
 * pending-op guard below covers the common not-yet-pushed case directly.
 */
interface RemoteAbsencePlan {
  /** Tasks leaving `db.tasks`, whether trashed or dropped outright. */
  deleteIds: string[];
  /** Tasks whose never-pushed content is preserved in Trash instead of dropped. */
  trashRecords: TaskRecord[];
  /** Queue rows released with those tasks. */
  staleRowIds: string[];
}

function groupRowsByTaskId(rows: SyncQueueItem[]): Map<string, SyncQueueItem[]> {
  const grouped = new Map<string, SyncQueueItem[]>();
  for (const row of rows) {
    const existing = grouped.get(row.taskId);
    if (existing) existing.push(row);
    else grouped.set(row.taskId, [row]);
  }
  return grouped;
}

/**
 * Decide, for every local task the remote index no longer lists, whether it is
 * protected in place, dropped, or abandoned to Trash. Pure — the caller writes.
 */
function planRemoteAbsence(
  localTasks: TaskRecord[],
  remoteTaskIds: Set<string>,
  queueRows: SyncQueueItem[],
): RemoteAbsencePlan {
  const rowsByTaskId = groupRowsByTaskId(queueRows);
  const plan: RemoteAbsencePlan = { deleteIds: [], trashRecords: [], staleRowIds: [] };

  for (const local of localTasks) {
    if (remoteTaskIds.has(local.id)) continue;
    const { verdict, staleRowIds } = classifyRemoteDeletion(rowsByTaskId.get(local.id) ?? []);
    if (verdict === 'protect') continue;
    if (verdict === 'abandon') plan.trashRecords.push(toTrashedRecord(local));
    plan.staleRowIds.push(...staleRowIds);
    plan.deleteIds.push(local.id);
  }

  return plan;
}

async function reconcileDeletedTasks(ownerId: string): Promise<void> {
  const { index: remoteIndex, fetchSucceeded } = await fetchRemoteTaskIndex(ownerId);
  if (!fetchSucceeded) {
    logger.warn('Skipping deletion reconciliation: remote index unavailable');
    return;
  }

  const db = getDb();
  const remoteTaskIds = new Set(remoteIndex.keys());
  await db.transaction('rw', [db.tasks, db.deletedTasks, db.syncQueue], async () => {
    const [localTasks, queueRows] = await Promise.all([
      db.tasks.toArray(),
      db.syncQueue.toArray(),
    ]);
    const plan = planRemoteAbsence(localTasks, remoteTaskIds, queueRows);

    if (plan.trashRecords.length > 0) await db.deletedTasks.bulkPut(plan.trashRecords);
    if (plan.staleRowIds.length > 0) await db.syncQueue.bulkDelete(plan.staleRowIds);
    await db.tasks.bulkDelete(plan.deleteIds);

    if (plan.trashRecords.length > 0) {
      logger.warn('Abandoned retry-exhausted local edits to trash', {
        taskIds: plan.trashRecords.map((task) => task.id),
      });
    }
    logger.debug('Deleted locally: tasks removed from server', { count: plan.deleteIds.length });
  });
}
