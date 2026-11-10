/**
 * WEB-UNDO-SIGNED-IN (tasks/formal-findings-backlog.md): Undo after a delete must
 * bring the task back and queue its create while sync is on. Runs the real
 * delete, restore, and queue against fake-indexeddb, with nothing mocked.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';
import { deleteTask } from '@/lib/tasks/crud';
import { restoreTask } from '@/lib/tasks/crud/restore';
import { SAVED, localRow, signedIn } from '../sync/support/fake-pocketbase';

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncMetadata.put(signedIn());
  await db.tasks.add(localRow(SAVED));
  await deleteTask('t-a');
});

describe('undo after a delete while signed in', () => {
  it('restores the task without an error', async () => {
    await expect(restoreTask(localRow(SAVED))).resolves.toBeUndefined();

    const db = getDb();
    expect(await db.tasks.get('t-a')).toMatchObject({ id: 't-a', title: 'Read later' });
    expect(await db.deletedTasks.get('t-a')).toBeUndefined();
  });

  it('queues the create after the delete', async () => {
    await restoreTask(localRow(SAVED));

    const queued = (await getSyncQueue().getPending()).map((row) => `${row.operation}:${row.taskId}`);
    expect(queued).toEqual(['delete:t-a', 'create:t-a']);
  });
});
