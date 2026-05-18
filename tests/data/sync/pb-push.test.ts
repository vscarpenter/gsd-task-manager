import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>(
    '@/lib/sync/pb-sync-helpers',
  );
  return {
    ...actual,
    fetchRemoteTaskIndex: fetchRemoteTaskIndexMock,
    getCurrentUserId: vi.fn(() => 'user-1'),
    getDeviceId: vi.fn(async () => 'dev-1'),
    // Use zero throttle to keep tests fast.
    THROTTLE_MS: 0,
    delay: vi.fn(async () => {}),
  };
});

import { pushLocalChanges } from '@/lib/sync/pb-push';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

function makeTask(id: string, updatedAt: string): TaskRecord {
  return {
    id,
    title: 'T',
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
  };
}

describe('pushLocalChanges LWW guard', () => {
  beforeEach(async () => {
    await getDb().syncQueue.clear();
    fetchRemoteTaskIndexMock.mockReset();
  });

  it('skips a queued update whose payload is older than the remote record', async () => {
    const stalePayload = makeTask('t1', '2026-05-18T08:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', stalePayload);

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    const createSpy = vi.fn();
    const deleteSpy = vi.fn();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: createSpy, update: updateSpy, delete: deleteSpy }),
    });

    const result = await pushLocalChanges();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(result.pushedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    // Stale item is dequeued — the LWW outcome is final.
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('skips a queued delete when the remote record is newer than the queued op', async () => {
    await getSyncQueue().enqueue('delete', 't1', null);

    // Override the auto-stamped timestamp to a known past instant.
    const queue = await getDb().syncQueue.toArray();
    await getDb().syncQueue.update(queue[0].id, {
      timestamp: new Date('2026-05-18T08:00:00.000Z').getTime(),
    });

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const deleteSpy = vi.fn();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: vi.fn(), delete: deleteSpy }),
    });

    const result = await pushLocalChanges();

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.pushedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('proceeds with the write when the payload is newer than the remote record', async () => {
    const freshPayload = makeTask('t1', '2026-05-18T12:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', freshPayload);

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: updateSpy, delete: vi.fn() }),
    });

    const result = await pushLocalChanges();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(result.pushedCount).toBe(1);
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('does not push an upsert when the remote index fetch failed (LWW unverifiable)', async () => {
    const payload = makeTask('t1', '2026-05-18T12:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', payload);

    // Index fetch failed — we have no remote timestamp to compare against,
    // so we cannot verify whether the queued write would clobber newer data.
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map(),
      fetchSucceeded: false,
    });

    const updateSpy = vi.fn();
    const createSpy = vi.fn();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: createSpy, update: updateSpy, delete: vi.fn() }),
    });

    const result = await pushLocalChanges();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(result.pushedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.lastError).toBe('remote_index_unavailable');
    // Item should NOT be dequeued — recordAttemptFailure keeps it pending for a future retry.
    expect(await getSyncQueue().getPendingCount()).toBe(1);
  });

  it('proceeds with the write when the remote record has null client_updated_at', async () => {
    const payload = makeTask('t1', '2026-05-18T12:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', payload);

    // Remote record exists but has no client_updated_at (legacy or test data).
    // The LWW guard's `remote?.clientUpdatedAt && ...` short-circuit must let
    // this through to the upsert — there's nothing to compare against.
    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: null }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: updateSpy, delete: vi.fn() }),
    });

    const result = await pushLocalChanges();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(result.pushedCount).toBe(1);
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('refreshes the in-memory index after upsert so a later stale delete is skipped', async () => {
    // Same task: queue an update (payload.updatedAt = T2), then a delete queued at T1 < T2.
    // Initial remote index has clientUpdatedAt T0 < T1 < T2, so the update proceeds
    // and bumps the in-memory index entry to { clientUpdatedAt: T2 }. The subsequent
    // delete (intent timestamp T1) must then be skipped because T2 > T1.
    const T0 = '2026-05-18T08:00:00.000Z';
    const T_update_enqueue = new Date('2026-05-18T08:30:00.000Z').getTime();
    const T1 = new Date('2026-05-18T09:00:00.000Z').getTime();
    const T2 = '2026-05-18T10:00:00.000Z';

    const payload = makeTask('t1', T2);
    await getSyncQueue().enqueue('update', 't1', payload);
    await getSyncQueue().enqueue('delete', 't1', null);

    // Pin both queue items' timestamps so the loop processes update -> delete,
    // and the delete's "intent" timestamp (T1) is older than the update's payload (T2).
    const pending = await getDb().syncQueue.orderBy('timestamp').toArray();
    const updateItem = pending.find(i => i.operation === 'update')!;
    const deleteItem = pending.find(i => i.operation === 'delete')!;
    await getDb().syncQueue.update(updateItem.id, { timestamp: T_update_enqueue });
    await getDb().syncQueue.update(deleteItem.id, { timestamp: T1 });

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: T0 }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    const deleteSpy = vi.fn();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: updateSpy, delete: deleteSpy }),
    });

    const result = await pushLocalChanges();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.pushedCount).toBe(1); // update only — delete was LWW-skipped
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('fails open and proceeds with the write when remote clientUpdatedAt is unparseable', async () => {
    // NaN contract: isRemoteNewer returns false on parse failure, so the
    // write must proceed rather than silently dropping the user's edit.
    const payload = makeTask('t1', '2026-05-18T12:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', payload);

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: 'garbage-not-an-iso-date' }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: updateSpy, delete: vi.fn() }),
    });

    const result = await pushLocalChanges();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(result.pushedCount).toBe(1);
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });
});
