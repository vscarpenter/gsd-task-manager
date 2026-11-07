/**
 * Goal 0, owner item 7: a device that never read saved_at must not send it.
 *
 * Runs the real fullSync, push, pull, mapper, queue, sign-in, and sign-out
 * against fake-indexeddb. Only PocketBase is faked, and its update merges the
 * keys it receives, as PocketBase does. The a-numbered cases are the web cases
 * in sprint/findings/saved-at-exposure.md. The other names come from the top
 * three spec, section 6.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import type { PBSyncConfig } from '@/lib/sync/types';
import type { RecordModel } from 'pocketbase';
import type { TaskRecord } from '@/lib/types';

type ServerRow = Record<string, unknown> & { id: string; task_id: string };
type Write = { op: 'create' | 'update'; body: Record<string, unknown> };

const fake = vi.hoisted(() => {
  const state = {
    records: new Map<string, ServerRow>(),
    events: [] as string[],
    writes: [] as Write[],
    failPull: false,
  };
  const taskIdIn = (filter: string): string | undefined => /task_id = "([^"]+)"/.exec(filter)?.[1];
  const tasks = {
    getList: async (_page: number, _size: number, options?: { fields?: string }) => {
      const kind = options?.fields ? 'index' : 'pull';
      state.events.push(kind);
      if (kind === 'pull' && state.failPull) throw new Error('network down');
      return [...state.records.values()].map((row) => ({ ...row }));
    },
    getFirstListItem: async (filter: string) => {
      const row = [...state.records.values()].find((r) => r.task_id === taskIdIn(filter));
      if (!row) throw Object.assign(new Error('not found'), { status: 404 });
      return { ...row };
    },
    update: async (id: string, body: Record<string, unknown>) => {
      state.events.push('update');
      state.writes.push({ op: 'update', body });
      const merged = { ...state.records.get(id)!, ...body };
      state.records.set(id, merged);
      return merged;
    },
    create: async (body: Record<string, unknown>) => {
      state.events.push('create');
      state.writes.push({ op: 'create', body });
      const row = { ...body, id: `rec_${String(body.task_id)}` } as ServerRow;
      state.records.set(row.id, row);
      return row;
    },
    delete: async (id: string) => {
      state.records.delete(id);
      return true;
    },
  };
  const users = { authRefresh: async () => ({ record: { id: 'user-1' } }) };
  return { state, pb: { collection: (name: string) => (name === 'users' ? users : tasks) } };
});

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: () => fake.pb,
  getCurrentUserId: () => 'user-1',
  isAuthenticated: () => true,
  clearPocketBase: vi.fn(),
}));

vi.mock('@/lib/sync/pb-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sync/pb-auth')>()),
  ensureValidAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/sync/notifications', () => ({
  notifySyncSuccess: vi.fn(),
  notifySyncError: vi.fn(),
}));

import { applyRemoteChange, fullSync } from '@/lib/sync/pb-sync-engine';
import { copyUnreadFields, pullRemoteChanges } from '@/lib/sync/pb-pull';
import { disableSync } from '@/lib/sync/config';
import { persistSyncConfig } from '@/components/sync/use-sync-auth-dialog';
import { updateTask } from '@/lib/tasks/crud';
import { returnSavedTask } from '@/lib/tasks/saved';

const CREATED = '2026-10-01T10:00:00.000Z';
/** The Save another device made, and the server's version of the task. */
const SAVED = '2026-10-20T10:00:00.000Z';
const OLDER = '2026-10-19T10:00:00.000Z';
const NEWER = '2026-10-21T10:00:00.000Z';
/** Past the skew ceiling: a device whose clock runs far ahead stamped it. */
const FAR_FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const AUTH = { isLoggedIn: true, userId: 'user-1', email: 'one@example.com', provider: 'google' };

