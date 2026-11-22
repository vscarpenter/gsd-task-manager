/** Two writers of one row both land. Runs the real writers on fake-indexeddb, with nothing mocked. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getArchiveSettings } from '@/lib/archive';
import { getDb } from '@/lib/db';
import { modifyRow } from '@/lib/db-row';
import { requestNotificationPermission } from '@/lib/notifications/permissions';
import {
  getNotificationSettings,
  toggleNotificationSound,
  updateNotificationSettings,
} from '@/lib/notifications/settings';
import { getAppPreferences, updateAppPreferences } from '@/lib/smart-views';
import { getSyncQueue } from '@/lib/sync/queue';

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notification settings', () => {
  beforeEach(async () => {
    await getNotificationSettings();
  });

  it('keeps both of two overlapping updates', async () => {
    await Promise.all([
      updateNotificationSettings({ soundEnabled: false }),
      updateNotificationSettings({ defaultReminder: 60 }),
    ]);

    expect(await getNotificationSettings()).toMatchObject({ soundEnabled: false, defaultReminder: 60 });
  });

  it('ends where it started after two quick sound toggles', async () => {
    await Promise.all([toggleNotificationSound(), toggleNotificationSound()]);

    expect((await getNotificationSettings()).soundEnabled).toBe(true);
  });

  it('keeps a setting changed while the permission prompt was open', async () => {
    let answer: (permission: NotificationPermission) => void = () => {};
    let promptShown: () => void = () => {};
    const shown = new Promise<void>((resolve) => { promptShown = resolve; });
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: () => new Promise<NotificationPermission>((resolve) => {
        answer = resolve;
        promptShown();
      }),
    });
    const asking = requestNotificationPermission();
    await shown;
    await updateNotificationSettings({ soundEnabled: false });

    answer('granted');
    await asking;

    expect(await getNotificationSettings()).toMatchObject({ soundEnabled: false, permissionAsked: true });
  });
});

it('keeps both of two overlapping preference updates', async () => {
  await Promise.all([updateAppPreferences({ smartViewsEnabled: true }), updateAppPreferences({ maxPinnedViews: 2 })]);

  expect(await getAppPreferences()).toMatchObject({ smartViewsEnabled: true, maxPinnedViews: 2 });
});

it('never lets first-read archive defaults replace a choice saved meanwhile', async () => {
  const chosen = { id: 'settings', enabled: true, archiveAfterDays: 60 } as const;

  await Promise.all([getArchiveSettings(), getDb().archiveSettings.put(chosen)]);

  expect(await getDb().archiveSettings.get('settings')).toEqual(chosen);
});

it('counts both of two overlapping failed attempts', async () => {
  const queue = getSyncQueue();
  await queue.enqueue('delete', 'task-a', null);
  const [row] = await queue.getPending();

  await Promise.all([queue.recordAttemptFailure(row.id, 'first'), queue.recordAttemptFailure(row.id, 'second')]);

  expect((await getDb().syncQueue.get(row.id))?.retryCount).toBe(2);
});

// Never called. `bun run typecheck:tests` fails here if a change may await inside the transaction.
export async function syncChangeProof(): Promise<void> {
  // @ts-expect-error an async change would let the transaction commit early
  await modifyRow(getDb().archiveSettings, 'settings', async (current) => current!);
}
