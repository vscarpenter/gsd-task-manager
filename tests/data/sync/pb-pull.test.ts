import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';
import Dexie from 'dexie';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import type { TaskRecord } from '@/lib/types';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

const { fetchRemoteTaskIndexMock } = vi.hoisted(() => ({
  fetchRemoteTaskIndexMock: vi.fn(),
}));

vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>('@/lib/sync/pb-sync-helpers');
  return {
    ...actual,
    fetchRemoteTaskIndex: fetchRemoteTaskIndexMock,
    getCurrentUserId: vi.fn(() => 'user-1'),
  };
});

import { pullRemoteChanges } from '@/lib/sync/pb-pull';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

function pbRecord(taskId: string, clientUpdatedAt: string): RecordModel {
  return {
    id: `rec-${taskId}`,
    collectionId: 'tasks',
    collectionName: 'tasks',
    created: '2026-05-18T00:00:00.000Z',
    updated: '2026-05-18T00:00:00.000Z',
    task_id: taskId,
    title: 'T',
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    client_updated_at: clientUpdatedAt,
    client_created_at: '2026-05-18T00:00:00.000Z',
    device_id: 'other-device',
    owner: 'user-1',
  } as unknown as RecordModel;
}

function makeTask(id: string, updatedAt = '2026-05-18T00:00:00.000Z'): TaskRecord {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    createdAt: updatedAt,
    updatedAt,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
    timeSpent: 0,
    timeEntries: [],
  };
}

describe('pullRemoteChanges cursor clamping', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });
  });

  it('clamps year-3000 timestamps to now+5min when computing the cursor', async () => {
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('t1', '3000-01-01T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    expect(maxObservedTimestamp).not.toBeNull();
    expect(new Date(maxObservedTimestamp!).getTime()).toBeLessThanOrEqual(fiveMinFromNow + 1000);
  });

  it('does not include invalid (un-applied) records in the cursor', async () => {
    const badRecord = pbRecord('t1', '2099-12-31T00:00:00.000Z');
    badRecord.updated = '2099-12-31T00:00:00.000Z';
    // Force `pocketBaseToTaskRecord` to reject by stripping a required field.
    delete (badRecord as Record<string, unknown>).title;

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [badRecord, pbRecord('t2', '2026-05-18T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    // The applied record's client_updated_at is 2026-05-18T00:00:00Z; the cursor
    // is persisted with a 30s overlap subtracted so the next pull's `>=` filter
    // can re-catch boundary records reliably across clock drift.
    expect(maxObservedTimestamp).toBe('2026-05-17T23:59:30.000Z');
  });

  it('uses client_updated_at for filtering and sorting', async () => {
    const getList = vi.fn(async () => []);
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ getList }),
    });

    await pullRemoteChanges('2026-05-18T00:00:00.000Z');

    expect(getList).toHaveBeenCalledWith(
      1,
      200,
      expect.objectContaining({
        filter: expect.stringContaining('client_updated_at >= "2026-05-18T00:00:00.000Z"'),
        sort: 'client_updated_at,task_id,id',
      }),
    );
    expect(getList.mock.calls[0][2].filter).not.toMatch(/\bupdated\b/);
  });

  it('skips records where remote timestamp equals local (no phantom pull count)', async () => {
    const timestamp = '2026-05-18T12:00:00.000Z';

    const { getDb } = await import('@/lib/db');
    const db = getDb();
    await db.tasks.add({
      id: 't-equal',
      title: 'Existing',
      description: '',
      urgent: false,
      important: false,
      quadrant: 'not-urgent-not-important',
      completed: false,
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: timestamp,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
      notificationSent: false,
      timeSpent: 0,
      timeEntries: [],
    });

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('t-equal', timestamp)]),
      }),
    });

    const { pulledCount, maxObservedTimestamp } = await pullRemoteChanges(null);
    expect(pulledCount).toBe(0);
    expect(maxObservedTimestamp).toBeNull();
  });
});

