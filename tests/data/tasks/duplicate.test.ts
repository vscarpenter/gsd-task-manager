/**
 * Duplicating a task. A copy must stay visible on the board and reach the JSON
 * backup. The duplicate builder wrote
 * `archivedAt: undefined`, IndexedDB keeps undefined-valued keys, and the strict
 * export schemas rejected the row for a key that JSON would have dropped anyway.
 * Runs the real create, duplicate, delete, and export against fake-indexeddb.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_LIMITS } from '@/lib/constants/schema';
import { getDb } from '@/lib/db';
import { storedTaskRecordSchema } from '@/lib/schema';
import { createTask, deleteTask, duplicateTask } from '@/lib/tasks/crud';
import { exportToJsonWithReport } from '@/lib/tasks/import-export';
import { toTrashedRecord } from '@/lib/trash';
import { createMockTask, createMockTaskDraft } from '@/tests/fixtures';

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
});

async function exportedCounts() {
  const { json, skippedCount } = await exportToJsonWithReport();
  const payload = JSON.parse(json);
  return { tasks: payload.tasks.length, trash: payload.deletedTasks.length, skippedCount };
}

describe('backups of duplicated tasks', () => {
  it('include a duplicate and its original', async () => {
    const original = await createTask(createMockTaskDraft({ title: 'Plan the week' }));
    await duplicateTask(original.id);

    await expect(exportedCounts()).resolves.toEqual({ tasks: 2, trash: 0, skippedCount: 0 });
  });

  it('include a duplicate moved to Trash', async () => {
    const original = await createTask(createMockTaskDraft({ title: 'Plan the week' }));
    const copy = await duplicateTask(original.id);
    await deleteTask(copy.id);

    await expect(exportedCounts()).resolves.toEqual({ tasks: 1, trash: 1, skippedCount: 0 });
  });

  it('include rows an earlier build stored with an undefined archivedAt key', async () => {
    const db = getDb();
    await db.tasks.put({ ...createMockTask({ id: 'live-copy' }), archivedAt: undefined });
    await db.deletedTasks.put({ ...toTrashedRecord(createMockTask({ id: 'trashed-copy' })), archivedAt: undefined });

    await expect(exportedCounts()).resolves.toEqual({ tasks: 1, trash: 1, skippedCount: 0 });
  });
});

describe('duplicating a long title', () => {
  it('keeps the copy within the title limit, so the board shows it', async () => {
    const original = await createTask(createMockTaskDraft({ title: 'a'.repeat(76) }));

    const copy = await duplicateTask(original.id);

    expect(copy.title.length).toBeLessThanOrEqual(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH);
    expect(copy.title.endsWith(' (Copy)')).toBe(true);
    // useTasks hides any stored row that fails this schema.
    expect(storedTaskRecordSchema.safeParse(await getDb().tasks.get(copy.id)).success).toBe(true);
  });
});
