import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';
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
        getFullList: vi.fn(async () => [pbRecord('t1', '3000-01-01T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    expect(maxObservedTimestamp).not.toBeNull();
    expect(new Date(maxObservedTimestamp!).getTime()).toBeLessThanOrEqual(fiveMinFromNow + 1000);
  });

  it('does not include invalid (un-applied) records in the cursor', async () => {
    const badRecord = pbRecord('t1', '2099-12-31T00:00:00.000Z');
    // Force `pocketBaseToTaskRecord` to reject by stripping a required field.
    delete (badRecord as Record<string, unknown>).title;

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [badRecord, pbRecord('t2', '2026-05-18T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    // The applied record's client_updated_at is 2026-05-18T00:00:00Z; the cursor
    // is persisted with a 30s overlap subtracted so the next pull's `>=` filter
    // can re-catch boundary records reliably across clock drift.
    expect(maxObservedTimestamp).toBe('2026-05-17T23:59:30.000Z');
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
        getFullList: vi.fn(async () => [pbRecord('t-equal', timestamp)]),
      }),
    });

    const { pulledCount } = await pullRemoteChanges(null);
    expect(pulledCount).toBe(0);
  });
});

describe('pullRemoteChanges deletion reconciliation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => []),
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

  it('deletes a remote-absent local task when its only queued operation has failed', async () => {
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
});
