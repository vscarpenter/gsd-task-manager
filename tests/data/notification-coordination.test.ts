import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBackgroundResetPending, withNotificationLock } from '@/lib/notifications/coordination';
import { openReminderDatabase, readReminderSnapshot, markBackgroundReminder } from '@/lib/notifications/background-db';
import { IDBFactory } from 'fake-indexeddb';
import { getDb } from '@/lib/db';
import { createMockTask } from '@/tests/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('notification coordination', () => {
  it('persists a reset marker and clears it only on success', async () => {
    const entries = new Map();
    vi.stubGlobal('caches', { open: async () => ({ put: async (key: string, value: Response) => entries.set(key, value), delete: async (key: string) => entries.delete(key) }) });
    await setBackgroundResetPending(true);
    expect(entries.has('/.gsd-reset-pending')).toBe(true);
    await setBackgroundResetPending(false);
    expect(entries.size).toBe(0);
  });

  it('uses the same Web Lock across page and worker checks', async () => {
    const request = vi.fn(async (_name, run) => run());
    vi.stubGlobal('navigator', { locks: { request } });
    await expect(withNotificationLock(async () => 42)).resolves.toBe(42);
    expect(request).toHaveBeenCalledWith('gsd-notification-check', expect.any(Function));
  });

  it('leaves an absent database absent and refuses an incomplete schema', async () => {
    const factory = new IDBFactory();
    await expect(openReminderDatabase(factory)).resolves.toBeNull();
    expect(await factory.databases()).toEqual([]);
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open('GsdTaskManager', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('unrelated');
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    await expect(openReminderDatabase(factory)).resolves.toBeNull();
  });

  it('handles a blocked database open', async () => {
    const request: { onblocked?: () => void; onsuccess?: () => void; result?: unknown } = {};
    const factory = { open: () => { queueMicrotask(() => request.onblocked?.()); return request; } } as unknown as IDBFactory;
    await expect(openReminderDatabase(factory)).resolves.toBeNull();
    const close = vi.fn();
    request.result = { close, objectStoreNames: { contains: () => true } };
    request.onsuccess?.();
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects aborted reads and marks without reporting success', async () => {
    await getDb().open();
    const native = getDb().backendDB();
    const transaction = native.transaction.bind(native);
    const proxy = { transaction: (...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = transaction(...args);
      queueMicrotask(() => tx.abort());
      return tx;
    } } as IDBDatabase;
    await expect(readReminderSnapshot(proxy)).rejects.toBeInstanceOf(Error);
    await expect(markBackgroundReminder(proxy, createMockTask(), new Date())).rejects.toBeInstanceOf(Error);
  });

  it('exposes a callable classic-worker entry', async () => {
    await import('@/lib/notifications/worker-entry');
    await expect((globalThis as unknown as { checkBackgroundNotifications: () => Promise<void> }).checkBackgroundNotifications()).resolves.toBeUndefined();
  });
});
