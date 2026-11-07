/**
 * Resurrect on sight, web rows of tasks/spec-resurrect-on-sight.md section 6. A delete made
 * while signed out is a local act: the server copy wins, and the task comes back here once
 * the account lists it. Runs the real sync, delete, archive, sign-in, sign-out, and erase
 * against fake-indexeddb, with only PocketBase faked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import {
  AUTH, FAR_FUTURE, NEWER, OLDER, SAVED, fake, localRow, resetFakeSync, seed, serverRow, signedIn, signedOut,
} from './support/fake-pocketbase';

const auth = vi.hoisted(() => ({ userId: 'user-1' as string | null }));

vi.mock('@/lib/sync/pocketbase-client', async () => {
  const { fake: server } = await import('./support/fake-pocketbase');
  return {
    getPocketBase: () => server.pb,
    getCurrentUserId: () => auth.userId,
    isAuthenticated: () => auth.userId !== null,
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

import { fullSync } from '@/lib/sync/pb-sync-engine';
import { disableSync } from '@/lib/sync/config';
import { readRememberedTaskIds, rememberForResurrect } from '@/lib/sync/resurrect-ids';
import { resurrectOnSight } from '@/lib/sync/resurrect-on-sight';
import { persistSyncConfig } from '@/components/sync/use-sync-auth-dialog';
import { deleteTask } from '@/lib/tasks/crud';
import { importTasks } from '@/lib/tasks';
import { archiveTaskNow } from '@/lib/archive';
import { wipeLocalData } from '@/lib/reset-local-data';
import { deleteFromTrashForever, emptyTrash, purgeExpiredTrash, restoreFromTrash, toTrashedRecord } from '@/lib/trash';
import { restoreTask } from '@/lib/tasks/crud/restore';

const CURRENT = SYNC_CONFIG.PULL_CURSOR_VERSION;
/** A trash row from a delete made while signed out, after the server's last edit. */
const trashedHere = () => ({ ...toTrashedRecord(localRow(SAVED)), deletedAt: NEWER });
const remembered = () => readRememberedTaskIds();

beforeEach(async () => {
  vi.clearAllMocks();
  auth.userId = 'user-1';
  await resetFakeSync();
});

describe('remembering', () => {
  it.each([
    ['signed out', true],
    ['never signed in', false],
  ])('a delete made while signed out is remembered (%s)', async (_name, hasConfig) => {
    if (hasConfig) await getDb().syncMetadata.put(signedOut(CURRENT));
    await getDb().tasks.add(localRow(SAVED));

    await deleteTask('t-a');

    await expect(remembered()).resolves.toEqual(['t-a']);
    await expect(getSyncQueue().getPendingCount()).resolves.toBe(0);
  });

  // Sign-in rewrites the sync_config row from a fresh literal, so the ids need a key of their own.
  it('sign-in keeps the remembered ids', async () => {
    await seed({ config: signedOut(CURRENT), local: [localRow(SAVED)] });
    await deleteTask('t-a');

    await persistSyncConfig(AUTH);

    await expect(remembered()).resolves.toEqual(['t-a']);
  });

  it('sign-out remembers the Trash deletes it clears from the queue', async () => {
    await seed({ config: signedIn(CURRENT) });
    const queue = getSyncQueue();
    await queue.enqueue('delete', 't-trash', null);
    await queue.enqueue('delete', 't-archive', localRow(SAVED, { id: 't-archive' }));
    await queue.enqueue('update', 't-edit', localRow(SAVED, { id: 't-edit' }));

    await disableSync();

    await expect(remembered()).resolves.toEqual(['t-trash']);
    await expect(getDb().syncQueue.count()).resolves.toBe(0);
  });

  it("an archive made while signed out stays archived and isn't remembered", async () => {
    await seed({ config: signedOut(CURRENT), local: [localRow(SAVED, { completed: true })], server: [serverRow({ saved_at: '' })] });

    await archiveTaskNow('t-a');
    await persistSyncConfig(AUTH);
    await fullSync('auto');

    await expect(remembered()).resolves.toEqual([]);
    await expect(getDb().archivedTasks.get('t-a')).resolves.toBeDefined();
    await expect(getDb().tasks.get('t-a')).resolves.toBeUndefined();
  });

  // S-WEB-05: an id matters only while its Trash row exists, so each way out forgets it.
  describe('a Trash row that leaves takes its id with it', () => {
    beforeEach(async () => {
      await getDb().syncMetadata.put(signedOut(CURRENT));
      await getDb().tasks.bulkAdd([localRow(SAVED), localRow(SAVED, { id: 't-b' })]);
      await deleteTask('t-a');
      await deleteTask('t-b');
    });

    it('restore from Trash', async () => {
      await restoreFromTrash('t-a');
      await expect(remembered()).resolves.toEqual(['t-b']);
    });

    it('undo after delete', async () => {
      await restoreTask(localRow(SAVED));
      await expect(remembered()).resolves.toEqual(['t-b']);
    });

    it('delete forever', async () => {
      await deleteFromTrashForever('t-a');
      await expect(remembered()).resolves.toEqual(['t-b']);
    });

    it('empty Trash', async () => {
      await emptyTrash();
      await expect(remembered()).resolves.toEqual([]);
    });

    it('the 30-day purge, which keeps a row still in its window', async () => {
      await getDb().deletedTasks.update('t-a', { deletedAt: '2020-01-01T00:00:00.000Z' });

      await purgeExpiredTrash();

      await expect(remembered()).resolves.toEqual(['t-b']);
    });
  });

  it('erasing local data forgets every remembered id', async () => {
    await rememberForResurrect(['t-a', 't-b']);

    await wipeLocalData();

    await expect(remembered()).resolves.toEqual([]);
  });
});

