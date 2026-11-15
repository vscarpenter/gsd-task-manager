import { afterEach, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { notificationChecker } from '@/lib/notification-checker';
import { resetEverything } from '@/lib/reset-everything';
import { endResetLock, getResetLockSnapshot } from '@/lib/reset-lock';
import { createMockTask } from '@/tests/fixtures';

vi.mock('@/lib/sync/config', () => ({ disableSync: vi.fn(async () => {}) }));

afterEach(() => {
  notificationChecker.stop();
  endResetLock(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('finishes reset without displaying a waiting reminder when no worker activates', async () => {
  await getDb().tasks.clear();
  await getDb().notificationSettings.put({ id: 'settings', enabled: true, defaultReminder: 15,
    soundEnabled: true, permissionAsked: true, updatedAt: new Date().toISOString() });
  await getDb().tasks.put(createMockTask({ dueDate: new Date(Date.now() + 600_000).toISOString() }));
  const shown = vi.fn(function Notification() { return { close: vi.fn() }; });
  Object.assign(shown, { permission: 'granted' });
  vi.stubGlobal('Notification', shown);
  let activate!: (registration: ServiceWorkerRegistration | undefined) => void;
  let waiting!: () => void;
  const ready = new Promise<ServiceWorkerRegistration | undefined>((resolve) => { activate = resolve; });
  const started = new Promise<void>((resolve) => { waiting = resolve; });
  let tail: Promise<unknown> = Promise.resolve();
  vi.stubGlobal('navigator', {
    serviceWorker: { get ready() { waiting(); return ready; } },
    locks: { request: (_name: string, run: () => Promise<unknown>) => {
      const result = tail.then(run);
      tail = result.catch(() => {});
      return result;
    } },
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const checking = notificationChecker.checkAndNotify();
  await started;
  let finished = false;
  const resetting = resetEverything().then((result) => { finished = true; return result; });
  try {
    await vi.advanceTimersByTimeAsync(2_500);
    await vi.waitFor(() => expect(finished).toBe(true));
    expect((await resetting).success).toBe(true);
    expect(await getDb().tasks.count()).toBe(0);
    expect(getResetLockSnapshot()).toBe('unlocked');
    expect(shown).not.toHaveBeenCalled();
  } finally {
    activate(undefined);
    await Promise.all([checking, resetting]);
  }
});
