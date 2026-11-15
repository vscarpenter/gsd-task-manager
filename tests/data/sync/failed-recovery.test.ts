import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { recoverFailedSyncItem } from '@/lib/sync/failed-recovery';
import { localRow, signedIn, SAVED } from './support/fake-pocketbase';
import type { SyncQueueItem } from '@/lib/sync/types';

const failed = (overrides: Partial<SyncQueueItem> = {}): SyncQueueItem => ({
  id: 'failed-row', taskId: 'task-a', operation: 'update', timestamp: 100,
  retryCount: 5, status: 'failed', lastError: 'validation_failed', payload: localRow(SAVED), ...overrides,
});

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncMetadata.put(signedIn());
});

describe('failed sync recovery', () => {
  it('retries the latest row with a new queue id, preserving its version', async () => {
    const db = getDb();
    const current = localRow(SAVED, { title: 'Edited after the failed snapshot' });
    await db.tasks.put(current);
    await db.syncQueue.add(failed());
    await expect(recoverFailedSyncItem('failed-row', 'user-1', 'retry')).resolves.toBe('queued');
    const [retry] = await db.syncQueue.toArray();
    expect(retry.id).not.toBe('failed-row');
    expect(retry).toMatchObject({ payload: current, retryCount: 0, status: 'pending' });
    expect(retry.lastError).toBeUndefined();
  });

  it('keeps an already pending intent and removes only failed diagnostics', async () => {
    const db = getDb();
    await db.tasks.put(localRow(SAVED));
    const pending = failed({ id: 'pending-row', status: 'pending', retryCount: 0 });
    await db.syncQueue.bulkAdd([failed(), pending]);
    await recoverFailedSyncItem('failed-row', 'user-1', 'retry');
    expect(await db.syncQueue.toArray()).toEqual([pending]);
  });

  it('retries a delete without making its old intent newer', async () => {
    const db = getDb();
    await db.syncQueue.add(failed({ operation: 'delete', payload: null }));
    await recoverFailedSyncItem('failed-row', 'user-1', 'retry');
    expect(await db.syncQueue.toArray()).toEqual([expect.objectContaining({ operation: 'delete', timestamp: 100, payload: null, status: 'pending' })]);
  });

  it('never recreates a missing task from the failed payload', async () => {
    const db = getDb();
    await db.syncQueue.add(failed());
    await expect(recoverFailedSyncItem('failed-row', 'user-1', 'retry')).resolves.toBe('missing');
    expect(await db.tasks.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('dismisses by preserving unsynced live content in Trash without a cloud delete', async () => {
    const db = getDb();
    await db.tasks.put(localRow(SAVED));
    await db.syncQueue.add(failed());
    await expect(recoverFailedSyncItem('failed-row', 'user-1', 'dismiss')).resolves.toBe('trashed');
    expect(await db.tasks.count()).toBe(0);
    expect(await db.deletedTasks.get('task-a')).toMatchObject({ title: 'Read later' });
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('rejects a session change without changing any task or queue row', async () => {
    const db = getDb();
    await db.syncQueue.add(failed());
    await db.syncMetadata.put({ ...signedIn(), userId: 'other-owner' });
    await expect(recoverFailedSyncItem('failed-row', 'user-1', 'retry')).rejects.toThrow('Sync session ended');
    expect(await db.syncQueue.get('failed-row')).toEqual(failed());
  });
});
