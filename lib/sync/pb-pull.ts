/**
 * Pull engine: PocketBase -> local
 *
 * Fetches remote changes and applies them to local IndexedDB using LWW resolution.
 * Also reconciles deletions by comparing full remote index against local tasks.
 */

import { pocketBaseToTaskRecord } from './task-mapper';
import { getDb } from '@/lib/db';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { createLogger } from '@/lib/logger';
import { escapeFilterValue, getCurrentUserId, fetchRemoteTaskIndex, confirmSessionIdentity, assertSafeRecordId, holdsOffFarFutureRemote, isRemoteNewerThanArchive, fetchBoundedRemoteTasks, readClientUpdatedAt } from './pb-sync-helpers';
import type { RecordModel } from 'pocketbase';
import { classifyRemoteDeletion } from './queue';
import { assertSyncSessionCurrent } from './sync-session';
import { toTrashedRecord } from '@/lib/trash';
import { savedPlacementBlocker } from '@/lib/tasks/saved-placement';
import type { TaskRecord } from '@/lib/types';
import type { SyncQueueItem } from './types';

const logger = createLogger('SYNC_ENGINE');

/** Overlap window subtracted from the persisted cursor to avoid boundary misses. */
const CURSOR_OVERLAP_MS = 30 * 1000;

export interface PullOptions {
  /**
   * Also merge records at the same version as the local row: the one full
   * pull after a pull contract bump, when a local row may lack a field an
   * older build never read (SYNC_CONFIG.PULL_CURSOR_VERSION).
   */
  mergeSameVersion?: boolean;
  /**
   * The pull contract the local rows were stored under, or undefined when an
   * older build left none. It decides which empty fields mean "never read".
   */
  storedContractVersion?: number;
}

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

function findMaxAppliedClientUpdated(records: PreparedRemoteRecord[], nowMs: number = Date.now()): string | null {
  let maxTime = Number.NEGATIVE_INFINITY;
  for (const { remoteTask } of records) {
    const parsed = new Date(remoteTask.updatedAt).getTime();
    // The cursor is a lower bound for the next pull. A clock a few minutes
    // fast must not move that bound ahead of real time, or edits stamped in
    // the gap are never fetched.
    if (!Number.isNaN(parsed)) maxTime = Math.max(maxTime, Math.min(parsed, nowMs));
  }
  return Number.isFinite(maxTime) ? new Date(maxTime).toISOString() : null;
}

/**
 * LWW: a strictly newer remote wins. A same-version remote is the version this
 * client already holds, so it is accepted only while backfilling, when the
 * local copy may lack a field an older build never read.
 */
function acceptsRemoteVersion(remoteUpdatedAt: string, localUpdatedAt: string, mergeSameVersion: boolean): boolean {
  const remote = new Date(remoteUpdatedAt).getTime();
  const local = new Date(localUpdatedAt).getTime();
  return remote > local || (mergeSameVersion && remote === local);
}

/**
 * During a backfill, a local copy that wins keeps its own version but takes the
 * fields its build never read. An empty savedAt means "never read" only on a
 * row stored before the contract that added saved_at; after it, the empty
 * value is a real Return. Returns the repaired row, or null to leave it alone.
 */
export function copyUnreadFields(
  local: TaskRecord,
  remote: TaskRecord,
  storedContractVersion: number | undefined,
): TaskRecord | null {
  const neverReadSavedAt = (storedContractVersion ?? 0) < SYNC_CONFIG.SAVED_AT_CONTRACT_VERSION;
  if (!neverReadSavedAt || local.savedAt || !remote.savedAt) return null;
  // A newer completion or running timer outranks an older Save. The row stays
  // in the matrix and its push clears saved_at, rather than spreading a
  // completed task in Saved.
  if (savedPlacementBlocker(local)) return null;
  return { ...local, savedAt: remote.savedAt };
}

/** PullOptions with its defaults applied, as the per-record merge uses them. */
interface BackfillPlan {
  mergeSameVersion: boolean;
  storedContractVersion: number | undefined;
}

/**
 * A local copy that wins (strictly newer, or holding off a far-future remote)
 * keeps its version. A backfill still repairs the fields its build never
 * read. That's a repair, not a pull of the record, so it doesn't count as
 * pulled and doesn't move the cursor.
 */
async function repairUnreadFields(
  db: ReturnType<typeof getDb>,
  local: TaskRecord | undefined,
  remote: TaskRecord,
  plan: BackfillPlan,
): Promise<void> {
  if (!local || !plan.mergeSameVersion) return;
  const repaired = copyUnreadFields(local, remote, plan.storedContractVersion);
  if (repaired) await db.tasks.put(repaired);
}

