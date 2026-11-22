/**
 * The sync engine with the real mapper, queue, retry manager, history, and
 * fake-indexeddb. Only PocketBase, the token refresh, and toasts are faked, so a
 * test reads back what the user and the server would see.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sync/pocketbase-client', async () => {
  const { fake } = await import('../data/sync/support/fake-pocketbase');
  return {
    getPocketBase: () => fake.pb,
    getCurrentUserId: vi.fn(() => 'user-1'),
    isAuthenticated: () => true,
    clearPocketBase: () => {},
    forgetRefusedToken: () => {},
  };
});
vi.mock('@/lib/sync/pb-auth', () => ({ ensureValidAuth: vi.fn(async () => true) }));
vi.mock('@/lib/sync/notifications', () => ({ notifySyncSuccess: vi.fn(), notifySyncError: vi.fn() }));

import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
import { isAuthError } from '@/lib/sync/error-categorizer';
import { notifySyncError } from '@/lib/sync/notifications';
import { fullSync, pullRemoteChanges, pushLocalChanges } from '@/lib/sync/pb-sync-engine';
import { getCurrentUserId } from '@/lib/sync/pocketbase-client';
import { getSyncQueue } from '@/lib/sync/queue';
import type { PBSyncConfig } from '@/lib/sync/types';
import type { TaskRecord } from '@/lib/types';
import {
  NEWER, OLDER, SAVED, fake, localRow, resetFakeSync, seed, serverRow, signedIn,
} from '../data/sync/support/fake-pocketbase';

const SAVED_MINUS_OVERLAP = '2026-10-20T09:59:30.000Z';
const NEWER_MINUS_OVERLAP = '2026-10-21T09:59:30.000Z';
const SYSTEM_UPDATED_LATER = '2026-10-25 10:00:00.000Z';
const current = (): PBSyncConfig => signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION);

const remote = (taskId: string, stamp: string, extra: Record<string, unknown> = {}) =>
  serverRow({
    id: `rec_${taskId}`, task_id: taskId, client_updated_at: stamp, saved_at: '', updated: SYSTEM_UPDATED_LATER, ...extra,
  });

const storedConfig = async (): Promise<PBSyncConfig> =>
  (await getDb().syncMetadata.get('sync_config')) as PBSyncConfig;

function signOutOfTheSdk(): void {
  vi.mocked(getCurrentUserId).mockReturnValue(null);
}

/** The query of the first listing, which is the pull's. */
function watchPullQuery(): () => { filter?: string; sort?: string } {
  const list = vi.spyOn(fake.pb.collection('tasks'), 'getList');
  return () => list.mock.calls[0][2] as { filter?: string; sort?: string };
}

async function queueCreate(task: TaskRecord): Promise<void> {
  await getDb().tasks.put(task);
  await getSyncQueue().enqueue('create', task.id, task);
}

beforeEach(async () => {
  await resetFakeSync();
  vi.mocked(getCurrentUserId).mockReturnValue('user-1');
  vi.mocked(notifySyncError).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pushLocalChanges', () => {
  beforeEach(async () => {
    await seed({ config: current() });
  });

  it('reports no session, and leaves the queue alone, when nobody is signed in', async () => {
    await queueCreate(localRow(SAVED));
    signOutOfTheSdk();

    const result = await pushLocalChanges('user-1');

    expect(result).toMatchObject({ authenticated: false, pushedCount: 0 });
    expect(await getDb().syncQueue.count()).toBe(1);
  });

  it('reports the session when nothing is queued', async () => {
    expect(await pushLocalChanges('user-1')).toMatchObject({ authenticated: true, pushedCount: 0 });
  });

  it('keeps a delete and charges one try when the lookup fails', async () => {
    await getSyncQueue().enqueue('delete', 'task-a', null);
    vi.spyOn(fake.pb.collection('tasks'), 'getFirstListItem')
      .mockRejectedValueOnce(Object.assign(new Error('Something went wrong.'), { status: 0 }));

    const result = await pushLocalChanges('user-1');

    expect(result.failedCount).toBe(1);
    expect(await getDb().syncQueue.toArray()).toMatchObject([{ operation: 'delete', retryCount: 1 }]);
  });

  it('drops a delete the server no longer has, once it has confirmed the session', async () => {
    await getSyncQueue().enqueue('delete', 'task-a', null);

    const result = await pushLocalChanges('user-1');

    expect(fake.state.events).toContain('auth-refresh');
    expect(result.pushedCount).toBe(1);
    expect(await getDb().syncQueue.count()).toBe(0);
  });
});

