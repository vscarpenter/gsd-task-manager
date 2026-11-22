import { describe, expect, it } from 'vitest';
import { bulkUpdateTasksArgsSchema, createTaskArgsSchema, updateTaskArgsSchema } from '../../tools/handlers/input-schemas.js';

const DUE = '2026-12-01T09:00:00.000Z';
const bulk = (operation: object) => ({ taskIds: ['task-aaaa'], operation });

describe('nested tool arguments', () => {
  // A stripped `due_date` left `dueDate` absent, which clears the date on up to 50 tasks.
  it('rejects a misspelled due date instead of clearing the dates', () => {
    const result = bulkUpdateTasksArgsSchema.safeParse(bulk({ type: 'set_due_date', due_date: DUE }));

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('due_date');
  });

  it.each([
    { type: 'complete', completed: true },
    { type: 'move_quadrant', urgent: true, important: false },
    { type: 'add_tags', tags: ['work'] },
    { type: 'remove_tags', tags: ['work'] },
    { type: 'set_due_date', dueDate: DUE },
    { type: 'delete' },
  ])('rejects an unknown key on a $type operation, and accepts it without one', (operation) => {
    expect(bulkUpdateTasksArgsSchema.safeParse(bulk(operation)).success).toBe(true);
    expect(bulkUpdateTasksArgsSchema.safeParse(bulk({ ...operation, extra: 1 })).success).toBe(false);
  });

  it('rejects an unknown key on a new subtask', () => {
    const subtasks = [{ title: 'One', completed: false, done: true }];

    expect(createTaskArgsSchema.safeParse({ title: 'T', urgent: true, important: true, subtasks }).success).toBe(false);
  });

  it('rejects an unknown key on an updated subtask', () => {
    const subtasks = [{ id: 'sub-aaaa', title: 'One', completed: false, done: true }];

    expect(updateTaskArgsSchema.safeParse({ id: 'task-aaaa', subtasks }).success).toBe(false);
  });
});