function localRow(updatedAt: string, extra: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't-a', title: 'Read later', description: '', urgent: false, important: true,
    quadrant: 'not-urgent-important', completed: false, createdAt: CREATED, updatedAt,
    recurrence: 'none', tags: [], subtasks: [], dependencies: [], notificationEnabled: true,
    notificationSent: false, timeSpent: 0, timeEntries: [], ...extra,
  };
}

function serverRow(overrides: Record<string, unknown> = {}): ServerRow {
  return {
    id: 'rec_a', collectionId: 'tasks', collectionName: 'tasks', task_id: 't-a', owner: 'user-1',
    title: 'Read later', description: '', urgent: false, important: true,
    quadrant: 'not-urgent-important', due_date: '', completed: false, completed_at: '',
    recurrence: 'none', tags: [], subtasks: [], dependencies: [], notification_enabled: true,
    notification_sent: false, notify_before: null, last_notification_at: '', estimated_minutes: null,
    time_spent: 0, time_entries: [], snoozed_until: '', saved_at: SAVED, client_updated_at: SAVED,
    client_created_at: CREATED, device_id: 'other-device', ...overrides,
  };
}

/** A signed-in config. No version is what a build older than the contract left. */
function signedIn(pullCursorVersion?: number): PBSyncConfig {
  return {
    key: 'sync_config', enabled: true, userId: 'user-1', deviceId: 'device-1',
    deviceName: 'Test device', email: 'one@example.com', provider: 'google', lastSyncAt: null,
    lastClientUpdatedAt: null, ...(pullCursorVersion === undefined ? {} : { pullCursorVersion }),
    lastServerUpdatedAt: null, lastSuccessfulSyncAt: null, consecutiveFailures: 0,
    lastFailureAt: null, lastFailureReason: null, nextRetryAt: null, localTaskOwnerUserId: 'user-1',
  };
}

/** What a sign-out on a build older than Saved left behind: rows kept, version 2. */
function signedOutOnPreSavedBuild(): PBSyncConfig {
  return { ...signedIn(2), enabled: false, userId: null, email: null, provider: null };
}

async function seed(options: { config: PBSyncConfig; local?: TaskRecord[]; queued?: TaskRecord[]; server?: ServerRow[] }) {
  const db = getDb();
  await db.syncMetadata.put(options.config);
  if (options.local?.length) await db.tasks.bulkAdd(options.local);
  for (const payload of options.queued ?? []) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- queue order follows insertion
    await getSyncQueue().enqueue('update', payload.id, payload);
  }
  for (const row of options.server ?? []) fake.state.records.set(row.id, row);
}

const serverSavedAt = (): unknown => fake.state.records.get('rec_a')?.saved_at;
const localSavedAt = async (): Promise<string | undefined> => (await getDb().tasks.get('t-a'))?.savedAt;
const storedVersion = async (): Promise<number | undefined> =>
  ((await getDb().syncMetadata.get('sync_config')) as PBSyncConfig | undefined)?.pullCursorVersion;
const sentEmptySavedAt = (): boolean => fake.state.writes.some((w) => w.body.saved_at === '');