describe('pullRemoteChanges archive guard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getDb();
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.deletedTasks.clear();
    await db.syncQueue.clear();
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });
  });

  it('does not resurrect a task that is already archived locally', async () => {
    // Archiving removes the task from `tasks` but leaves the remote copy alive,
    // so without this guard every pull re-adds it — permanently undoing the
    // archive and colliding with the archived copy on the next archive run.
    // The archive post-dates the remote record here, so nothing outranks it.
    const db = getDb();
    await db.archivedTasks.add({
      ...makeTask('archived-task'),
      archivedAt: '2026-05-21T00:00:00.000Z',
    });

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('archived-task', '2026-05-20T00:00:00.000Z')]),
      }),
    });

    const { pulledCount, maxObservedTimestamp } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(0);
    expect(maxObservedTimestamp).toBeNull();
    await expect(db.tasks.get('archived-task')).resolves.toBeUndefined();
    await expect(db.archivedTasks.count()).resolves.toBe(1);
  });

  it('does not resurrect a task that is deleted locally after the remote edit', async () => {
    const db = getDb();
    await db.deletedTasks.add({
      ...makeTask('deleted-task'),
      deletedAt: '2026-05-21T00:00:00.000Z',
    });
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('deleted-task', '2026-05-20T00:00:00.000Z')]),
      }),
    });

    const { pulledCount } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(0);
    await expect(db.tasks.get('deleted-task')).resolves.toBeUndefined();
    await expect(db.deletedTasks.get('deleted-task')).resolves.toBeDefined();
  });

  it('restores a deleted task when the remote edit post-dates deletion', async () => {
    const db = getDb();
    await db.deletedTasks.add({
      ...makeTask('edited-after-delete'),
      deletedAt: '2026-05-19T00:00:00.000Z',
    });
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('edited-after-delete', '2026-05-20T00:00:00.000Z')]),
      }),
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['edited-after-delete', { pbRecordId: 'rec-edited-after-delete', clientUpdatedAt: '2026-05-20T00:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const { pulledCount } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(1);
    await expect(db.tasks.get('edited-after-delete')).resolves.toBeDefined();
    await expect(db.deletedTasks.get('edited-after-delete')).resolves.toBeUndefined();
  });

  it('still pulls non-archived tasks alongside an archived one', async () => {
    const db = getDb();
    await db.archivedTasks.add({
      ...makeTask('archived-task'),
      archivedAt: '2026-05-21T00:00:00.000Z',
    });

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [
          pbRecord('archived-task', '2026-05-20T00:00:00.000Z'),
          pbRecord('live-task', '2026-05-20T00:00:00.000Z'),
        ]),
      }),
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['live-task', { pbRecordId: 'rec-live-task', clientUpdatedAt: '2026-05-20T00:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const { pulledCount } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(1);
    await expect(db.tasks.get('live-task')).resolves.toBeDefined();
    await expect(db.tasks.get('archived-task')).resolves.toBeUndefined();
  });

  it('restores an archived task when the remote edit post-dates the archive', async () => {
    // pb-push deliberately abandons a delete whose remote was modified after the
    // delete was queued ("edit-beats-delete" LWW) and relies on this pull to
    // bring the newer version back. The archive guard must not override that.
    const db = getDb();
    await db.archivedTasks.add({
      ...makeTask('edited-after-archive'),
      archivedAt: '2026-05-19T00:00:00.000Z',
    });

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [
          pbRecord('edited-after-archive', '2026-05-20T00:00:00.000Z'),
        ]),
      }),
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['edited-after-archive', { pbRecordId: 'rec-edited-after-archive', clientUpdatedAt: '2026-05-20T00:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const { pulledCount } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(1);
    await expect(db.tasks.get('edited-after-archive')).resolves.toBeDefined();
    // The archived row must go, or the task would be re-archived immediately
    // and the remote edit lost again.
    await expect(db.archivedTasks.get('edited-after-archive')).resolves.toBeUndefined();
  });

  it('rolls back tombstone removal when the corresponding live write fails', async () => {
    const db = getDb();
    await db.archivedTasks.add({
      ...makeTask('atomic-restore'),
      archivedAt: '2026-05-19T00:00:00.000Z',
    });
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [
          pbRecord('atomic-restore', '2026-05-20T00:00:00.000Z'),
        ]),
      }),
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });
    const addSpy = vi.spyOn(db.tasks, 'add').mockRejectedValueOnce(new Error('write failed'));

    await expect(pullRemoteChanges(null)).rejects.toThrow('write failed');

    await expect(db.archivedTasks.get('atomic-restore')).resolves.toBeDefined();
    await expect(db.tasks.get('atomic-restore')).resolves.toBeUndefined();
    addSpy.mockRestore();
  });

  it('keeps suppressing a remote record that predates the archive', async () => {
    const db = getDb();
    await db.archivedTasks.add({
      ...makeTask('stale-remote'),
      archivedAt: '2026-05-19T00:00:00.000Z',
    });

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('stale-remote', '2026-05-18T00:00:00.000Z')]),
      }),
    });

    const { pulledCount } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(0);
    await expect(db.tasks.get('stale-remote')).resolves.toBeUndefined();
    await expect(db.archivedTasks.get('stale-remote')).resolves.toBeDefined();
  });

  it('pulls a restored task again once it leaves the archive', async () => {
    const db = getDb();

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [pbRecord('restored-task', '2026-05-20T00:00:00.000Z')]),
      }),
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['restored-task', { pbRecordId: 'rec-restored-task', clientUpdatedAt: '2026-05-20T00:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const { pulledCount } = await pullRemoteChanges(null);

    expect(pulledCount).toBe(1);
    await expect(db.tasks.get('restored-task')).resolves.toBeDefined();
  });
});