async function remoteVersionWins(
  db: ReturnType<typeof getDb>,
  local: TaskRecord | undefined,
  merged: TaskRecord,
  rawUpdatedAt: string | undefined,
  plan: BackfillPlan,
): Promise<boolean> {
  if (!local) return true;
  if (await holdsOffFarFutureRemote(rawUpdatedAt, local.id)) return false;
  return acceptsRemoteVersion(merged.updatedAt, local.updatedAt, plan.mergeSameVersion);
}

async function applyPreparedRecord(
  db: ReturnType<typeof getDb>,
  prepared: PreparedRemoteRecord,
  plan: BackfillPlan,
): Promise<number> {
  const { record, remoteTask } = prepared;
  const rawUpdatedAt = readClientUpdatedAt(record);
  const archived = await db.archivedTasks.get(remoteTask.id);
  if (archived && !isRemoteNewerThanArchive(rawUpdatedAt, archived.archivedAt)) return 0;
  const deleted = await db.deletedTasks.get(remoteTask.id);
  if (deleted && !isRemoteNewerThanArchive(rawUpdatedAt, deleted.deletedAt)) return 0;

  const localTask = await db.tasks.get(remoteTask.id);
  const merged = localTask ? pocketBaseToTaskRecord(record, localTask) : remoteTask;
  if (!merged) return 0;
  const remoteWins = await remoteVersionWins(db, localTask, merged, rawUpdatedAt, plan);
  if (!remoteWins) {
    await repairUnreadFields(db, localTask, remoteTask, plan);
    return 0;
  }
  if (archived) await db.archivedTasks.delete(remoteTask.id);
  if (deleted) await db.deletedTasks.delete(remoteTask.id);
  if (localTask) await db.tasks.put(merged);
  else await db.tasks.add(merged);
  return 1;
}

/**
 * Apply fetched remote records to local IndexedDB using LWW resolution.
 * The fetch may have outlived a sign-out, so nothing is written unless
 * `ownerId` still owns the sync session inside the transaction.
 */
async function applyRemoteRecords(records: RecordModel[], ownerId: string, plan: BackfillPlan): Promise<{
  pulledCount: number;
  skippedCount: number;
  appliedRecords: PreparedRemoteRecord[];
}> {
  const db = getDb();
  const acceptedRecords = prepareRemoteRecords(records);
  let pulledCount = 0;
  const appliedRecords: PreparedRemoteRecord[] = [];
  // syncQueue is read for the far-future hold-off, inside the same transaction.
  await db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks, db.syncQueue, db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
    for (const prepared of acceptedRecords) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one atomic Dexie transaction preserves tombstone/live invariants
      const applied = await applyPreparedRecord(db, prepared, plan);
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
 * LWW: remote wins if remote client_updated_at > local updatedAt, or is equal
 * while `mergeSameVersion` backfills a newly synced field.
 * Throws StaleSyncSessionError when the user's session ends before a write.
 * `skippedCount` is how many fetched records could not be applied; a pull that
 * skipped any is not a whole pull, and work that needs one must not run on it.
 */
export async function pullRemoteChanges(
  lastClientUpdatedAt: string | null,
  options: PullOptions = {},
): Promise<{ pulledCount: number; skippedCount: number; authenticated: boolean; maxObservedTimestamp: string | null }> {
  const ownerId = getCurrentUserId();

  if (!ownerId) {
    logger.warn('Pull skipped: not authenticated');
    return { pulledCount: 0, skippedCount: 0, authenticated: false, maxObservedTimestamp: null };
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

  const { pulledCount, skippedCount, appliedRecords } = await applyRemoteRecords(records, ownerId, {
    mergeSameVersion: options.mergeSameVersion ?? false,
    storedContractVersion: options.storedContractVersion,
  });
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
  return { pulledCount, skippedCount, authenticated: true, maxObservedTimestamp };
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

  // An empty listing is also what a rejected token gets, so before anything is
  // deleted the session is confirmed. Nothing to delete means no extra request.
  // Any failure here propagates: the sync reports an error and deletes nothing.
  const [candidates, candidateQueueRows] = await Promise.all([db.tasks.toArray(), db.syncQueue.toArray()]);
  if (planRemoteAbsence(candidates, remoteTaskIds, candidateQueueRows).deleteIds.length === 0) return;
  await confirmSessionIdentity(ownerId);

  await db.transaction('rw', [db.tasks, db.deletedTasks, db.syncQueue, db.syncMetadata], async () => {
    // The index fetch may have outlived a sign-out; delete nothing for a past session.
    await assertSyncSessionCurrent(ownerId);
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
