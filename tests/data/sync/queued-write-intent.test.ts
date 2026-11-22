/**
 * A queued row can outlive the act that queued it. Replays of
 * WEB-STALE-DELETE-RESTORE and WEB-RETRIED-EDIT-RECREATES, through the real
 * writers, queue, push, pull, and reconcile. Only PocketBase is faked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sync/pocketbase-client', async () => {
  const { fake } = await import('./support/fake-pocketbase');
  return {
    getPocketBase: () => fake.pb,
    getCurrentUserId: () => 'user-1',
    isAuthenticated: () => true,
    clearPocketBase: () => {},
    forgetRefusedToken: () => {},
  };
});
vi.mock('@/lib/sync/pb-auth', () => ({ ensureValidAuth: vi.fn(async () => true) }));
vi.mock('@/lib/sync/notifications', () => ({ notifySyncSuccess: vi.fn(), notifySyncError: vi.fn() }));

import { archiveTaskNow, restoreTask as restoreFromArchive } from '@/lib/archive';
import { getDb } from '@/lib/db';
import { fullSync } from '@/lib/sync/pb-sync-engine';
import type { claimQueuedWrite, sendTaskDelete } from '@/lib/sync/queued-write';
import { deleteTask, updateTask } from '@/lib/tasks/crud';
import { restoreTask as undoDelete } from '@/lib/tasks/crud/restore';
import { deleteFromTrashForever, restoreFromTrash } from '@/lib/trash';
import { SAVED, fake, localRow, resetFakeSync, seed, serverRow, signedIn } from './support/fake-pocketbase';

const START = '2026-11-01T12:00:00.000Z';
const STEP_MS = 1_000;
const task = () => localRow(SAVED, { notifyBefore: 15 });

/** Queue rows sort by millisecond, so each act gets its own. */
async function inOrder(...acts: Array<() => Promise<unknown>>): Promise<void> {
  for (const act of acts) {
    await act();
    vi.setSystemTime(Date.now() + STEP_MS);
  }
}

function failNextWrite(method: 'PATCH' | 'DELETE'): void {
  const send = fake.pb.send.bind(fake.pb);
  let failed = false;
  vi.spyOn(fake.pb, 'send').mockImplementation(async (path, options) => {
    if (!failed && options?.method === method) {
      failed = true;
      throw Object.assign(new Error('Something went wrong.'), { status: 503 });
    }
    return send(path, options);
  });
}

/** Lands `act` after the push's server read, before the write it decides on. */
function duringNextLookup(act: () => Promise<unknown>): void {
  const tasks = fake.pb.collection('tasks');
  const lookup = tasks.getFirstListItem;
  vi.spyOn(tasks, 'getFirstListItem').mockImplementationOnce(async (filter) => {
    const found = await lookup(filter);
    await act();
    return found;
  });
}

async function placement() {
  const db = getDb();
  return {
    live: Boolean(await db.tasks.get('task-a')),
    archived: Boolean(await db.archivedTasks.get('task-a')),
    trashed: Boolean(await db.deletedTasks.get('task-a')),
    onServer: fake.state.records.has('rec_a') || fake.state.records.has('rec_task-a'),
  };
}

const LIVE_EVERYWHERE = { live: true, archived: false, trashed: false, onServer: true };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(START));
  await resetFakeSync();
  await seed({
    config: signedIn(4),
    local: [task()],
    server: [serverRow({ saved_at: '', notify_before: 15 })],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a queued delete', () => {
  it.each([
    ['Trash', () => restoreFromTrash('task-a')],
    ['Undo', () => undoDelete(task())],
  ])('does not lose a task restored from %s when the first delete push fails', async (_from, restore) => {
    await inOrder(() => deleteTask('task-a'), restore);
    failNextWrite('DELETE');

    await inOrder(() => fullSync('user'), () => fullSync('user'));

    expect(await placement()).toEqual(LIVE_EVERYWHERE);
  });

  it('is not sent when the restore lands after the server read', async () => {
    await inOrder(() => deleteTask('task-a'));
    duringNextLookup(() => restoreFromTrash('task-a'));

    await fullSync('user');

    expect(fake.state.events).not.toContain('delete');
  });

  it('is not sent for a task back from the archive', async () => {
    await inOrder(() => archiveTaskNow('task-a'), () => restoreFromArchive('task-a'));

    await inOrder(() => fullSync('user'));

    expect(fake.state.events).not.toContain('delete');
  });

  it('still removes a task that stayed deleted', async () => {
    await inOrder(() => deleteTask('task-a'));

    await fullSync('user');

    expect(await placement()).toEqual({ live: false, archived: false, trashed: true, onServer: false });
  });
});

describe('a queued edit', () => {
  it.each([
    ['moved to Trash', () => deleteTask('task-a')],
    ['moved to the archive', () => archiveTaskNow('task-a')],
    ['deleted forever', async () => {
      await deleteTask('task-a');
      await deleteFromTrashForever('task-a');
    }],
  ])('does not re-create a task %s when the first edit push fails', async (_to, remove) => {
    await inOrder(() => updateTask('task-a', { title: 'Edited here' }), remove);
    failNextWrite('PATCH');

    await inOrder(() => fullSync('user'), () => fullSync('user'));

    expect((await placement()).onServer).toBe(false);
  });

  it('is not sent when the delete lands after the server read', async () => {
    await inOrder(() => updateTask('task-a', { title: 'Edited here' }));
    duringNextLookup(() => deleteTask('task-a'));

    await fullSync('user');

    expect(fake.state.writes).toEqual([]);
  });

  it('still reaches the server while the task is live', async () => {
    await inOrder(() => updateTask('task-a', { title: 'Edited here' }));

    await fullSync('user');

    expect(fake.state.records.get('rec_a')?.title).toBe('Edited here');
  });
});

// Never called. `bun run typecheck:tests` fails here if a send stops needing the matching claim.
export async function claimTypeProof(claim: typeof claimQueuedWrite, send: typeof sendTaskDelete): Promise<void> {
  // @ts-expect-error a claim can't be built by hand
  await send({ kind: 'delete' }, 'rec', 'version');
  const upsert = await claim('upsert', 'row', 'user');
  // @ts-expect-error an upsert claim can't authorize a delete
  if (upsert) await send(upsert, 'rec', 'version');
}