describe('the step after the pull', () => {
  it('a remembered delete comes back when the account lists the task', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '', title: 'From the account' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);

    await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'From the account' });
    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeUndefined();
    await expect(remembered()).resolves.toEqual([]);
  });

  // The server copy merges into the Trash row, as a pull merges into a live row. Reminder state
  // is this device's own; time-entry notes ride the wire on web, so they arrive with the copy.
  it("a resurrected task keeps this device's reminder state and time-entry notes", async () => {
    const due = '2026-10-25T09:00:00.000Z';
    const entry = { id: 'te-1', startedAt: OLDER, endedAt: SAVED, notes: 'first pass' };
    const reminded = { notificationSent: true, lastNotificationAt: SAVED, snoozedUntil: NEWER };
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '', due_date: due, time_entries: [entry] })] });
    await getDb().deletedTasks.put({
      ...toTrashedRecord(localRow(SAVED, { dueDate: due, timeEntries: [entry], ...reminded })),
      deletedAt: NEWER,
    });
    await rememberForResurrect(['t-a']);

    await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ ...reminded, timeEntries: [entry] });
  });

  it('a remembered delete with no server copy keeps its Trash copy and is forgotten', async () => {
    await seed({ config: signedIn(CURRENT) });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);

    await fullSync('auto');

    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeDefined();
    await expect(remembered()).resolves.toEqual([]);
  });

  it('a remembered id active again with a newer local edit keeps the local copy', async () => {
    await seed({
      config: signedIn(CURRENT),
      local: [localRow(NEWER, { title: 'Restored and edited here' })],
      server: [serverRow({ saved_at: '', title: 'Older on the account' })],
    });
    await rememberForResurrect(['t-a']);

    await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Restored and edited here' });
    await expect(remembered()).resolves.toEqual([]);
  });

  it('a dead session forgets no remembered delete', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);
    fake.state.authRefreshUserId = null;

    await fullSync('auto');

    await expect(remembered()).resolves.toEqual(['t-a']);
    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeDefined();
  });

  it('an unauthenticated pull forgets no remembered delete', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);
    auth.userId = null;

    await fullSync('auto');

    await expect(remembered()).resolves.toEqual(['t-a']);
  });

  it('an incomplete listing forgets no remembered delete', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);
    fake.state.failListing = true;

    await fullSync('auto');

    await expect(remembered()).resolves.toEqual(['t-a']);
    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeDefined();
  });

  it('a held-off remembered id stays for the next run', async () => {
    const restored = localRow(NEWER, { title: 'Restored and edited here' });
    await seed({
      config: signedIn(CURRENT),
      local: [restored],
      queued: [restored],
      server: [serverRow({ saved_at: '', title: 'Edit from a fast clock', client_updated_at: FAR_FUTURE })],
    });
    await rememberForResurrect(['t-a']);
    fake.state.failUpdate = true;

    await fullSync('auto');

    await expect(remembered()).resolves.toEqual(['t-a']);
    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Restored and edited here' });

    fake.state.failUpdate = false;
    await fullSync('auto');

    await expect(remembered()).resolves.toEqual([]);
    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Restored and edited here' });
  });

  it("another account's session forgets no remembered delete", async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);
    fake.state.authRefreshUserId = 'user-2';

    await fullSync('auto');

    await expect(remembered()).resolves.toEqual(['t-a']);
  });

  // pb-sync-reviewer: an unreadable record isn't a complete listing for that id (rule 5).
  it('a remembered id whose server copy is unreadable stays for the next run', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '', title: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);

    await fullSync('auto');

    await expect(remembered()).resolves.toEqual(['t-a']);
    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeDefined();
  });

  // pb-sync-reviewer: deleting it again while signed in is the user's latest act.
  it('a remembered id with a pending delete stays in Trash and is kept', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await getSyncQueue().enqueue('delete', 't-a', null);
    await rememberForResurrect(['t-a']);

    await resurrectOnSight('user-1');

    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeDefined();
    await expect(getDb().tasks.get('t-a')).resolves.toBeUndefined();
    await expect(remembered()).resolves.toEqual(['t-a']);
  });

  // pb-sync-reviewer: the push already committed, so a failed step must not fail the sync.
  it('a step that fails forgets nothing and leaves the sync successful', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });
    await getDb().deletedTasks.put(trashedHere());
    await rememberForResurrect(['t-a']);
    vi.spyOn(getDb().deletedTasks, 'delete').mockRejectedValueOnce(new Error('QuotaExceededError'));

    const result = await fullSync('auto');

    expect(result.status).toBe('success');
    await expect(remembered()).resolves.toEqual(['t-a']);
    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeDefined();
  });

  it('nothing remembered means no extra listing', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '' })] });

    await fullSync('auto');

    expect(fake.state.events).not.toContain('listing');
  });

  // Reading 2 (section 8, owner item 26): the archive is the user's last act, so it stands.
  it('a remembered id with an archive row stays archived', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow({ saved_at: '', title: 'From the account' })] });
    await getDb().archivedTasks.put({ ...localRow(SAVED, { completed: true }), archivedAt: NEWER });
    await rememberForResurrect(['t-a']);

    await fullSync('auto');

    await expect(getDb().archivedTasks.get('t-a')).resolves.toBeDefined();
    await expect(getDb().tasks.get('t-a')).resolves.toBeUndefined();
    await expect(remembered()).resolves.toEqual([]);
  });
});

