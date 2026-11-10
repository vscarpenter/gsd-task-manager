/**
 * A session the server refuses, as after "Sign out of all devices" on another
 * device, reads as a guest. PocketBase then lists `tasks` as 200 with no items
 * and 404s every lookup, the same answers an empty account gives (audit
 * 2026-11-10, P1 item 2: SYNC-3, SYNC-10). Runs the real fullSync, push, pull,
 * auth check, and queue against fake-indexeddb, with only PocketBase faked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
import { isAuthError } from '@/lib/sync/error-categorizer';
import {
  NEWER, SAVED, fake, localRow, resetFakeSync, seed, serverRow, sessionToken, signedIn,
} from './support/fake-pocketbase';

vi.mock('@/lib/sync/pocketbase-client', async (importOriginal) => {
  const { fake: server } = await import('./support/fake-pocketbase');
  const store = server.pb.authStore;
  return {
    ...(await importOriginal<typeof import('@/lib/sync/pocketbase-client')>()),
    getPocketBase: () => server.pb,
    getCurrentUserId: () => (store.isValid ? store.record?.id ?? null : null),
    isAuthenticated: () => store.isValid,
    clearPocketBase: vi.fn(),
  };
});

vi.mock('@/lib/sync/notifications', () => ({
  notifySyncSuccess: vi.fn(),
  notifySyncError: vi.fn(),
}));

import { fullSync } from '@/lib/sync/pb-sync-engine';
import { notifySyncError } from '@/lib/sync/notifications';
import { readRememberedTaskIds, rememberForResurrect } from '@/lib/sync/resurrect-ids';
import { deleteTask } from '@/lib/tasks/crud';
import { toTrashedRecord } from '@/lib/trash';

const CURRENT = SYNC_CONFIG.PULL_CURSOR_VERSION;
const USER = { id: 'user-1', collectionId: '_pb_users_auth_', collectionName: 'users' };
const SIGN_IN_PROMPT = 'Please sign in to sync your tasks';

/** "Sign out of all devices" elsewhere rotated the token key, so this token is refused. */
function refuseSession(): void {
  fake.state.refused = true;
}

/** Signing in again saves a token the server accepts. */
function signBackIn(): void {
  fake.state.refused = false;
  fake.pb.authStore.save(sessionToken(30), USER);
}

const queuedRows = () => getDb().syncQueue.toArray();
const asksForSignIn = () => expect(notifySyncError).toHaveBeenCalledWith(SIGN_IN_PROMPT, false);

beforeEach(async () => {
  vi.clearAllMocks();
  await resetFakeSync();
  // More than seven days left, so ensureValidAuth sends nothing. This is every
  // sync in the three weeks after a revoke.
  fake.pb.authStore.save(sessionToken(30), USER);
});

describe('a delete queued under a refused session', () => {
  beforeEach(async () => {
    await seed({ config: signedIn(CURRENT), local: [localRow(SAVED)], server: [serverRow()] });
    await deleteTask('t-a');
    refuseSession();
  });

  it('stays queued with its retry budget, and the server keeps the record', async () => {
    await fullSync('auto');

    await expect(queuedRows()).resolves.toMatchObject([
      { taskId: 't-a', operation: 'delete', status: 'pending', retryCount: 0 },
    ]);
    expect(fake.state.records.has('rec_a')).toBe(true);
  });

  it('asks the user to sign in again', async () => {
    const result = await fullSync('auto');

    expect(result.status).toBe('error');
    expect(isAuthError(new Error(result.error))).toBe(true);
    asksForSignIn();
  });

  it('forgets the refused token, so the sync dialog offers sign-in', async () => {
    await fullSync('auto');

    expect(fake.pb.authStore.token).toBe('');
  });

  it('reaches the server once the user signs in again', async () => {
    await fullSync('auto');
    signBackIn();

    const result = await fullSync('auto');

    expect(result.status).toBe('success');
    expect(fake.state.records.has('rec_a')).toBe(false);
    await expect(queuedRows()).resolves.toEqual([]);
  });
});

