import { getDb } from '@/lib/db';
import { generateId } from '@/lib/id-generator';
import { toTrashedRecord } from '@/lib/trash';
import { forgetForResurrect } from './resurrect-ids';
import { isPendingSyncQueueItem } from './queue';
import { assertSyncSessionCurrent } from './sync-session';
import type { SyncQueueItem } from './types';

type RecoveryResult = 'queued' | 'dismissed' | 'trashed' | 'missing';

/** Manual retries use the current row; a fresh id invalidates captured push snapshots. */
async function retryItem(item: SyncQueueItem): Promise<RecoveryResult> {
  const db = getDb();
  const current = await db.tasks.get(item.taskId);
  if (!current && item.operation !== 'delete') return 'missing';
  await db.syncQueue.add({
    id: generateId(), taskId: item.taskId,
    operation: current ? 'update' : 'delete',
    timestamp: current ? Date.now() : item.timestamp,
    payload: current ?? item.payload,
    retryCount: 0, status: 'pending',
  });
  return 'queued';
}

/** Dismiss preserves the unsynced content in Trash and leaves the cloud copy alone. */
async function dismissItem(taskId: string): Promise<RecoveryResult> {
  const db = getDb();
  const current = await db.tasks.get(taskId);
  if (!current) return 'dismissed';
  await db.tasks.delete(taskId);
  await db.archivedTasks.delete(taskId);
  await db.deletedTasks.put(toTrashedRecord(current));
  await forgetForResurrect([taskId]);
  return 'trashed';
}

/** Session check, queue replacement and lifecycle move commit together. */
export async function recoverFailedSyncItem(
  id: string, ownerId: string, action: 'retry' | 'dismiss',
): Promise<RecoveryResult> {
  const db = getDb();
  return db.transaction('rw', [db.tasks, db.archivedTasks, db.deletedTasks, db.syncQueue, db.syncMetadata], async () => {
    await assertSyncSessionCurrent(ownerId);
    const item = await db.syncQueue.get(id);
    if (!item || item.status !== 'failed') return 'missing';
    const rows = await db.syncQueue.where('taskId').equals(item.taskId).toArray();
    await db.syncQueue.bulkDelete(rows.filter((row) => row.status === 'failed').map((row) => row.id));
    if (rows.some(isPendingSyncQueueItem)) return action === 'retry' ? 'queued' : 'dismissed';
    return action === 'retry' ? retryItem(item) : dismissItem(item.taskId);
  });
}
