/**
 * The one way a sync push writes a task to PocketBase. A queue row records what
 * changed when it was queued, and you can restore or delete the task after that.
 * So each write needs a claim, taken against where the task lives now.
 */

import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { OwnerConfirmed } from './pb-sync-helpers';
import { getPocketBase } from './pocketbase-client';
import { isPendingSyncQueueItem } from './queue';
import { assertSyncSessionCurrent } from './sync-session';
import type { PBTaskRecord } from './task-mapper';

const logger = createLogger('SYNC_ENGINE');

type WriteKind = 'upsert' | 'delete';

// The class isn't exported and its member is private, so no other module can make a claim.
class Claim<K extends WriteKind> {
  constructor(private readonly kind: K) {}
}

const taskPath = (recordId: string): string => `/api/gsd/tasks/${encodeURIComponent(recordId)}`;

/**
 * An upsert needs a live task and a delete needs a task that isn't live. A row
 * that says otherwise is stale, so it leaves the queue in the same transaction.
 * Null means send nothing.
 */
export async function claimQueuedWrite<K extends WriteKind>(
  kind: K, queueId: string, ownerId: string,
): Promise<Claim<K> | null> {
  const db = getDb();
  return db.transaction('rw', [db.syncMetadata, db.syncQueue, db.tasks], async () => {
    await assertSyncSessionCurrent(ownerId);
    const row = await db.syncQueue.get(queueId);
    if (!row || !isPendingSyncQueueItem(row)) return null;
    const isLive = Boolean(await db.tasks.get(row.taskId));
    if (isLive === (kind === 'upsert')) return new Claim(kind);
    await db.syncQueue.delete(row.id);
    logger.info('Dropped a queued write that no longer matches the task', {
      taskId: row.taskId,
      operation: row.operation,
    });
    return null;
  });
}

export async function sendTaskUpdate(
  _claim: Claim<'upsert'>, recordId: string, expectedVersion: string | undefined, data: Partial<PBTaskRecord>,
): Promise<void> {
  await getPocketBase().send(taskPath(recordId), {
    method: 'PATCH', body: { expected_version: expectedVersion, data },
  });
}

export async function sendTaskCreate(
  _claim: Claim<'upsert'>, _absent: OwnerConfirmed, data: Partial<PBTaskRecord>,
): Promise<string> {
  return (await getPocketBase().collection('tasks').create(data)).id;
}

export async function sendTaskDelete(
  _claim: Claim<'delete'>, recordId: string, expectedVersion: string,
): Promise<void> {
  await getPocketBase().send(taskPath(recordId), {
    method: 'DELETE', body: { expected_version: expectedVersion },
  });
}
