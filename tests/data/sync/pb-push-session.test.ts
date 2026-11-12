import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import type { PBSyncConfig } from '@/lib/sync/types';
import type { TaskRecord } from '@/lib/types';
import { createMockSyncConfig, createMockTask } from '@/tests/fixtures';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

const { fetchRemoteTaskEntryMock, delayMock } = vi.hoisted(() => ({
  fetchRemoteTaskEntryMock: vi.fn(),
  delayMock: vi.fn(async () => {}),
}));

vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>(
    '@/lib/sync/pb-sync-helpers',
  );
  return {
    ...actual,
    fetchRemoteTaskEntry: fetchRemoteTaskEntryMock,
    // The shared auth store still holds user-1's token in every test here.
    getCurrentUserId: vi.fn(() => 'user-1'),
    getDeviceId: vi.fn(async () => 'dev-1'),
    THROTTLE_MS: 0,
    delay: delayMock,
  };
});

import { pushLocalChanges } from '@/lib/sync/pb-push';
import { StaleSyncSessionError } from '@/lib/sync/sync-session';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

function syncConfig(overrides: Partial<PBSyncConfig> = {}): PBSyncConfig {
  return createMockSyncConfig({ userId: 'user-1', ...overrides });
}

function makeTask(id: string): TaskRecord {
  const at = '2026-05-18T12:00:00.000Z';
  return createMockTask({ id, title: 'T', description: '', createdAt: at, updatedAt: at });
}

interface FakeServer {
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

/** Runs while a request is in flight, before the server answers. */
type InFlight = () => Promise<void>;

/** A server that accepts user-1's token, with spies on every task write. */
function serveAsUserOne(onCreate?: InFlight, onRemove?: InFlight): FakeServer {
  const server: FakeServer = {
    create: vi.fn(async () => {
      await onCreate?.();
      return { id: 'rec-new' };
    }),
    update: vi.fn(),
    remove: vi.fn(async () => {
      await onRemove?.();
    }),
  };
  (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
    authStore: { token: 'token-1', clear: vi.fn() },
    send: vi.fn(async () => ({ record: { id: 'user-1' } })),
    collection: () => ({ create: server.create, update: server.update, delete: server.remove }),
  });
  return server;
}

/** Another account signs in on this device. */
async function signInAsUserTwo(): Promise<void> {
  await getDb().syncMetadata.put(syncConfig({ userId: 'user-2' }));
}

async function queuedTaskIds(): Promise<string[]> {
  return (await getDb().syncQueue.toArray()).map((row) => row.taskId).sort();
}

