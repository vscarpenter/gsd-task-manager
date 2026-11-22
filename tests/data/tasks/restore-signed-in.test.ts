/**
 * WEB-UNDO-SIGNED-IN (tasks/formal-findings-backlog.md): Undo after a delete must
 * bring the task back and queue its create while sync is on. Runs the real
 * delete, restore, and queue against fake-indexeddb, with nothing mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import { deleteTask } from '@/lib/tasks/crud';
import { restoreTask } from '@/lib/tasks/crud/restore';
import { NEWER, SAVED, localRow, signedIn, signedOut } from '../sync/support/fake-pocketbase';

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncMetadata.put(signedIn());
  await db.tasks.add(localRow(SAVED));
  await deleteTask('task-a');
});

describe('undo after a delete while signed in', () => {
  it('restores the task without an error', async () => {
    await expect(restoreTask(localRow(SAVED))).resolves.toBeUndefined();

    const db = getDb();
    expect(await db.tasks.get('task-a')).toMatchObject({ id: 'task-a', title: 'Read later' });
    expect(await db.deletedTasks.get('task-a')).toBeUndefined();
  });

  it('queues the create after the delete', async () => {
    await restoreTask(localRow(SAVED));

    const queued = (await getSyncQueue().getPending()).map((row) => `${row.operation}:${row.taskId}`);
    expect(queued).toEqual(['delete:task-a', 'create:task-a']);
  });
});

describe('what undo puts back', () => {
  it('is the deleted record, with its id, completion, and timestamps', async () => {
    const deleted = localRow(SAVED, { completed: true, completedAt: SAVED });

    await restoreTask(deleted);

    expect(await getDb().tasks.get('task-a')).toEqual(deleted);
  });

  it('is the newer copy when the task changed and was archived meanwhile', async () => {
    const db = getDb();
    await db.deletedTasks.clear();
    await db.archivedTasks.put({ ...localRow(NEWER, { title: 'Edited elsewhere' }), archivedAt: NEWER });

    await restoreTask(localRow(SAVED));

    expect(await db.tasks.get('task-a')).toEqual(localRow(NEWER, { title: 'Edited elsewhere' }));
    expect(await db.archivedTasks.get('task-a')).toBeUndefined();
  });

  it('queues nothing while signed out', async () => {
    const db = getDb();
    await db.syncQueue.clear();
    await db.syncMetadata.put(signedOut());

    await restoreTask(localRow(SAVED));

    expect(await db.syncQueue.count()).toBe(0);
  });

  it('is reported, and changes nothing, when the write fails', async () => {
    const db = getDb();
    const put = vi.spyOn(db.tasks, 'put').mockRejectedValueOnce(new Error('Quota exceeded'));

    await expect(restoreTask(localRow(SAVED))).rejects.toThrow('Failed to restore task');

    put.mockRestore();
    expect(await db.deletedTasks.get('task-a')).toBeDefined();
  });
});