beforeEach(async () => {
  vi.clearAllMocks();
  fake.state.records.clear();
  fake.state.events.length = 0;
  fake.state.writes.length = 0;
  fake.state.failPull = false;
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('an upgrade from a build that never read saved_at', () => {
  it('a1: a queued edit newer than the Save keeps the server saved_at', async () => {
    const row = localRow(NEWER);
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });

    const result = await fullSync('auto');

    expect(result.status).toBe('success');
    expect(sentEmptySavedAt()).toBe(false);
    expect(serverSavedAt()).toBe(SAVED);
    expect(fake.state.records.get('rec_a')?.client_updated_at).toBe(NEWER);
    await expect(localSavedAt()).resolves.toBe(SAVED);
  });

  it('a2: a same-version row with a queued change keeps the server saved_at', async () => {
    const row = localRow(SAVED);
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });

    await fullSync('auto');

    expect(sentEmptySavedAt()).toBe(false);
    expect(serverSavedAt()).toBe(SAVED);
    await expect(localSavedAt()).resolves.toBe(SAVED);
  });

  it('a6: a fresh edit before the backfill keeps the server saved_at', async () => {
    await seed({ config: signedIn(), local: [localRow(SAVED)], server: [serverRow()] });
    await updateTask('t-a', { title: 'Read this weekend' });

    await fullSync('auto');

    expect(sentEmptySavedAt()).toBe(false);
    expect(serverSavedAt()).toBe(SAVED);
    expect(fake.state.records.get('rec_a')?.title).toBe('Read this weekend');
    await expect(localSavedAt()).resolves.toBe(SAVED);
  });

  it('signing in again after the upgrade keeps the server saved_at', async () => {
    await seed({ config: signedOutOnPreSavedBuild(), local: [localRow(SAVED)], server: [serverRow()] });
    await persistSyncConfig(AUTH);

    await fullSync('auto');

    expect(sentEmptySavedAt()).toBe(false);
    expect(serverSavedAt()).toBe(SAVED);
    await expect(localSavedAt()).resolves.toBe(SAVED);
  });

  it('a task completed on the old build after the Save ends completed, not also Saved', async () => {
    const row = localRow(NEWER, { completed: true, completedAt: NEWER });
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });

    await fullSync('auto');

    expect(fake.state.records.get('rec_a')).toMatchObject({ completed: true, saved_at: '' });
    await expect(localSavedAt()).resolves.toBeUndefined();
  });

  it('a3, control: a queued edit older than the Save is dropped and the pull repairs the row', async () => {
    const row = localRow(OLDER);
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });

    await fullSync('auto');

    expect(fake.state.writes).toHaveLength(0);
    expect(serverSavedAt()).toBe(SAVED);
    await expect(localSavedAt()).resolves.toBe(SAVED);
  });

  it('a4, control: a payload that carries savedAt pushes it', async () => {
    const row = localRow(NEWER, { savedAt: SAVED });
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });

    await fullSync('auto');

    expect(fake.state.writes.map((w) => w.body.saved_at)).toEqual([SAVED]);
    expect(serverSavedAt()).toBe(SAVED);
  });

  it('a5, control: a same-version row with nothing queued takes saved_at from the backfill', async () => {
    await seed({ config: signedIn(), local: [localRow(SAVED)], server: [serverRow()] });

    await fullSync('auto');

    expect(fake.state.writes).toHaveLength(0);
    await expect(localSavedAt()).resolves.toBe(SAVED);
  });
});

// Names follow the top three corpus's pullMerge cases for saved_at.
describe('copyUnreadFields', () => {
  const newerLocal = localRow(NEWER);
  const savedRemote = localRow(SAVED, { savedAt: SAVED });

  it.each([undefined, 2])('copies saved_at onto a newer row stored under contract %s', (version) => {
    expect(copyUnreadFields(newerLocal, savedRemote, version)).toEqual({ ...newerLocal, savedAt: SAVED });
  });

  it("saved_at isn't copied at contract 3: a null there is a real Return", () => {
    expect(copyUnreadFields(newerLocal, savedRemote, 3)).toBeNull();
  });

  it('a build older than Saved keeps a local savedAt', () => {
    const savedLocal = localRow(NEWER, { savedAt: NEWER });
    expect(copyUnreadFields(savedLocal, savedRemote, 2)).toBeNull();
  });

  it('copies nothing when the remote has no saved_at', () => {
    expect(copyUnreadFields(newerLocal, localRow(SAVED), 2)).toBeNull();
  });

  // saveTaskForLater refuses both, so the copy would make a row no client can hold.
  it('a completed row stays out of Saved', () => {
    const completed = localRow(NEWER, { completed: true, completedAt: NEWER });
    expect(copyUnreadFields(completed, savedRemote, 2)).toBeNull();
  });

  it('a row with a running timer stays out of Saved', () => {
    const timing = localRow(NEWER, { timeEntries: [{ id: 'e1', startedAt: NEWER }] });
    expect(copyUnreadFields(timing, savedRemote, 2)).toBeNull();
  });
});