describe('pullRemoteChanges deletion reconciliation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    // The archive-guard describe above leaves a row in deletedTasks, which
    // would poison the trash assertions below.
    await db.deletedTasks.clear();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => []),
      }),
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });
  });

  it('deletes a local task that is absent from the remote index', async () => {
    const db = getDb();
    await db.tasks.bulkAdd([
      makeTask('remote-kept'),
      makeTask('server-deleted'),
    ]);
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['remote-kept', { pbRecordId: 'rec-remote-kept', clientUpdatedAt: '2026-05-18T00:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    await pullRemoteChanges(null);

    await expect(db.tasks.get('remote-kept')).resolves.toBeDefined();
    await expect(db.tasks.get('server-deleted')).resolves.toBeUndefined();
    // Over-reach guard: an ordinary cross-device deletion has nothing unsynced
    // to preserve, so it must not land in Trash.
    await expect(db.deletedTasks.count()).resolves.toBe(0);
  });

  it('preserves a remote-absent local task when it has a pending sync operation', async () => {
    const db = getDb();
    const unsyncedTask = makeTask('pending-local-edit');
    await db.tasks.add(unsyncedTask);
    await getSyncQueue().enqueue('update', unsyncedTask.id, unsyncedTask);
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map(),
      fetchSucceeded: true,
    });

    await pullRemoteChanges(null);

    await expect(db.tasks.get(unsyncedTask.id)).resolves.toEqual(unsyncedTask);
  });

  it('preserves a remote-absent local task when its legacy queue row has no status', async () => {
    const db = getDb();
    const legacyUnsyncedTask = makeTask('legacy-pending-local-edit');
    await db.tasks.add(legacyUnsyncedTask);
    await db.syncQueue.add({
      id: 'legacy-queue-row',
      taskId: legacyUnsyncedTask.id,
      operation: 'update',
      timestamp: Date.now(),
      retryCount: 0,
      payload: legacyUnsyncedTask,
    });
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map(),
      fetchSucceeded: true,
    });

    await pullRemoteChanges(null);

    await expect(db.tasks.get(legacyUnsyncedTask.id)).resolves.toEqual(legacyUnsyncedTask);
  });

  // A retry-exhausted row can never be pushed, so it must not shield the task
  // from a deletion it will never contest. Its content never reached the server
  // either, so the task is preserved in Trash rather than dropped.
  it('abandons a remote-absent task to trash when its queued operation has failed', async () => {
    const db = getDb();
    const staleTask = makeTask('failed-local-edit');
    await db.tasks.add(staleTask);
    await getSyncQueue().enqueue('update', staleTask.id, staleTask);
    const [queuedItem] = await db.syncQueue.toArray();
    await db.syncQueue.update(queuedItem.id, { status: 'failed' });
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map(),
      fetchSucceeded: true,
    });

    await pullRemoteChanges(null);

    await expect(db.tasks.get(staleTask.id)).resolves.toBeUndefined();
    const trashed = await db.deletedTasks.get(staleTask.id);
    expect(trashed).toMatchObject({ id: staleTask.id, title: staleTask.title });
    expect(trashed?.deletedAt).toEqual(expect.any(String));
  });

  // The second-order failure: a dead row outliving the task it guarded would
  // shield that id forever, even after a later edit healed the server copy.
  it('drops the retry-exhausted rows in the same pass that releases the task', async () => {
    const db = getDb();
    const staleTask = makeTask('failed-local-edit');
    await db.tasks.add(staleTask);
    await getSyncQueue().enqueue('update', staleTask.id, staleTask);
    const [queuedItem] = await db.syncQueue.toArray();
    await db.syncQueue.update(queuedItem.id, { status: 'failed' });
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });

    await pullRemoteChanges(null);

    const remaining = await db.syncQueue.toArray();
    expect(remaining.filter((row) => row.taskId === staleTask.id)).toEqual([]);
  });

  // ADR 0013 rule 3: the trash write is idempotent, so a task whose id already
  // sits in deletedTasks does not abort the whole reconciliation.
  it('re-trashes a task already present in the trash without aborting', async () => {
    const db = getDb();
    const staleTask = makeTask('already-trashed');
    await db.tasks.add(staleTask);
    await db.deletedTasks.put({ ...staleTask, deletedAt: '2026-01-01T00:00:00.000Z' });
    await getSyncQueue().enqueue('update', staleTask.id, staleTask);
    const [queuedItem] = await db.syncQueue.toArray();
    await db.syncQueue.update(queuedItem.id, { status: 'failed' });
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });

    await expect(pullRemoteChanges(null)).resolves.not.toThrow();

    await expect(db.tasks.get(staleTask.id)).resolves.toBeUndefined();
    await expect(db.deletedTasks.count()).resolves.toBe(1);
  });

  it('skips local deletion when the remote index cannot be fetched', async () => {
    const db = getDb();
    await db.tasks.add(makeTask('local-copy'));
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map(),
      fetchSucceeded: false,
    });

    await pullRemoteChanges(null);

    await expect(db.tasks.get('local-copy')).resolves.toBeDefined();
  });

  it('serializes deletion reconciliation with a concurrent local edit and queue write', async () => {
    const db = getDb();
    const original = makeTask('concurrent-edit');
    const edited = { ...original, title: 'Edited while reconciling', updatedAt: '2026-05-19T00:00:00.000Z' };
    await db.tasks.add(original);
    fetchRemoteTaskIndexMock.mockResolvedValue({ index: new Map(), fetchSucceeded: true });

    let markReadStarted!: () => void;
    let releaseRead!: () => void;
    const readStarted = new Promise<void>((resolve) => { markReadStarted = resolve; });
    const readRelease = new Promise<void>((resolve) => { releaseRead = resolve; });
    const originalToArray = db.tasks.toArray.bind(db.tasks);
    const toArraySpy = vi.spyOn(db.tasks, 'toArray').mockImplementationOnce(async () => {
      const snapshot = await originalToArray();
      markReadStarted();
      await Dexie.waitFor(readRelease);
      return snapshot;
    });

    try {
      const pull = pullRemoteChanges(null);
      await readStarted;
      let concurrentCommitted = false;
      const concurrentEdit = Dexie.ignoreTransaction(() =>
        db.transaction('rw', [db.tasks, db.syncQueue], async () => {
          await db.tasks.put(edited);
          await db.syncQueue.add({
            id: 'concurrent-queue-item',
            taskId: edited.id,
            operation: 'update',
            payload: edited,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending',
          });
        })
      ).then(() => { concurrentCommitted = true; });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(concurrentCommitted).toBe(false);
      releaseRead();
      await pull;
      await concurrentEdit;

      await expect(db.tasks.get(edited.id)).resolves.toEqual(edited);
      await expect(db.syncQueue.get('concurrent-queue-item')).resolves.toBeDefined();
    } finally {
      releaseRead();
      toArraySpy.mockRestore();
    }
  });
});
