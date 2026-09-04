import { beforeEach, describe, expect, it, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { deleteRemoteAccountAndTasks } from '@/lib/sync/pb-account-deletion';
import { getPocketBase, getCurrentUserId } from '@/lib/sync/pocketbase-client';
import { refreshAuth } from '@/lib/sync/pb-auth';

vi.mock('@/lib/sync/pocketbase-client');
vi.mock('@/lib/sync/pb-auth');
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe('deleteRemoteAccountAndTasks', () => {
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    send = vi.fn(async () => undefined);
    vi.mocked(getPocketBase).mockReturnValue({ send } as unknown as PocketBase);
    vi.mocked(getCurrentUserId).mockReturnValue('user-123');
    vi.mocked(refreshAuth).mockResolvedValue(true);
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
  });

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
});
