import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { deleteRemoteAccountAndTasks } from '@/lib/sync/pb-account-deletion';
import { getPocketBase, getCurrentUserId } from '@/lib/sync/pocketbase-client';
import { refreshAuth } from '@/lib/sync/pb-auth';
import type { RemoteTaskIndexEntry } from '@/lib/sync/types';

const { fetchRemoteTaskIndexMock } = vi.hoisted(() => ({ fetchRemoteTaskIndexMock: vi.fn() }));

// Partial mock on purpose. Automocking the module would replace `delay` with a
// no-op and silently void the throttle test below.
vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>('@/lib/sync/pb-sync-helpers');
  return { ...actual, fetchRemoteTaskIndex: fetchRemoteTaskIndexMock };
});

vi.mock('@/lib/sync/pocketbase-client');
vi.mock('@/lib/sync/pb-auth');
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

function indexOf(...recordIds: string[]) {
  const index = new Map<string, RemoteTaskIndexEntry>();
  recordIds.forEach((pbRecordId, i) => {
    index.set(`task-${i}`, { pbRecordId, clientUpdatedAt: '2026-01-01T00:00:00.000Z' });
  });
  return { index, fetchSucceeded: true };
}

const EMPTY_INDEX = { index: new Map<string, RemoteTaskIndexEntry>(), fetchSucceeded: true };

/** What a PocketBase without the account-lifecycle hook returns for the route. */
function routeMissing() {
  return Object.assign(new Error('Not Found.'), { status: 404 });
}