describe('end to end', () => {
  it('a task trashed signed out comes back out of Trash after the next sign-in', async () => {
    await seed({ config: signedOut(CURRENT), local: [localRow(SAVED)], server: [serverRow({ saved_at: '' })] });

    await deleteTask('t-a');
    await persistSyncConfig(AUTH);
    await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toBeDefined();
    await expect(getDb().deletedTasks.get('t-a')).resolves.toBeUndefined();
    expect(fake.state.events).not.toContain('delete');
    expect(fake.state.records.has('rec_a')).toBe(true);
  });

  it('a Replace import made signed out deletes nothing on the server after the next sign-in', async () => {
    await seed({ config: signedOut(CURRENT), local: [localRow(SAVED)], server: [serverRow({ saved_at: '' })] });

    await importTasks({ tasks: [], exportedAt: NEWER, version: '2.1.0' }, 'replace');
    await persistSyncConfig(AUTH);
    await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toBeDefined();
    expect(fake.state.events).not.toContain('delete');
  });

  it('a delete made while signed in still deletes on the server', async () => {
    await seed({ config: signedIn(CURRENT), local: [localRow(SAVED)], server: [serverRow({ saved_at: '' })] });

    await deleteTask('t-a');
    await fullSync('auto');

    expect(fake.state.records.has('rec_a')).toBe(false);
    await expect(remembered()).resolves.toEqual([]);
  });
});