describe('a real Return', () => {
  it('still clears saved_at on the server', async () => {
    await seed({
      config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION),
      local: [localRow(SAVED, { savedAt: SAVED })],
      server: [serverRow()],
    });
    await returnSavedTask('t-a', 'urgent-important', undefined);

    await fullSync('auto');

    expect(serverSavedAt()).toBe('');
    await expect(localSavedAt()).resolves.toBeUndefined();
  });
});

describe('push reads saved_at from the row as it is now', () => {
  it("a queued item for a row that's gone leaves saved_at off the wire", async () => {
    await seed({
      config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION),
      queued: [localRow(NEWER)],
      server: [serverRow()],
    });

    await fullSync('auto');

    expect(fake.state.writes).toHaveLength(1);
    expect(fake.state.writes[0].body).not.toHaveProperty('saved_at');
    expect(serverSavedAt()).toBe(SAVED);
  });
});

describe('pull contract: sign-in and sign-out (C4-1)', () => {
  it.each([undefined, 2, SYNC_CONFIG.PULL_CURSOR_VERSION])(
    'sign-in keeps the stored contract (%s)',
    async (version) => {
      await seed({ config: { ...signedOutOnPreSavedBuild(), pullCursorVersion: version } });

      await persistSyncConfig(AUTH);

      await expect(storedVersion()).resolves.toBe(version);
    },
  );

  it("sign-out on the current build doesn't trigger a backfill", async () => {
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION) });

    await disableSync();
    await persistSyncConfig(AUTH);

    await expect(storedVersion()).resolves.toBe(SYNC_CONFIG.PULL_CURSOR_VERSION);
  });

  it('sign-out while a backfill is owed keeps it owed', async () => {
    await seed({ config: signedIn(2), local: [localRow(SAVED)] });

    await disableSync();

    await expect(storedVersion()).resolves.toBe(2);
  });
});

