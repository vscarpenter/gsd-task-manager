/**
 * WEB-PULL-PARENT: `parentTaskId` links a recurring instance to its chain, and no
 * PocketBase field carries it. Every way a server copy overwrites a task here maps it
 * over this device's copy, so the link survives, as it does on iOS and Android. Runs the
 * real sync against fake-indexeddb, with only PocketBase faked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
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
import { rememberForResurrect } from '@/lib/sync/resurrect-ids';
import { resurrectOnSight } from '@/lib/sync/resurrect-on-sight';
import { toTrashedRecord } from '@/lib/trash';

const ROOT = 't-root';
/** Edited on another device, at the server's stamp (SAVED). */
const EDITED = { saved_at: '', title: 'Edited elsewhere', recurrence: 'daily' };
const instance = (updatedAt: string) => localRow(updatedAt, { recurrence: 'daily', parentTaskId: ROOT });

const COPIES = [
  ['a live row', async () => {
    await getDb().tasks.put(instance(OLDER));
  }],
  ['an archive row', async () => {
    await getDb().archivedTasks.put({ ...instance(OLDER), archivedAt: OLDER });
  }],
  ['a Trash row', async () => {
    await getDb().deletedTasks.put({ ...toTrashedRecord(instance(OLDER)), deletedAt: OLDER });
  }],
] as const;

const OVERWRITES = [
  ['a pull', () => fullSync('auto')],
  ['a realtime change', () => applyRemoteChange('update', serverRow(EDITED) as unknown as RecordModel, 'user-1')],
] as const;

async function expectEditedWithLink(): Promise<void> {
  await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Edited elsewhere', parentTaskId: ROOT });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetFakeSync();
  await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), server: [serverRow(EDITED)] });
});

describe.each(COPIES)('a newer server copy over %s', (_name, place) => {
  it.each(OVERWRITES)('%s keeps the recurrence chain link', async (_how, overwrite) => {
    await place();

    await overwrite();

    await expectEditedWithLink();
  });
});

it('the resurrect step keeps the link on a task it brings back from Trash', async () => {
  // Trashed while signed out, after the server's last edit: the pull leaves it, the step brings it back.
  await getDb().deletedTasks.put({ ...toTrashedRecord(instance(SAVED)), deletedAt: NEWER });
  await rememberForResurrect(['t-a']);

  await fullSync('auto');

  await expectEditedWithLink();
});

it('the resurrect step keeps the link when it takes a newer server copy over a live row', async () => {
  // Restored here while signed out: the step runs on its own so the pull can't overwrite the row first.
  await getDb().tasks.put(instance(OLDER));
  await rememberForResurrect(['t-a']);

  await resurrectOnSight('user-1');

  await expectEditedWithLink();
});