describe('edits queued under a refused session', () => {
  it('keep their retry budget, so no row retires to Trash, and nothing is sent', async () => {
    const edited = localRow(NEWER, { title: 'Edited here' });
    const other = localRow(NEWER, { id: 't-b', title: 'Also edited here' });
    await seed({
      config: signedIn(CURRENT),
      local: [edited, other],
      queued: [edited, other],
      server: [serverRow(), serverRow({ id: 'rec_b', task_id: 't-b' })],
    });
    refuseSession();

    const result = await fullSync('auto');

    const rows = await queuedRows();
    expect(rows.map(({ taskId, status, retryCount }) => ({ taskId, status, retryCount }))).toEqual(
      expect.arrayContaining([
        { taskId: 't-a', status: 'pending', retryCount: 0 },
        { taskId: 't-b', status: 'pending', retryCount: 0 },
      ]),
    );
    expect(fake.state.events).not.toContain('create');
    expect(fake.state.events).not.toContain('update');
    expect(isAuthError(new Error(result.error))).toBe(true);
  });
});

describe('local tasks under a refused session', () => {
  it('stay on the device, and the sync asks for sign-in', async () => {
    await seed({ config: signedIn(CURRENT), local: [localRow(SAVED)], server: [serverRow()] });
    refuseSession();

    const result = await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toBeDefined();
    expect(isAuthError(new Error(result.error))).toBe(true);
    asksForSignIn();
  });
});

describe('a delete remembered for resurrect on sight, under a refused session', () => {
  it('stays remembered, and the sync asks for sign-in', async () => {
    await seed({ config: signedIn(CURRENT), server: [serverRow()] });
    await getDb().deletedTasks.put(toTrashedRecord(localRow(SAVED)));
    await rememberForResurrect(['t-a']);
    refuseSession();

    const result = await fullSync('auto');

    await expect(readRememberedTaskIds()).resolves.toEqual(['t-a']);
    expect(isAuthError(new Error(result.error))).toBe(true);
    asksForSignIn();
  });
});

describe('a refused session in its last seven days', () => {
  it('stops at the token refresh and asks for sign-in', async () => {
    fake.pb.authStore.save(sessionToken(3), USER);
    const edited = localRow(NEWER, { title: 'Edited here' });
    await seed({ config: signedIn(CURRENT), local: [edited], queued: [edited], server: [serverRow()] });
    refuseSession();

    const result = await fullSync('auto');

    expect(fake.state.events).toEqual(['auth-refresh']);
    expect(isAuthError(new Error(result.error))).toBe(true);
    expect(fake.pb.authStore.token).toBe('');
    asksForSignIn();
  });
});

describe('a session the server confirms', () => {
  it('drops a delete whose record is already gone, after asking once', async () => {
    await seed({ config: signedIn(CURRENT), local: [localRow(SAVED)] });
    await deleteTask('t-a');

    const result = await fullSync('auto');

    expect(result.status).toBe('success');
    await expect(queuedRows()).resolves.toEqual([]);
    expect(fake.state.events.filter((event) => event === 'auth-refresh')).toHaveLength(1);
  });

  it('asks once per push before creating tasks the server has never seen', async () => {
    const first = localRow(NEWER);
    const second = localRow(NEWER, { id: 't-b', title: 'Second' });
    await seed({ config: signedIn(CURRENT), local: [first, second], queued: [first, second] });

    const result = await fullSync('auto');

    expect(result.status).toBe('success');
    expect(fake.state.events.filter((event) => event === 'auth-refresh')).toHaveLength(1);
    expect(fake.state.records.size).toBe(2);
  });

  it('keeps the token it was given: the check saves nothing', async () => {
    const token = sessionToken(30);
    fake.pb.authStore.save(token, USER);
    await seed({ config: signedIn(CURRENT), local: [localRow(SAVED)] });
    await deleteTask('t-a');

    await fullSync('auto');

    expect(fake.pb.authStore.token).toBe(token);
  });
});

describe('a session check that fails for another reason', () => {
  beforeEach(async () => {
    await seed({ config: signedIn(CURRENT), local: [localRow(SAVED)] });
    await deleteTask('t-a');
  });

  it("keeps a delete queued when the session is another account's", async () => {
    fake.state.authRefreshUserId = 'user-2';

    const result = await fullSync('auto');

    expect(result.status).toBe('error');
    await expect(queuedRows()).resolves.toMatchObject([{ operation: 'delete', status: 'pending', retryCount: 0 }]);
  });

  it('keeps a delete queued when auth-refresh gets no answer, and keeps the token', async () => {
    fake.state.failAuthRefresh = true;

    await fullSync('auto');

    await expect(queuedRows()).resolves.toMatchObject([{ operation: 'delete', status: 'pending' }]);
    expect(fake.pb.authStore.token).not.toBe('');
  });
});
