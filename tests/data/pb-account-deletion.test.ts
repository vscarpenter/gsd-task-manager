import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type PocketBase from 'pocketbase';
import { deleteRemoteAccountAndTasks } from '@/lib/sync/pb-account-deletion';
import { getPocketBase, getCurrentUserId } from '@/lib/sync/pocketbase-client';
import { refreshAuth } from '@/lib/sync/pb-auth';
import { fetchRemoteTaskIndex } from '@/lib/sync/pb-sync-helpers';

vi.mock('@/lib/sync/pocketbase-client');
vi.mock('@/lib/sync/pb-auth');
vi.mock('@/lib/sync/pb-sync-helpers');
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

/** Record-id keyed index entry shape produced by fetchRemoteTaskIndex. */
function indexOf(...recordIds: string[]) {
  const index = new Map<string, { pbRecordId: string; clientUpdatedAt: string | null }>();
  recordIds.forEach((id, i) => index.set(`task-${i}`, { pbRecordId: id, clientUpdatedAt: null }));
  return index;
}

describe('deleteRemoteAccountAndTasks', () => {
  let callOrder: string[];
  let tasksDelete: ReturnType<typeof vi.fn>;
  let usersDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    callOrder = [];

    tasksDelete = vi.fn(async (id: string) => {
      callOrder.push(`task:${id}`);
    });
    usersDelete = vi.fn(async (id: string) => {
      callOrder.push(`user:${id}`);
    });

    const fakePb = {
      collection: (name: string) => ({
        delete: name === 'tasks' ? tasksDelete : usersDelete,
      }),
    };

    vi.mocked(getPocketBase).mockReturnValue(fakePb as unknown as PocketBase);
    vi.mocked(getCurrentUserId).mockReturnValue('user-123');
    vi.mocked(refreshAuth).mockResolvedValue(true);
    vi.mocked(fetchRemoteTaskIndex).mockResolvedValue({
      index: indexOf('rec-a', 'rec-b'),
      fetchSucceeded: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes_all_remote_tasks_then_the_user_record_in_order', async () => {
    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result).toEqual({ ok: true, stage: 'done' });
    expect(callOrder).toEqual(['task:rec-a', 'task:rec-b', 'user:user-123']);
  });

  it('aborts_without_deleting_account_when_task_index_fetch_fails', async () => {
    vi.mocked(fetchRemoteTaskIndex).mockResolvedValue({
      index: new Map(),
      fetchSucceeded: false,
    });

    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('tasks');
    expect(tasksDelete).not.toHaveBeenCalled();
    expect(usersDelete).not.toHaveBeenCalled();
  });

  it('aborts_at_stage_tasks_when_a_task_delete_fails', async () => {
    tasksDelete.mockRejectedValueOnce(new Error('network down'));

    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('tasks');
    expect(usersDelete).not.toHaveBeenCalled();
  });

  it('returns_authRejected_and_keeps_account_when_task_delete_is_forbidden', async () => {
    tasksDelete.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { status: 403 }),
    );

    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('tasks');
    expect(result.authRejected).toBe(true);
    expect(usersDelete).not.toHaveBeenCalled();
  });

  it('returns_authRejected_when_not_authenticated', async () => {
    vi.mocked(getCurrentUserId).mockReturnValue(null);

    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.authRejected).toBe(true);
    expect(fetchRemoteTaskIndex).not.toHaveBeenCalled();
    expect(tasksDelete).not.toHaveBeenCalled();
    expect(usersDelete).not.toHaveBeenCalled();
  });

  it('returns_authRejected_when_user_delete_is_forbidden', async () => {
    vi.mocked(fetchRemoteTaskIndex).mockResolvedValue({ index: new Map(), fetchSucceeded: true });
    usersDelete.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }));

    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('account');
    expect(result.authRejected).toBe(true);
  });

  it('succeeds_with_zero_remote_tasks', async () => {
    vi.mocked(fetchRemoteTaskIndex).mockResolvedValue({ index: new Map(), fetchSucceeded: true });

    const result = await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(result).toEqual({ ok: true, stage: 'done' });
    expect(tasksDelete).not.toHaveBeenCalled();
    expect(usersDelete).toHaveBeenCalledWith('user-123');
  });

  it('deletes_each_remote_task_exactly_once', async () => {
    vi.mocked(fetchRemoteTaskIndex).mockResolvedValue({
      index: indexOf('rec-a', 'rec-b', 'rec-c'),
      fetchSucceeded: true,
    });

    await deleteRemoteAccountAndTasks({ throttleMs: 0 });

    expect(tasksDelete).toHaveBeenCalledTimes(3);
  });

  it('uses_the_default_throttle_between_remote_deletes', async () => {
    vi.useFakeTimers();

    const deletion = deleteRemoteAccountAndTasks();
    await vi.advanceTimersByTimeAsync(0);

    expect(callOrder).toEqual(['task:rec-a']);

    await vi.advanceTimersByTimeAsync(99);
    expect(callOrder).toEqual(['task:rec-a']);

    await vi.advanceTimersByTimeAsync(1);
    expect(callOrder).toEqual(['task:rec-a', 'task:rec-b']);
    expect(usersDelete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    await deletion;

    expect(callOrder).toEqual(['task:rec-a', 'task:rec-b', 'user:user-123']);
  });
});