describe('pullRemoteChanges', () => {
  beforeEach(async () => {
    await seed({ config: current() });
  });

  it('reports no session when nobody is signed in', async () => {
    signOutOfTheSdk();

    expect(await pullRemoteChanges(null)).toMatchObject({
      authenticated: false, pulledCount: 0, maxObservedTimestamp: null,
    });
  });

  it('asks on client_updated_at, never on the system updated field', async () => {
    const query = watchPullQuery();

    await pullRemoteChanges(SAVED);

    expect(query().sort).toBe('client_updated_at,task_id,id');
    expect(query().filter).toBe(`owner = "user-1" && client_updated_at >= "${SAVED}"`);
  });

  it('sets the cursor to the newest applied stamp, less the overlap', async () => {
    await seed({ config: current(), server: [remote('task-a', OLDER), remote('task-b', NEWER), remote('task-c', SAVED)] });

    expect((await pullRemoteChanges(null)).maxObservedTimestamp).toBe(NEWER_MINUS_OVERLAP);
  });

  it('leaves the cursor alone when the local copy already has that version', async () => {
    await seed({ config: current(), local: [localRow(SAVED)], server: [remote('task-a', SAVED)] });

    expect(await pullRemoteChanges(null)).toMatchObject({ pulledCount: 0, maxObservedTimestamp: null });
  });

  it('takes the cursor from records that have no system updated field', async () => {
    await seed({ config: current(), server: [remote('task-a', OLDER, { updated: '' }), remote('task-b', SAVED, { updated: undefined })] });

    expect(await pullRemoteChanges(null)).toMatchObject({ pulledCount: 2, maxObservedTimestamp: SAVED_MINUS_OVERLAP });
  });

  it('has no cursor to offer when nothing came back', async () => {
    expect((await pullRemoteChanges(SAVED)).maxObservedTimestamp).toBeNull();
  });

  it('skips an invalid record, and never moves the cursor past it', async () => {
    await seed({ config: current(), server: [remote('task-a', SAVED), remote('task-b', NEWER, { title: 123 })] });

    const result = await pullRemoteChanges(null);

    expect(result).toMatchObject({ pulledCount: 1, skippedCount: 1, maxObservedTimestamp: SAVED_MINUS_OVERLAP });
    expect(await getDb().tasks.toCollection().primaryKeys()).toEqual(['task-a']);
  });
});

describe('fullSync', () => {
  it('asks for sign-in, and records the failure, when nobody is signed in', async () => {
    await seed({ config: { ...current(), lastSyncAt: OLDER } });
    signOutOfTheSdk();

    const result = await fullSync('auto');

    expect(result.status).toBe('error');
    expect(isAuthError(new Error(result.error))).toBe(true);
    expect(await storedConfig()).toMatchObject({ lastSyncAt: OLDER, consecutiveFailures: 1, lastSuccessfulSyncAt: null });
    expect(await getDb().syncHistory.toArray()).toMatchObject([{ status: 'error' }]);
    expect(notifySyncError).toHaveBeenCalled();
  });

  it('stores the cursor and the pull contract, and leaves the legacy cursor alone', async () => {
    await seed({ config: { ...current(), lastSyncAt: OLDER }, server: [remote('task-a', SAVED)] });

    expect((await fullSync('auto')).status).toBe('success');

    expect(await storedConfig()).toMatchObject({
      lastClientUpdatedAt: SAVED_MINUS_OVERLAP,
      pullCursorVersion: SYNC_CONFIG.PULL_CURSOR_VERSION,
      lastServerUpdatedAt: null,
      lastSyncAt: OLDER,
    });
  });

  it('discards an unversioned server cursor and pulls everything', async () => {
    await seed({ config: { ...signedIn(), lastSyncAt: OLDER, lastServerUpdatedAt: SAVED } });
    const query = watchPullQuery();

    await fullSync('auto');

    expect(query().filter).toBe('owner = "user-1"');
    expect(await storedConfig()).toMatchObject({
      lastServerUpdatedAt: null, lastClientUpdatedAt: null, pullCursorVersion: SYNC_CONFIG.PULL_CURSOR_VERSION,
    });
  });

  it('pulls everything for a legacy client-stamped cursor', async () => {
    await seed({ config: { ...signedIn(), lastSyncAt: SAVED } });
    const query = watchPullQuery();

    await fullSync('auto');

    expect(query().filter).toBe('owner = "user-1"');
  });

  it('records a partial push as a failure, never as a success', async () => {
    await seed({ config: current() });
    await queueCreate(localRow(SAVED));
    await queueCreate(localRow(SAVED, { id: 'task-b' }));
    vi.spyOn(fake.pb.collection('tasks'), 'create')
      .mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 500 }));

    const result = await fullSync('auto');

    expect(result.status).toBe('partial');
    expect(fake.state.records.size).toBe(1);
    expect(await getDb().syncQueue.toArray()).toMatchObject([{ retryCount: 1 }]);
    expect(await storedConfig()).toMatchObject({ consecutiveFailures: 1 });
    expect(await getDb().syncHistory.toArray()).toMatchObject([{ status: 'partial' }]);
  });

  it('keeps the cursor when nothing new came back', async () => {
    await seed({ config: { ...current(), lastClientUpdatedAt: OLDER } });

    expect((await fullSync('auto')).status).toBe('success');

    expect(await storedConfig()).toMatchObject({ lastClientUpdatedAt: OLDER, lastServerUpdatedAt: null });
  });
});