describe('pull contract: order while a backfill is owed (C4-2, C4-3)', () => {
  it('backfill pulls before it pushes', async () => {
    const row = localRow(NEWER);
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });

    await fullSync('auto');

    const { events } = fake.state;
    expect(events.indexOf('pull')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('pull')).toBeLessThan(events.indexOf('update'));
  });

  it('an ordinary sync still pushes before it pulls', async () => {
    const row = localRow(NEWER, { savedAt: SAVED });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [row], queued: [row], server: [serverRow()] });

    await fullSync('auto');

    const { events } = fake.state;
    expect(events.indexOf('update')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('update')).toBeLessThan(events.indexOf('pull'));
  });

  it('a pending create survives a pull-first backfill', async () => {
    const fresh = localRow(NEWER, { id: 't-new', title: 'Never pushed' });
    await seed({ config: signedIn(), local: [fresh], server: [serverRow()] });
    await getSyncQueue().enqueue('create', fresh.id, fresh);

    await fullSync('auto');

    await expect(getDb().tasks.get('t-new')).resolves.toBeDefined();
    expect(fake.state.records.get('rec_t-new')?.title).toBe('Never pushed');
  });

  it('a pull-first backfill holds off a far-future remote with a queued edit', async () => {
    const row = localRow(NEWER, { title: 'Local edit' });
    const farFuture = serverRow({ title: 'Edit from a fast clock', client_updated_at: FAR_FUTURE, saved_at: '' });
    await seed({ config: signedIn(), local: [row], queued: [row], server: [farFuture] });

    await fullSync('auto');

    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Local edit', updatedAt: NEWER });
    expect(fake.state.records.get('rec_a')).toMatchObject({ title: 'Local edit', client_updated_at: NEWER });
  });

  // S-SPEC-01. On WEB-SAVED the server's pick is its saved_at; WEB-C4 adds the focus pair.
  it('a far-future remote with a queued edit keeps the server pick through the backfill', async () => {
    const row = localRow(NEWER, { title: 'Local edit' });
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow({ client_updated_at: FAR_FUTURE })] });

    await fullSync('auto');

    expect(sentEmptySavedAt()).toBe(false);
    expect(serverSavedAt()).toBe(SAVED);
    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Local edit', savedAt: SAVED });
  });

  // WEB-HOLDOFF (S-AND-02): a push doesn't always drain the queue (a 429, an unavailable index,
  // a transient error), so every pull holds off while a write that will push is pending.
  async function pullFarFutureOver(status: 'pending' | 'failed', options: { mergeSameVersion: boolean }) {
    const row = localRow(NEWER, { title: 'Local edit' });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [row], queued: [row], server: [serverRow({ title: 'Edit from a fast clock', client_updated_at: FAR_FUTURE })] });
    const [queued] = await getDb().syncQueue.toArray();
    await getDb().syncQueue.update(queued.id, { status });
    await pullRemoteChanges(null, options);
    return (await getDb().tasks.get('t-a'))?.title;
  }

  it.each([
    ['an ordinary pull', { mergeSameVersion: false }],
    ['a backfill', { mergeSameVersion: true }],
  ] as const)('%s with a pending write holds off a far-future remote', async (_name, options) => {
    await expect(pullFarFutureOver('pending', options)).resolves.toBe('Local edit');
  });

  // Realtime applies the same strictly-newer test to a clamped stamp, so it splits the same way.
  it.each(['update', 'create'] as const)('a realtime %s with a pending write holds off a far-future remote', async (action) => {
    const row = localRow(NEWER, { title: 'Local edit' });
    const farFuture = serverRow({ title: 'Edit from a fast clock', client_updated_at: FAR_FUTURE });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [row], queued: [row] });

    await applyRemoteChange(action, farFuture as unknown as RecordModel, 'user-1');

    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Local edit' });
  });

  it("a held-off record doesn't move the pull cursor", async () => {
    const row = localRow(NEWER, { title: 'Local edit' });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [row], queued: [row], server: [serverRow({ client_updated_at: FAR_FUTURE })] });

    const result = await pullRemoteChanges(null, { mergeSameVersion: false });

    expect(result).toMatchObject({ pulledCount: 0, maxObservedTimestamp: null });
  });

  it('a realtime update with nothing queued still takes a far-future remote', async () => {
    const farFuture = serverRow({ title: 'Edit from a fast clock', client_updated_at: FAR_FUTURE });
    await seed({ config: signedIn(SYNC_CONFIG.PULL_CURSOR_VERSION), local: [localRow(NEWER, { title: 'Local edit' })] });

    await applyRemoteChange('update', farFuture as unknown as RecordModel, 'user-1');

    await expect(getDb().tasks.get('t-a')).resolves.toMatchObject({ title: 'Edit from a fast clock' });
  });

  // A retry-exhausted write never pushes, so holding off for it would split the device for good.
  it.each([
    ['an ordinary pull', { mergeSameVersion: false }],
    ['a backfill', { mergeSameVersion: true }],
  ] as const)("%s whose queued write is retry-exhausted doesn't hold off a far-future remote", async (_name, options) => {
    await expect(pullFarFutureOver('failed', options)).resolves.toBe('Edit from a fast clock');
  });

  it('a failed backfill pull pushes nothing and stamps nothing', async () => {
    const row = localRow(NEWER);
    await seed({ config: signedIn(), local: [row], queued: [row], server: [serverRow()] });
    fake.state.failPull = true;

    const result = await fullSync('auto');

    expect(result.status).toBe('error');
    expect(fake.state.writes).toHaveLength(0);
    await expect(getSyncQueue().getPendingCount()).resolves.toBe(1);
    await expect(storedVersion()).resolves.toBeUndefined();
  });
});
