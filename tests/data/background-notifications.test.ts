import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { createMockTask } from '@/tests/fixtures';
import { runBackgroundNotifications, type BackgroundContext } from '@/lib/notifications/background';

const now = new Date('2026-11-14T10:00:00Z');
const showNotification = vi.fn(async () => {});
const setAppBadge = vi.fn(async () => {});
const clearAppBadge = vi.fn(async () => {});
const marker = new Map<string, Response>();
const context = (): BackgroundContext => ({
  indexedDB, Notification: { permission: 'granted' },
  registration: { showNotification },
  navigator: { locks: { request: async (_name: string, run: () => Promise<void>) => run() }, setAppBadge, clearAppBadge },
  caches: { open: async () => ({ match: async (key: string) => marker.get(key) }) },
});
const task = (overrides = {}) => createMockTask({
  id: 'background-task', title: 'Review changes', dueDate: '2026-11-14T10:10:00Z',
  notificationEnabled: true, notificationSent: false, notifyBefore: 15,
  updatedAt: '2026-11-13T10:00:00Z', ...overrides,
});

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.notificationSettings.put({ id: 'settings', enabled: true, defaultReminder: 15, soundEnabled: false, permissionAsked: true, updatedAt: now.toISOString() });
  await db.tasks.put(task());
  marker.clear();
  vi.clearAllMocks();
});

describe('periodic background reminders', () => {
  it('shows a due reminder once, marks only notification fields, and keeps a meaningful badge', async () => {
    await runBackgroundNotifications(context(), now);
    await runBackgroundNotifications(context(), now);
    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(expect.stringContaining('Review changes'), expect.objectContaining({ tag: 'task-background-task', silent: true }));
    expect(await getDb().tasks.get('background-task')).toMatchObject({ notificationSent: true, lastNotificationAt: now.toISOString(), updatedAt: '2026-11-13T10:00:00Z' });
    expect(setAppBadge).toHaveBeenLastCalledWith(1);
  });

  it.each([
    { completed: true }, { savedAt: now.toISOString() }, { notificationEnabled: false },
    { snoozedUntil: '2026-11-14T11:00:00Z' }, { dueDate: '2026-11-13T10:00:00Z' },
  ])('ignores ineligible task %j', async (overrides) => {
    await getDb().tasks.put(task(overrides));
    await runBackgroundNotifications(context(), now);
    expect(showNotification).not.toHaveBeenCalled();
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('respects quiet hours and disabled settings', async () => {
    await getDb().notificationSettings.update('settings', { quietHoursStart: '09:00', quietHoursEnd: '11:00' });
    await runBackgroundNotifications(context(), now);
    expect(showNotification).not.toHaveBeenCalled();
    await getDb().notificationSettings.update('settings', { enabled: false });
    await runBackgroundNotifications(context(), now);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does not mark a failed notification and retries on the next event', async () => {
    showNotification.mockRejectedValueOnce(new Error('not shown'));
    await runBackgroundNotifications(context(), now);
    expect((await getDb().tasks.get('background-task'))?.notificationSent).toBe(false);
    await runBackgroundNotifications(context(), now);
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('requires permission, cross-context coordination, and an unlocked origin', async () => {
    const denied = context(); denied.Notification.permission = 'denied';
    await runBackgroundNotifications(denied, now);
    const unsupported = context(); unsupported.navigator.locks = undefined;
    await runBackgroundNotifications(unsupported, now);
    marker.set('/.gsd-reset-pending', new Response('pending'));
    await runBackgroundNotifications(context(), now);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does not overwrite a task edited while the notification is displayed', async () => {
    showNotification.mockImplementationOnce(async () => {
      await getDb().tasks.update('background-task', { dueDate: '2026-11-15T10:10:00Z', title: 'A newer task' });
    });
    await runBackgroundNotifications(context(), now);
    expect(await getDb().tasks.get('background-task')).toMatchObject({ title: 'A newer task', notificationSent: false });
  });

  it('serializes concurrent checks so they cannot display the same reminder twice', async () => {
    let tail = Promise.resolve();
    const coordinated = context();
    coordinated.navigator.locks = { request: (_name, run) => {
      const next = tail.then(run);
      tail = next.catch(() => {});
      return next;
    } };
    await Promise.all([runBackgroundNotifications(coordinated, now), runBackgroundNotifications(coordinated, now)]);
    expect(showNotification).toHaveBeenCalledOnce();
  });

  it('uses all-day and snooze windows from the same rules as the open app', async () => {
    await getDb().tasks.put(task({ dueDate: '2026-11-14T00:00:00Z' }));
    await runBackgroundNotifications(context(), new Date('2026-11-14T08:59:00Z'));
    expect(showNotification).not.toHaveBeenCalled();
    await runBackgroundNotifications(context(), new Date('2026-11-14T09:00:00Z'));
    expect(showNotification).toHaveBeenCalledOnce();
    await getDb().tasks.put(task({ dueDate: '2026-11-13T10:00:00Z', snoozedUntil: '2026-11-14T09:55:00Z' }));
    await runBackgroundNotifications(context(), now);
    expect(showNotification).toHaveBeenCalledTimes(2);
  });
});
