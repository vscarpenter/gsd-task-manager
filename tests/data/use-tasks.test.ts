import { describe, it, expect, vi } from 'vitest';
import { keepValidTaskRecords } from '@/lib/use-tasks';
import type { TaskRecord } from '@/lib/types';

// Mock logger so quarantine warnings don't produce side effects during tests.
const mockWarn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function buildTask(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    id: 'task-1',
    title: 'Valid Task',
    description: '',
    urgent: true,
    important: false,
    quadrant: 'urgent-not-important',
    completed: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: true,
    notificationSent: false,
    ...overrides,
  };
}

describe('keepValidTaskRecords', () => {
  it('passes valid records through unchanged', () => {
    const tasks = [buildTask({ id: 'task-a' }), buildTask({ id: 'task-b' })];
    expect(keepValidTaskRecords(tasks)).toEqual(tasks);
  });

  it('excludes a record with an invalid quadrant', () => {
    const corrupt = buildTask({ id: 'task-bad', quadrant: 'not-a-quadrant' as TaskRecord['quadrant'] });
    const valid = buildTask({ id: 'task-good' });

    const result = keepValidTaskRecords([corrupt, valid]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task-good');
  });

  it('excludes a record missing a required field', () => {
    const corrupt = { ...buildTask({ id: 'task-bad' }), title: undefined } as unknown as TaskRecord;
    const valid = buildTask({ id: 'task-good' });

    const result = keepValidTaskRecords([corrupt, valid]);

    expect(result.map((t) => t.id)).toEqual(['task-good']);
  });

  it('logs a warning when a record is quarantined', () => {
    mockWarn.mockClear();
    const corrupt = buildTask({ id: 'task-bad', quadrant: 'nope' as TaskRecord['quadrant'] });

    keepValidTaskRecords([corrupt]);

    expect(mockWarn).toHaveBeenCalled();
  });

  it('keeps a record carrying a harmless legacy field (does not over-quarantine)', () => {
    const legacy = { ...buildTask({ id: 'task-legacy' }), vectorClock: { device: 3 } } as unknown as TaskRecord;

    const result = keepValidTaskRecords([legacy]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task-legacy');
  });
});
