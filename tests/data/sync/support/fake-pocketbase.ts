/**
 * A PocketBase stand-in for sync tests that run the real fullSync, push, pull,
 * mapper, and queue against fake-indexeddb. An update merges the keys it
 * receives, as PocketBase does, so a key left off the wire keeps its value.
 *
 * Point the client at it from the test file, since vi.mock must live there:
 *   vi.mock('@/lib/sync/pocketbase-client', async () => {
 *     const { fake } = await import('./support/fake-pocketbase');
 *     return { getPocketBase: () => fake.pb, getCurrentUserId: () => 'user-1', ... };
 *   });
 */

import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import type { PBSyncConfig } from '@/lib/sync/types';
import type { TaskRecord } from '@/lib/types';

export type ServerRow = Record<string, unknown> & { id: string; task_id: string };
type Write = { op: 'create' | 'update'; body: Record<string, unknown> };

const state = {
  records: new Map<string, ServerRow>(),
  /** 'pull', 'index', 'listing', 'update', 'create', and 'delete', in the order they happened. */
  events: [] as string[],
  writes: [] as Write[],
  failPull: false,
  /** Fails a whole-account listing that isn't the pull or the index (resurrect on sight). */
  failListing: false,
  /** Answers updates with a 429, leaving the queued write pending. */
  failUpdate: false,
  /** Who auth-refresh says the session belongs to; null answers it with a 401. */
  authRefreshUserId: 'user-1' as string | null,
};

/** The pull sorts by client_updated_at and the index asks for fields; anything else is a listing. */
function listingKind(options?: { fields?: string; sort?: string }): string {
  if (options?.fields) return 'index';
  return options?.sort?.startsWith('client_updated_at') ? 'pull' : 'listing';
}

const taskIdIn = (filter: string): string | undefined => /task_id = "([^"]+)"/.exec(filter)?.[1];

const tasks = {
  getList: async (_page: number, _size: number, options?: { fields?: string; sort?: string }) => {
    const kind = listingKind(options);
    state.events.push(kind);
    if (kind === 'pull' && state.failPull) throw new Error('network down');
    if (kind === 'listing' && state.failListing) throw new Error('network down');
    return [...state.records.values()].map((row) => ({ ...row }));
  },
  getFirstListItem: async (filter: string) => {
    const row = [...state.records.values()].find((r) => r.task_id === taskIdIn(filter));
    if (!row) throw Object.assign(new Error('not found'), { status: 404 });
    return { ...row };
  },
  update: async (id: string, body: Record<string, unknown>) => {
    if (state.failUpdate) throw Object.assign(new Error('Too many requests'), { status: 429 });
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
    state.events.push('delete');
    state.records.delete(id);
    return true;
  },
};

const users = {
  authRefresh: async () => {
    if (state.authRefreshUserId === null) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    return { record: { id: state.authRefreshUserId } };
  },
};

/** Each name answers with its own collection, so a test can spy on that collection's calls. */
function collection(name: 'users'): typeof users;
function collection(name: string): typeof tasks;
function collection(name: string): typeof users | typeof tasks {
  return name === 'users' ? users : tasks;
}

export const fake = { state, pb: { collection } };

export async function resetFakeSync(): Promise<void> {
  state.records.clear();
  state.events.length = 0;
  state.writes.length = 0;
  state.failPull = false;
  state.failListing = false;
  state.failUpdate = false;
  state.authRefreshUserId = 'user-1';
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

export const CREATED = '2026-10-01T10:00:00.000Z';
/** The Save another device made, and the server's version of the task. */
export const SAVED = '2026-10-20T10:00:00.000Z';
export const OLDER = '2026-10-19T10:00:00.000Z';
export const NEWER = '2026-10-21T10:00:00.000Z';
/** Past the skew ceiling: a device whose clock runs far ahead stamped it. */
export const FAR_FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
export const AUTH = { isLoggedIn: true, userId: 'user-1', email: 'one@example.com', provider: 'google' };

export function localRow(updatedAt: string, extra: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't-a', title: 'Read later', description: '', urgent: false, important: true,
    quadrant: 'not-urgent-important', completed: false, createdAt: CREATED, updatedAt,
    recurrence: 'none', tags: [], subtasks: [], dependencies: [], notificationEnabled: true,
    notificationSent: false, timeSpent: 0, timeEntries: [], ...extra,
  };
}

export function serverRow(overrides: Record<string, unknown> = {}): ServerRow {
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
export function signedIn(pullCursorVersion?: number): PBSyncConfig {
  return {
    key: 'sync_config', enabled: true, userId: 'user-1', deviceId: 'device-1',
    deviceName: 'Test device', email: 'one@example.com', provider: 'google', lastSyncAt: null,
    lastClientUpdatedAt: null, ...(pullCursorVersion === undefined ? {} : { pullCursorVersion }),
    lastServerUpdatedAt: null, lastSuccessfulSyncAt: null, consecutiveFailures: 0,
    lastFailureAt: null, lastFailureReason: null, nextRetryAt: null, localTaskOwnerUserId: 'user-1',
  };
}

/** What a sign-out leaves behind: rows and contract kept, session gone. */
export function signedOut(pullCursorVersion?: number): PBSyncConfig {
  return { ...signedIn(pullCursorVersion), enabled: false, userId: null, email: null, provider: null };
}

export async function seed(options: { config: PBSyncConfig; local?: TaskRecord[]; queued?: TaskRecord[]; server?: ServerRow[] }) {
  const db = getDb();
  await db.syncMetadata.put(options.config);
  if (options.local?.length) await db.tasks.bulkAdd(options.local);
  for (const payload of options.queued ?? []) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- queue order follows insertion
    await getSyncQueue().enqueue('update', payload.id, payload);
  }
  for (const row of options.server ?? []) state.records.set(row.id, row);
}

export const serverField = (field: string): unknown => state.records.get('rec_a')?.[field];
export const localTask = async (): Promise<TaskRecord | undefined> => getDb().tasks.get('t-a');
export const storedVersion = async (): Promise<number | undefined> =>
  ((await getDb().syncMetadata.get('sync_config')) as PBSyncConfig | undefined)?.pullCursorVersion;
/** True when any push sent `field` as `value`, such as saved_at as "". */
export const sentValue = (field: string, value: unknown): boolean =>
  state.writes.some((w) => w.body[field] === value);
