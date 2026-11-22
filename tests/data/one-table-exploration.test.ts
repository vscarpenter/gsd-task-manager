/**
 * ADR 0013 rule 1 on the real writers: breadth-first over every order of these
 * acts on one task id, until no new placement appears. A hand-written model can
 * drift from the code. This runs the code.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  archiveTaskNow,
  deleteArchivedTask,
  reinstateArchivedTask,
  restoreTask as restoreFromArchive,
} from '@/lib/archive';
import { getDb } from '@/lib/db';
import { applyRemoteChange } from '@/lib/sync/pb-sync-engine';
import { deleteTask, updateTask } from '@/lib/tasks/crud';
import { restoreTask as undoDelete } from '@/lib/tasks/crud/restore';
import { importTasks } from '@/lib/tasks/import-export';
import { deleteFromTrashForever, restoreFromTrash } from '@/lib/trash';
import type { TaskRecord } from '@/lib/types';
import { SAVED, localRow, resetFakeSync, serverRow, signedIn } from './sync/support/fake-pocketbase';

const ID = 'task-a';
const STEP_MS = 1_000;
const START = '2026-11-01T12:00:00.000Z';
const TIMEOUT_MS = 60_000;

interface World {
  path: string[];
  clock: number;
  live?: TaskRecord;
  archived?: TaskRecord;
  trashed?: TaskRecord;
  /** The record each "Undo" toast still holds. */
  undo?: TaskRecord;
  archiveUndo?: TaskRecord;
}

const backupTask = () => localRow(SAVED, { notifyBefore: 15 });
const backup = (tasks: TaskRecord[], archivedTasks: TaskRecord[], deletedTasks: TaskRecord[]) =>
  ({ tasks, archivedTasks, deletedTasks, exportedAt: SAVED, version: '2.2.0' }) as Parameters<typeof importTasks>[0];
/** A 1.0.0 backup has no archive or Trash key, so it can't say to clear either. */
const oldBackup = () =>
  ({ tasks: [backupTask()], exportedAt: SAVED, version: '1.0.0' }) as Parameters<typeof importTasks>[0];

const ACTS: Record<string, (world: World) => Promise<unknown>> = {
  edit: () => updateTask(ID, { description: 'edited' }),
  delete: async (world) => {
    const held = await getDb().tasks.get(ID);
    await deleteTask(ID);
    if (held) world.undo = held;
  },
  undoDelete: async (world) => world.undo && undoDelete(world.undo),
  restoreFromTrash: () => restoreFromTrash(ID),
  deleteForever: () => deleteFromTrashForever(ID),
  archive: () => archiveTaskNow(ID),
  restoreFromArchive: () => restoreFromArchive(ID),
  deleteArchived: async (world) => {
    const held = await getDb().archivedTasks.get(ID);
    await deleteArchivedTask(ID);
    if (held) world.archiveUndo = held;
  },
  undoDeleteArchived: async (world) => world.archiveUndo && reinstateArchivedTask(world.archiveUndo),
  remoteEdit: () =>
    applyRemoteChange('update', serverRow({ saved_at: '', client_updated_at: new Date().toISOString() }) as never, 'user-1'),
  remoteDelete: () => applyRemoteChange('delete', serverRow() as never, 'user-1'),
  mergeLive: () => importTasks(backup([backupTask()], [], []), 'merge'),
  mergeArchived: () => importTasks(backup([], [{ ...backupTask(), archivedAt: SAVED }], []), 'merge'),
  mergeTrashed: () => importTasks(backup([], [], [{ ...backupTask(), deletedAt: SAVED }]), 'merge'),
  replaceLive: () => importTasks(backup([backupTask()], [], []), 'replace'),
  replaceFromOldBackup: () => importTasks(oldBackup(), 'replace'),
  replaceArchived: () => importTasks(backup([], [{ ...backupTask(), archivedAt: SAVED }], []), 'replace'),
};

async function load(world: World): Promise<void> {
  const db = getDb();
  await Promise.all([db.tasks, db.archivedTasks, db.deletedTasks, db.syncQueue].map((table) => table.clear()));
  if (world.live) await db.tasks.put(world.live);
  if (world.archived) await db.archivedTasks.put(world.archived);
  if (world.trashed) await db.deletedTasks.put(world.trashed);
  vi.setSystemTime(world.clock + STEP_MS);
}

async function after(from: World, name: string): Promise<World> {
  const world = { ...from, path: [...from.path, name], clock: from.clock + STEP_MS };
  await load(from);
  // An act that doesn't apply here rejects, and its transaction leaves the tables as they were.
  await ACTS[name](world).catch(() => undefined);
  const db = getDb();
  [world.live, world.archived, world.trashed] = await Promise.all([
    db.tasks.get(ID), db.archivedTasks.get(ID), db.deletedTasks.get(ID),
  ]);
  return world;
}

const placement = (world: World): string =>
  [world.live, world.archived, world.trashed, world.undo, world.archiveUndo].map(Boolean).join();
const tablesHolding = (world: World): number =>
  [world.live, world.archived, world.trashed].filter(Boolean).length;

async function explore(): Promise<{ seen: Set<string>; broken: string[] }> {
  const first: World = { path: [], clock: Date.parse(START), live: localRow(SAVED, { notifyBefore: 15 }) };
  const seen = new Set([placement(first)]);
  const broken: string[] = [];
  const frontier = [first];
  for (let from = frontier.shift(); from; from = frontier.shift()) {
    for (const name of Object.keys(ACTS)) {
      const next = await after(from, name);
      if (tablesHolding(next) > 1) {
        broken.push(next.path.join(' > '));
      } else if (!seen.has(placement(next))) {
        seen.add(placement(next));
        frontier.push(next);
      }
    }
  }
  return { seen, broken };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(START));
  await resetFakeSync();
  await getDb().syncMetadata.put(signedIn(4));
});

afterEach(() => {
  vi.useRealTimers();
});

it('never leaves one id in two lifecycle tables, whatever the order', async () => {
  const { seen, broken } = await explore();

  // All four placements with each of the two toasts open or closed: the search really moved.
  expect(seen.size).toBeGreaterThanOrEqual(12);
  expect(broken).toEqual([]);
}, TIMEOUT_MS);
