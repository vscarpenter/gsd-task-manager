import { describe, it, expect } from 'vitest';
import { SCHEMA_LIMITS } from '../../constants.js';
import { validateToolArgs } from '../../tools/handlers/input-schemas.js';

describe('validateToolArgs', () => {
  describe('create_task', () => {
    it('accepts a minimal valid payload', () => {
      const result = validateToolArgs('create_task', {
        title: 'Write tests',
        urgent: true,
        important: true,
      });
      expect(result).toMatchObject({
        title: 'Write tests',
        urgent: true,
        important: true,
      });
    });

    it('accepts the full set of optional fields', () => {
      const result = validateToolArgs('create_task', {
        title: 'Write tests',
        urgent: false,
        important: true,
        dueDate: '2026-05-01T00:00:00.000Z',
        tags: ['#work'],
        subtasks: [{ title: 'Part A', completed: false }],
        recurrence: 'weekly',
        dependencies: ['abc123'],
        notifyBefore: 30,
        notificationEnabled: true,
        estimatedMinutes: 45,
        dryRun: true,
      });
      expect(result).toBeTruthy();
    });

    it('rejects missing required fields', () => {
      expect(() => validateToolArgs('create_task', { title: 'x', urgent: true })).toThrow(
        /important/
      );
    });

    it('rejects invalid recurrence', () => {
      expect(() =>
        validateToolArgs('create_task', {
          title: 'x',
          urgent: true,
          important: true,
          recurrence: 'yearly',
        })
      ).toThrow(/recurrence/);
    });

    it('rejects non-ISO dueDate', () => {
      expect(() =>
        validateToolArgs('create_task', {
          title: 'x',
          urgent: true,
          important: true,
          dueDate: 'tomorrow',
        })
      ).toThrow(/dueDate/);
    });

    it('rejects estimatedMinutes out of range', () => {
      expect(() =>
        validateToolArgs('create_task', {
          title: 'x',
          urgent: true,
          important: true,
          estimatedMinutes: 99999,
        })
      ).toThrow(/estimatedMinutes/);
    });

    it('rejects oversized write payload fields', () => {
      const basePayload = {
        title: 'x',
        urgent: true,
        important: true,
      };

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          title: 'x'.repeat(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH + 1),
        })
      ).toThrow(/title/);

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          description: 'x'.repeat(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH + 1),
        })
      ).toThrow(/description/);

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          tags: Array.from({ length: SCHEMA_LIMITS.MAX_TAGS + 1 }, (_, i) => `tag-${i}`),
        })
      ).toThrow(/tags/);

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          tags: ['x'.repeat(SCHEMA_LIMITS.TAG_MAX_LENGTH + 1)],
        })
      ).toThrow(/tags/);

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          subtasks: Array.from({ length: SCHEMA_LIMITS.MAX_SUBTASKS + 1 }, () => ({
            title: 'subtask',
            completed: false,
          })),
        })
      ).toThrow(/subtasks/);

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          subtasks: [
            {
              title: 'x'.repeat(SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH + 1),
              completed: false,
            },
          ],
        })
      ).toThrow(/subtasks/);

      expect(() =>
        validateToolArgs('create_task', {
          ...basePayload,
          dependencies: Array.from(
            { length: SCHEMA_LIMITS.MAX_DEPENDENCIES + 1 },
            (_, i) => `dep-${i}`
          ),
        })
      ).toThrow(/dependencies/);
    });

    it('rejects unknown fields (strict mode)', () => {
      expect(() =>
        validateToolArgs('create_task', {
          title: 'x',
          urgent: true,
          important: true,
          garbage: 'value',
        })
      ).toThrow(/garbage/);
    });
  });

  describe('update_task', () => {
    it('accepts an empty string for dueDate to clear it', () => {
      const result = validateToolArgs('update_task', {
        id: 'abc',
        dueDate: '',
      });
      expect(result).toBeTruthy();
    });

    it('requires id', () => {
      expect(() => validateToolArgs('update_task', { title: 'x' })).toThrow(/id/);
    });

    it('rejects oversized mutable fields', () => {
      expect(() =>
        validateToolArgs('update_task', {
          id: 'abc',
          title: 'x'.repeat(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH + 1),
        })
      ).toThrow(/title/);

      expect(() =>
        validateToolArgs('update_task', {
          id: 'abc',
          tags: ['x'.repeat(SCHEMA_LIMITS.TAG_MAX_LENGTH + 1)],
        })
      ).toThrow(/tags/);

      expect(() =>
        validateToolArgs('update_task', {
          id: 'abc',
          subtasks: [
            {
              id: 'sub-1',
              title: 'x'.repeat(SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH + 1),
              completed: false,
            },
          ],
        })
      ).toThrow(/subtasks/);

      expect(() =>
        validateToolArgs('update_task', {
          id: 'abc',
          dependencies: ['x'.repeat(SCHEMA_LIMITS.ID_MAX_LENGTH + 1)],
        })
      ).toThrow(/dependencies/);
    });
  });

  describe('bulk_update_tasks', () => {
    it('accepts a complete operation', () => {
      const result = validateToolArgs('bulk_update_tasks', {
        taskIds: ['id1', 'id2'],
        operation: { type: 'complete', completed: true },
      });
      expect(result).toBeTruthy();
    });

    it('rejects operation type without required discriminant fields', () => {
      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ['id1'],
          operation: { type: 'complete' },
        })
      ).toThrow();
    });

    it('rejects more than 50 task ids', () => {
      const ids = Array.from({ length: SCHEMA_LIMITS.MAX_BULK_TASKS + 1 }, (_, i) => `id${i}`);
      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ids,
          operation: { type: 'delete' },
        })
      ).toThrow(/taskIds/);
    });

    it('rejects oversized task ids and operation tags', () => {
      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ['x'.repeat(SCHEMA_LIMITS.ID_MAX_LENGTH + 1)],
          operation: { type: 'delete' },
        })
      ).toThrow(/taskIds/);

      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ['id1'],
          operation: {
            type: 'add_tags',
            tags: Array.from({ length: SCHEMA_LIMITS.MAX_TAGS + 1 }, (_, i) => `tag-${i}`),
          },
        })
      ).toThrow(/tags/);

      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ['id1'],
          operation: {
            type: 'remove_tags',
            tags: ['x'.repeat(SCHEMA_LIMITS.TAG_MAX_LENGTH + 1)],
          },
        })
      ).toThrow(/tags/);
    });

    it('rejects caller-supplied maxTasks (policy lives server-side, not in input)', () => {
      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ['id1'],
          operation: { type: 'delete' },
          maxTasks: 9999,
        })
      ).toThrow(/maxTasks/);
    });
  });

  describe('list_tasks', () => {
    it('accepts no arguments', () => {
      expect(validateToolArgs('list_tasks', {})).toEqual({});
    });

    it('rejects invalid quadrant value', () => {
      expect(() => validateToolArgs('list_tasks', { quadrant: 'bogus' })).toThrow(/quadrant/);
    });
  });

  describe('unknown tools', () => {
    it('passes args through unchanged', () => {
      const args = { arbitrary: 'value' };
      expect(validateToolArgs('some_tool_not_registered', args)).toBe(args);
    });
  });
});
