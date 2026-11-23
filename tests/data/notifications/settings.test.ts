/** Runs on fake-indexeddb with nothing mocked, and reads back what was stored. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import {
  getNotificationSettings,
  requestNotificationPermission,
  updateNotificationSettings,
} from '@/lib/notifications';
import type { NotificationSettings } from '@/lib/types';

const STORED: NotificationSettings = {
  id: 'settings',
  enabled: true,
  defaultReminder: 30,
  soundEnabled: true,
  permissionAsked: false,
  updatedAt: '2025-01-15T10:00:00.000Z',
};

const stored = () => getDb().notificationSettings.get('settings');

beforeEach(async () => {
  await getDb().notificationSettings.clear();
});

describe('getNotificationSettings', () => {
  it('returns the stored settings', async () => {
    await getDb().notificationSettings.put(STORED);

    expect(await getNotificationSettings()).toEqual(STORED);
  });

  it('creates and returns defaults when none exist', async () => {
    const settings = await getNotificationSettings();

    expect(settings).toMatchObject({
      id: 'settings', enabled: true, defaultReminder: 15, soundEnabled: true, permissionAsked: false,
    });
    expect(await stored()).toEqual(settings);
  });

  it('replaces corrupt settings with defaults, and stores them', async () => {
    await getDb().notificationSettings.put({ id: 'settings', enabled: 'nope', updatedAt: 12345 } as never);

    const settings = await getNotificationSettings();

    expect(settings).toMatchObject({ enabled: true, soundEnabled: true });
    expect(await stored()).toEqual(settings);
  });
});

describe('updateNotificationSettings', () => {
  beforeEach(async () => {
    await getDb().notificationSettings.put(STORED);
  });

  it('changes only the fields given', async () => {
    await updateNotificationSettings({ enabled: false, soundEnabled: false });

    expect(await stored()).toMatchObject({ enabled: false, soundEnabled: false, defaultReminder: 30, permissionAsked: false });
  });

  it('keeps the one settings row, whatever id it is given', async () => {
    await updateNotificationSettings({ id: 'other' } as never);

    expect(await getDb().notificationSettings.toCollection().primaryKeys()).toEqual(['settings']);
  });

  it('stamps the change', async () => {
    await updateNotificationSettings({ enabled: false });

    expect(Date.parse((await stored())!.updatedAt)).toBeGreaterThan(Date.parse(STORED.updatedAt));
  });

  it('rejects an invalid value and stores nothing', async () => {
    await expect(updateNotificationSettings({ defaultReminder: -5 })).rejects.toThrow(
      /Notification settings validation failed/,
    );

    expect(await stored()).toEqual(STORED);
  });
});

describe('requestNotificationPermission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['granted', true],
    ['denied', false],
  ] as const)('records that it asked when the answer is %s', async (answer, allowed) => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: async () => answer });

    expect(await requestNotificationPermission()).toBe(allowed);
    expect((await stored())?.permissionAsked).toBe(true);
  });
});
