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
  /** 'pull', 'index', 'update', and 'create', in the order they happened. */
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

export const fake = { state, pb: { collection: (name: string) => (name === 'users' ? users : tasks) } };

export async function resetFakeSync(): Promise<void> {
  state.records.clear();
  state.events.length = 0;
  state.writes.length = 0;
  state.failPull = false;
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
