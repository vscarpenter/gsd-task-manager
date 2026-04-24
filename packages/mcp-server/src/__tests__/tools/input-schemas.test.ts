import { describe, it, expect } from 'vitest';
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
      const ids = Array.from({ length: 51 }, (_, i) => `id${i}`);
      expect(() =>
        validateToolArgs('bulk_update_tasks', {
          taskIds: ids,
          operation: { type: 'delete' },
        })
      ).toThrow(/taskIds/);
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
