/**
 * Pull contract 4 (tasks/spec-top-three.md section 6), web rows of the named
 * tests. The generic C4-1 and C4-2 rows landed with WEB-SAVED and live in
 * saved-at-unread-push.test.ts. "Contract 3" below is the build before this
 * one: it read saved_at but never heard of the focus pair.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getSyncQueue } from '@/lib/sync/queue';
import {
  AUTH, FAR_FUTURE, NEWER, SAVED, fake, localRow, localTask, resetFakeSync, seed, sentValue,
  serverField, serverRow, signedIn, signedOut, storedVersion,
} from './support/fake-pocketbase';

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

import { fullSync } from '@/lib/sync/pb-sync-engine';
import { persistSyncConfig } from '@/components/sync/use-sync-auth-dialog';

const CONTRACT_3 = 3;
const PICK = { focusDate: '2026-11-07', focusRank: 2 };
/** Another device picked the task. No saved_at, so only the pick is in play. */
const pickedOnServer = (overrides: Record<string, unknown> = {}) =>
  serverRow({ saved_at: '', focus_date: PICK.focusDate, focus_rank: PICK.focusRank, ...overrides });

const serverPick = () => ({ focusDate: serverField('focus_date'), focusRank: serverField('focus_rank') });
const sentEmptyPick = (): boolean => sentValue('focus_date', '') || sentValue('focus_rank', 0);

beforeEach(async () => {
  vi.clearAllMocks();
  await resetFakeSync();
});

describe('C4-1: the stored version alone decides', () => {
  it('backfill runs with a null cursor', async () => {
    await seed({ config: signedIn(CONTRACT_3), local: [localRow(SAVED)], server: [pickedOnServer()] });

    await fullSync('auto');

    await expect(localTask()).resolves.toMatchObject(PICK);
    await expect(storedVersion()).resolves.toBe(SYNC_CONFIG.PULL_CURSOR_VERSION);
  });

  it('sign-out, upgrade, and sign-in keep the server pick', async () => {
    await seed({ config: signedOut(CONTRACT_3), local: [localRow(SAVED)], server: [pickedOnServer()] });
    await persistSyncConfig(AUTH);

    await fullSync('auto');

    expect(sentEmptyPick()).toBe(false);
    expect(serverPick()).toEqual(PICK);
    await expect(localTask()).resolves.toMatchObject(PICK);
  });
});

// C4-1 reads "missing or below 4", so a newer build's stamp isn't a backfill (S-AND review,
// finding 2). The write still stamps this build's own version: an older bundle's lower stamp
// is what tells a newer tab that rows were rewritten without its newest field.
describe('C4-1: a stored version above this build', () => {
  const NEWER_BUILD = SYNC_CONFIG.PULL_CURSOR_VERSION + 1;

  it("a stored version above this build's doesn't trigger a backfill", async () => {
    await seed({ config: signedIn(NEWER_BUILD), local: [localRow(SAVED)], server: [pickedOnServer()] });

    await fullSync('auto');

    const row = await localTask();
    expect(row?.focusDate).toBeUndefined();
    expect(row?.focusRank).toBeUndefined();
  });

  it("a completed pull stamps this build's version, even over a higher one", async () => {
    await seed({ config: signedIn(NEWER_BUILD), local: [localRow(SAVED)], server: [pickedOnServer()] });

    await fullSync('auto');

    await expect(storedVersion()).resolves.toBe(SYNC_CONFIG.PULL_CURSOR_VERSION);
  });
});

describe('C4-4: a locally newer row gets only the fields it never knew about', () => {
  it('a locally newer row gets the server pick through the backfill', async () => {
    const row = localRow(NEWER, { title: 'Edited on contract 3' });
    await seed({ config: signedIn(CONTRACT_3), local: [row], queued: [row], server: [pickedOnServer()] });

    await fullSync('auto');

    expect(serverPick()).toEqual(PICK);
    expect(serverField('title')).toBe('Edited on contract 3');
    await expect(localTask()).resolves.toMatchObject({ ...PICK, updatedAt: NEWER });
  });

  it('a real return survives the contract 4 backfill', async () => {
    const returned = localRow(NEWER);
    await seed({ config: signedIn(CONTRACT_3), local: [returned], queued: [returned], server: [serverRow()] });

    await fullSync('auto');

    expect(serverField('saved_at')).toBe('');
    expect((await localTask())?.savedAt).toBeUndefined();
  });

  it('an ordinary pull leaves a local un-pick alone', async () => {
    await seed({
      config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION),
      local: [localRow(NEWER)],
      server: [pickedOnServer()],
    });

    await fullSync('auto');

    const row = await localTask();
    expect(row?.focusDate).toBeUndefined();
    expect(row?.focusRank).toBeUndefined();
  });

  it('the backfill leaves the queue empty when nothing changed', async () => {
    await seed({ config: signedIn(CONTRACT_3), local: [localRow(NEWER)], server: [pickedOnServer()] });

    await fullSync('auto');

    await expect(getSyncQueue().getPendingCount()).resolves.toBe(0);
    expect(fake.state.writes).toHaveLength(0);
    await expect(localTask()).resolves.toMatchObject({ ...PICK, updatedAt: NEWER });
  });

  // S-SPEC-01: the hold-off keeps the local row, and the row still takes the unread pick.
  it('a far-future remote with a queued edit keeps the server pick through the backfill', async () => {
    const row = localRow(NEWER, { title: 'Local edit' });
    await seed({
      config: signedIn(CONTRACT_3),
      local: [row],
      queued: [row],
      server: [pickedOnServer({ client_updated_at: FAR_FUTURE })],
    });

    await fullSync('auto');

    expect(sentEmptyPick()).toBe(false);
    expect(serverPick()).toEqual(PICK);
    await expect(localTask()).resolves.toMatchObject({ title: 'Local edit', ...PICK });
  });
});

describe('C4-5 and C4-6: push takes the pair from the row', () => {
  it('a queued payload from an older build keeps the server pick', async () => {
    const olderPayload = localRow(NEWER);
    await seed({
      config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION),
      local: [{ ...olderPayload, ...PICK }],
      queued: [olderPayload],
      server: [pickedOnServer()],
    });

    await fullSync('auto');

    expect(fake.state.writes.map((w) => [w.body.focus_date, w.body.focus_rank])).toEqual([[PICK.focusDate, PICK.focusRank]]);
    expect(serverPick()).toEqual(PICK);
  });

  it('a same-version row with a queued change keeps the server pick', async () => {
    const row = localRow(SAVED);
    await seed({ config: signedIn(CONTRACT_3), local: [row], queued: [row], server: [pickedOnServer()] });

    await fullSync('auto');

    expect(sentEmptyPick()).toBe(false);
    expect(serverPick()).toEqual(PICK);
    await expect(localTask()).resolves.toMatchObject(PICK);
  });

  it("a queued item for a row that's gone omits both keys", async () => {
    await seed({
      config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION),
      queued: [localRow(NEWER)],
      server: [pickedOnServer()],
    });

    await fullSync('auto');

    expect(fake.state.writes).toHaveLength(1);
    expect(fake.state.writes[0].body).not.toHaveProperty('focus_date');
    expect(fake.state.writes[0].body).not.toHaveProperty('focus_rank');
    expect(serverPick()).toEqual(PICK);
  });
});
