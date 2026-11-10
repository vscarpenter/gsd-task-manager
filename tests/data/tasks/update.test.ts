/**
 * updateTask against fake-indexeddb, with nothing mocked: the editor needs the
 * typed validation error to name the field, and an edit that doesn't touch the
 * title must not rewrite it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { createTask, updateTask } from '@/lib/tasks/crud';
import { TaskValidationError, taskValidationMessage } from '@/lib/tasks/crud/validation-error';
import { createMockTask, createMockTaskDraft } from '@/tests/fixtures';

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('updateTask', () => {
  it('rejects an over-long title with the typed error the editor names', async () => {
    const task = await createTask(createMockTaskDraft({ title: 'Plan the week' }));

    const error = await updateTask(task.id, { title: 'a'.repeat(81) }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TaskValidationError);
    expect(taskValidationMessage(error)).not.toBeNull();
  });

  it("leaves a stored title's link alone when the update doesn't change the title", async () => {
    // An older build, an import, or a pull can store a title with a link in it.
    const title = 'Read https://example.com/post later';
    await getDb().tasks.put(createMockTask({ id: 'with-link', title, description: '' }));

    const updated = await updateTask('with-link', { urgent: false });

    expect(updated.title).toBe(title);
    expect(updated.description).toBe('');
  });
});