describe('pushLocalChanges session fence', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
    await db.tasks.clear();
    fetchRemoteTaskEntryMock.mockReset();
    delayMock.mockReset();
    delayMock.mockResolvedValue(undefined);
    // No remote copy: every queued row is a create.
    fetchRemoteTaskEntryMock.mockResolvedValue({ entry: null, fetchSucceeded: true });
  });

  it('should_push_and_dequeue_when_sync_config_names_the_session_owner', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    const server = serveAsUserOne();

    const result = await pushLocalChanges('user-1');

    expect(result.pushedCount).toBe(1);
    expect(server.create).toHaveBeenCalledTimes(1);
    expect(await queuedTaskIds()).toEqual([]);
  });

  it('should_not_read_the_queue_when_sync_config_names_another_account', async () => {
    // user-2 signed in on this device and queued an edit. user-1's token is
    // back in shared auth storage, so the SDK principal check alone passes.
    await getDb().syncMetadata.put(syncConfig({ userId: 'user-2' }));
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    const server = serveAsUserOne();

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    expect(server.create).not.toHaveBeenCalled();
    expect(await queuedTaskIds()).toEqual(['t1']);
  });

  it('should_not_read_the_queue_when_sync_is_off', async () => {
    await getDb().syncMetadata.put(syncConfig({ enabled: false, userId: null }));
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    const server = serveAsUserOne();

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    expect(server.create).not.toHaveBeenCalled();
    expect(await queuedTaskIds()).toEqual(['t1']);
  });

  it('should_stop_before_the_next_item_when_the_session_ends_mid_push', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    await getSyncQueue().enqueue('create', 't2', makeTask('t2'));
    // Another account signs in while the first request is in flight.
    const server = serveAsUserOne(signInAsUserTwo);

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    expect(server.create).toHaveBeenCalledTimes(1);
  });

  it('should_leave_the_queue_untouched_once_the_session_has_ended', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    await getSyncQueue().enqueue('create', 't2', makeTask('t2'));
    serveAsUserOne(signInAsUserTwo);

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    // The rows now belong to user-2's session. A push for user-1 may not
    // delete them or charge them a failed attempt.
    const rows = await getDb().syncQueue.toArray();
    expect(rows.map((row) => row.taskId).sort()).toEqual(['t1', 't2']);
    expect(rows.every((row) => row.retryCount === 0)).toBe(true);
  });

  it('should_not_charge_a_row_when_the_session_ends_before_a_failed_lookup_is_recorded', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    serveAsUserOne();
    // The lookup fails, and the other account signs in while it is in flight.
    fetchRemoteTaskEntryMock.mockImplementation(async () => {
      await signInAsUserTwo();
      return { entry: null, fetchSucceeded: false };
    });

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    const [row] = await getDb().syncQueue.toArray();
    expect(row.retryCount).toBe(0);
  });
  it('should_send_nothing_for_the_next_row_when_the_session_ends_between_rows', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    await getSyncQueue().enqueue('create', 't2', makeTask('t2'));
    const server = serveAsUserOne();
    // Row one is pushed and dequeued. The other account signs in during the throttle.
    delayMock.mockImplementationOnce(signInAsUserTwo);

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    expect(server.create).toHaveBeenCalledTimes(1);
    expect(fetchRemoteTaskEntryMock).toHaveBeenCalledTimes(1);
    // Two rows queued in the same millisecond have no fixed order, so count
    // the row that is left and do not name it.
    expect(await queuedTaskIds()).toHaveLength(1);
  });

  it('should_keep_a_delete_queued_when_the_session_ends_during_the_request', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('delete', 't1', null);
    fetchRemoteTaskEntryMock.mockResolvedValue({
      entry: { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' },
      fetchSucceeded: true,
    });
    const server = serveAsUserOne(undefined, signInAsUserTwo);

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    expect(server.remove).toHaveBeenCalledTimes(1);
    expect(await queuedTaskIds()).toEqual(['t1']);
  });

  it('should_not_charge_a_row_when_the_request_fails_after_the_session_ended', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    serveAsUserOne(async () => {
      await signInAsUserTwo();
      throw new Error('500 Internal Server Error');
    });

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    const [row] = await getDb().syncQueue.toArray();
    expect(row.retryCount).toBe(0);
    expect(row.status).toBe('pending');
  });

  it('should_not_write_the_reminder_offset_to_a_row_once_the_session_has_ended', async () => {
    // No offset on the payload or the row, at the same stamp: the push would
    // store this device's default on the row after the request.
    const task = { ...makeTask('t1'), notifyBefore: undefined };
    await getDb().syncMetadata.put(syncConfig());
    await getDb().tasks.put(task);
    await getSyncQueue().enqueue('create', 't1', task);
    serveAsUserOne(signInAsUserTwo);

    await expect(pushLocalChanges('user-1')).rejects.toBeInstanceOf(StaleSyncSessionError);

    expect((await getDb().tasks.get('t1'))?.notifyBefore).toBeUndefined();
  });

  it('should_keep_pushing_when_sync_config_is_rewritten_for_the_same_account', async () => {
    await getDb().syncMetadata.put(syncConfig());
    await getSyncQueue().enqueue('create', 't1', makeTask('t1'));
    await getSyncQueue().enqueue('create', 't2', makeTask('t2'));
    // A settings change rewrites the row mid-push. The account is unchanged.
    const server = serveAsUserOne(async () => {
      await getDb().syncMetadata.put(syncConfig({ autoSyncEnabled: false }));
    });

    const result = await pushLocalChanges('user-1');

    expect(result.pushedCount).toBe(2);
    expect(server.create).toHaveBeenCalledTimes(2);
    expect(await queuedTaskIds()).toEqual([]);
  });
});