describe('deleteRemoteAccountAndTasks', () => {
  let send: ReturnType<typeof vi.fn>;
  let tasksDelete: ReturnType<typeof vi.fn>;
  let usersDelete: ReturnType<typeof vi.fn>;
  let callOrder: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    send = vi.fn(async () => undefined);
    callOrder = [];
    tasksDelete = vi.fn(async (id: string) => {
      callOrder.push(`task:${id}`);
    });
    usersDelete = vi.fn(async (id: string) => {
      callOrder.push(`user:${id}`);
    });
    vi.mocked(getPocketBase).mockReturnValue({
      send,
      collection: (name: string) => ({ delete: name === 'tasks' ? tasksDelete : usersDelete }),
    } as unknown as PocketBase);
    vi.mocked(getCurrentUserId).mockReturnValue('user-123');
    vi.mocked(refreshAuth).mockResolvedValue(true);
    fetchRemoteTaskIndexMock.mockResolvedValue(EMPTY_INDEX);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses one authenticated server transaction route', async () => {
    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result).toEqual({ ok: true, stage: 'done' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('/api/gsd/account', { method: 'DELETE' });
  });

  it('does not call the route when authentication has no users principal', async () => {
    vi.mocked(getCurrentUserId).mockReturnValue(null);

    const result = await deleteRemoteAccountAndTasks();

    expect(result).toEqual({ ok: false, stage: 'tasks', authRejected: true });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([401, 403])('reports an auth rejection for HTTP %s', async (status) => {
    send.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status }));

    const result = await deleteRemoteAccountAndTasks();

    expect(result).toMatchObject({
      ok: false,
      stage: 'account',
      authRejected: true,
    });
    expect(fetchRemoteTaskIndexMock).not.toHaveBeenCalled();
  });

  // Deliberately green on head. This is the mutation guard that keeps the
  // 404-only fallback rule falsifiable: status 0 is what PocketBase reports for
  // a network, DNS or TLS failure, and an outage must never be read as "the
  // route is absent, erase from the client and hope".
  it.each([0, 429, 500, 502])(
    'does not fall back when the route fails with HTTP %s',
    async (status) => {
      send.mockRejectedValueOnce(Object.assign(new Error('boom'), { status }));

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toMatchObject({ ok: false, stage: 'account', authRejected: false });
      expect(fetchRemoteTaskIndexMock).not.toHaveBeenCalled();
      expect(tasksDelete).not.toHaveBeenCalled();
      expect(usersDelete).not.toHaveBeenCalled();
    }
  );

  it('reports a sanitized server failure without claiming erasure', async () => {
    send.mockRejectedValueOnce(new Error('x'.repeat(500)));

    const result = await deleteRemoteAccountAndTasks();

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('account');
    expect(result.authRejected).toBe(false);
    expect(result.error).toHaveLength(200);
  });

  it('refreshes auth before resolving the principal and invoking erasure', async () => {
    const order: string[] = [];
    vi.mocked(refreshAuth).mockImplementationOnce(async () => {
      order.push('refresh');
      return true;
    });
    vi.mocked(getCurrentUserId).mockImplementationOnce(() => {
      order.push('principal');
      return 'user-123';
    });
    send.mockImplementationOnce(async () => {
      order.push('erase');
    });

    await deleteRemoteAccountAndTasks();

    expect(order).toEqual(['refresh', 'principal', 'erase']);
  });

  // api.vinny.io does not load docker/pb_hooks, so this describe block is the
  // live production path, not a hypothetical.
  describe('when the transactional route is not deployed (404)', () => {
    beforeEach(() => {
      send.mockRejectedValue(routeMissing());
    });

    it('falls back to client-side erasure, deleting every task before the user record', async () => {
      fetchRemoteTaskIndexMock
        .mockResolvedValueOnce(indexOf('rec-a', 'rec-b'))
        .mockResolvedValueOnce(EMPTY_INDEX);

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toEqual({ ok: true, stage: 'done' });
      expect(callOrder).toEqual(['task:rec-a', 'task:rec-b', 'user:user-123']);
      // The second pass is what makes "zero tasks remained" observed rather than assumed.
      expect(fetchRemoteTaskIndexMock).toHaveBeenCalledTimes(2);
    });

    it('aborts before the user record when remote tasks cannot be enumerated', async () => {
      fetchRemoteTaskIndexMock.mockResolvedValueOnce({ index: new Map(), fetchSucceeded: false });

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toMatchObject({
        ok: false,
        stage: 'tasks',
        error: 'Could not list remote tasks',
      });
      expect(tasksDelete).not.toHaveBeenCalled();
      expect(usersDelete).not.toHaveBeenCalled();
    });

    it('keeps the 100ms throttle between fallback deletes', async () => {
      vi.useFakeTimers();
      fetchRemoteTaskIndexMock
        .mockResolvedValueOnce(indexOf('rec-a', 'rec-b'))
        .mockResolvedValue(EMPTY_INDEX);

      const pending = deleteRemoteAccountAndTasks();

      await vi.advanceTimersByTimeAsync(0);
      expect(callOrder).toEqual(['task:rec-a']);
      await vi.advanceTimersByTimeAsync(99);
      expect(callOrder).toEqual(['task:rec-a']);
      await vi.advanceTimersByTimeAsync(1);
      expect(callOrder).toEqual(['task:rec-a', 'task:rec-b']);
      await vi.advanceTimersByTimeAsync(100);
      await pending;
      expect(callOrder).toEqual(['task:rec-a', 'task:rec-b', 'user:user-123']);
    });

    it('stops at stage tasks when a fallback task delete fails, leaving the account intact', async () => {
      fetchRemoteTaskIndexMock.mockResolvedValueOnce(indexOf('rec-a', 'rec-b'));
      tasksDelete
        .mockImplementationOnce(async (id: string) => {
          callOrder.push(`task:${id}`);
        })
        .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toMatchObject({
        ok: false,
        stage: 'tasks',
        authRejected: false,
        remoteTasksErased: true,
      });
      expect(result.error).toContain('boom');
      expect(tasksDelete).toHaveBeenCalledTimes(2);
      // A partial wipe followed by the user delete would orphan the survivors.
      expect(usersDelete).not.toHaveBeenCalled();
    });

    it('reports an auth rejection from a fallback task delete without deleting the user', async () => {
      fetchRemoteTaskIndexMock.mockResolvedValueOnce(indexOf('rec-a'));
      tasksDelete.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }));

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result.stage).toBe('tasks');
      expect(result.authRejected).toBe(true);
      expect(usersDelete).not.toHaveBeenCalled();
    });

    it('reports partial erasure when the account delete fails after the wipe', async () => {
      fetchRemoteTaskIndexMock
        .mockResolvedValueOnce(indexOf('rec-a', 'rec-b'))
        .mockResolvedValueOnce(EMPTY_INDEX);
      usersDelete.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toMatchObject({ ok: false, stage: 'account', remoteTasksErased: true });
      expect(callOrder).toEqual(['task:rec-a', 'task:rec-b']);
    });

    it('refuses to delete the user record when remote tasks keep reappearing', async () => {
      fetchRemoteTaskIndexMock.mockResolvedValue(indexOf('rec-a'));

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toMatchObject({
        ok: false,
        stage: 'tasks',
        error: 'Remote tasks kept reappearing',
        remoteTasksErased: true,
      });
      expect(usersDelete).not.toHaveBeenCalled();
      expect(fetchRemoteTaskIndexMock).toHaveBeenCalledTimes(3);
    });

    it('completes the fallback for an account with zero remote tasks', async () => {
      fetchRemoteTaskIndexMock.mockResolvedValue(EMPTY_INDEX);

      const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

      expect(result).toEqual({ ok: true, stage: 'done' });
      expect(tasksDelete).not.toHaveBeenCalled();
      expect(usersDelete).toHaveBeenCalledWith('user-123');
      expect(fetchRemoteTaskIndexMock).toHaveBeenCalledTimes(1);
    });
  });
});
