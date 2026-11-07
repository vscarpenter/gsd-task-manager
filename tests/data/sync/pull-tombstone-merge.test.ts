/**
 * A pull or realtime change can bring back a task archived or trashed here, when the
 * server copy is newer than the archive or Trash row (ADR 0013, ADR 0015). It merges into
 * that row, as a pull merges into a live row, so this device's reminder state survives
 * (S-IOS-02). Runs the real sync against fake-indexeddb, with only PocketBase faked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';
import { NEWER, OLDER, SAVED, localRow, resetFakeSync, seed, serverRow, signedIn } from './support/fake-pocketbase';

vi.mock('@/lib/sync/pocketbase-client', async () => {
  const { fake: server } = await import('./support/fake-pocketbase');
  return {
    getPocketBase: () => server.pb,
    getCurrentUserId: () => 'user-1',
    isAuthenticated: () => true,
    clearPocketBase: vi.fn(),
  };
});

vi.mock('@/lib/sync/pb-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sync/pb-auth')>()),
  ensureValidAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/sync/notifications', () => ({
  notifySyncSuccess: vi.fn(),
  notifySyncError: vi.fn(),
}));

import { applyRemoteChange, fullSync } from '@/lib/sync/pb-sync-engine';
import { toTrashedRecord } from '@/lib/trash';

const DUE = '2026-10-25T09:00:00.000Z';
const REMINDED = { notificationSent: true, lastNotificationAt: OLDER, snoozedUntil: NEWER };
/** Edited on another device after this device archived or trashed it. */
const EDITED = { saved_at: '', title: 'Edited elsewhere', due_date: DUE };

const buried = (extra: Partial<TaskRecord> = {}) => localRow(OLDER, { dueDate: DUE, ...REMINDED, ...extra });

const TOMBSTONES = [
  ['an archive row', async (extra?: Partial<TaskRecord>) => {
    await getDb().archivedTasks.put({ ...buried(extra), archivedAt: OLDER });
  }],
  ['a Trash row', async (extra?: Partial<TaskRecord>) => {
    await getDb().deletedTasks.put({ ...toTrashedRecord(buried(extra)), deletedAt: OLDER });
  }],
] as const;

async function expectBackWithNoTombstone(expected: Partial<TaskRecord>): Promise<void> {
  await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Edited elsewhere', ...expected });
  await expect(getDb().archivedTasks.get('t-a')).resolves.toBeUndefined();
  await expect(getDb().deletedTasks.get('t-a')).resolves.toBeUndefined();
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetFakeSync();
});

describe.each(TOMBSTONES)('a task back from %s', (_name, bury) => {
  it("a pull that brings it back keeps this device's reminder state", async () => {
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), server: [serverRow(EDITED)] });
    await bury();

    await fullSync('auto');

    await expectBackWithNoTombstone(REMINDED);
  });

  it("a realtime change that brings it back keeps this device's reminder state", async () => {
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION) });
    await bury();

    await applyRemoteChange('update', serverRow(EDITED) as unknown as RecordModel, 'user-1');

    await expectBackWithNoTombstone(REMINDED);
  });

  // B-55 still applies through the mapper: a new due date is a new reminder.
  it('a pull that moves its due date gets a fresh reminder', async () => {
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), server: [serverRow(EDITED)] });
    await bury({ dueDate: SAVED });

    await fullSync('auto');

    await expectBackWithNoTombstone({ notificationSent: false, lastNotificationAt: undefined, snoozedUntil: undefined });
  });
});
