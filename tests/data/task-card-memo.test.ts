/**
 * Tests for task-card-memo.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import { areTaskCardPropsEqual, type TaskCardProps } from '@/lib/task-card-memo';
import type { TaskRecord } from '@/lib/types';

// Helper to create a minimal task for testing
function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    urgent: false,
    important: false,
    completed: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    tags: [],
    subtasks: [],
    dependencies: [],
    recurrence: 'none',
    ...overrides,
  };
}

// Helper to create minimal props for testing
function createProps(overrides: Partial<TaskCardProps> = {}): TaskCardProps {
  return {
    task: createTask(),
    allTasks: [],
    onEdit: () => {},
    onDelete: async () => {},
    onToggleComplete: async () => {},
    ...overrides,
  };
}

describe('areTaskCardPropsEqual', () => {
  it('returns true when props are identical', () => {
    const props = createProps();
    expect(areTaskCardPropsEqual(props, props)).toBe(true);
  });

  it('returns false when task title changes', () => {
    const prev = createProps({ task: createTask({ title: 'Old Title' }) });
    const next = createProps({ task: createTask({ title: 'New Title' }) });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when task completed status changes', () => {
    const prev = createProps({ task: createTask({ completed: false }) });
    const next = createProps({ task: createTask({ completed: true }) });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when tags change', () => {
    const prev = createProps({ task: createTask({ tags: ['work'] }) });
    const next = createProps({ task: createTask({ tags: ['personal'] }) });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when tag count changes', () => {
    const prev = createProps({ task: createTask({ tags: ['work'] }) });
    const next = createProps({ task: createTask({ tags: ['work', 'urgent'] }) });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when subtasks change', () => {
    const prev = createProps({
      task: createTask({
        subtasks: [{ id: 'st1', title: 'Step 1', completed: false }],
      }),
    });
    const next = createProps({
      task: createTask({
        subtasks: [{ id: 'st1', title: 'Step 1', completed: true }],
      }),
    });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when dependencies change', () => {
    const prev = createProps({ task: createTask({ dependencies: ['dep-1'] }) });
    const next = createProps({ task: createTask({ dependencies: ['dep-2'] }) });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when selection mode changes', () => {
    const prev = createProps({ selectionMode: false });
    const next = createProps({ selectionMode: true });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when isSelected changes', () => {
    const prev = createProps({ isSelected: false });
    const next = createProps({ isSelected: true });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns false when allTasks length changes', () => {
    const prev = createProps({ allTasks: [] });
    const next = createProps({ allTasks: [createTask()] });
    expect(areTaskCardPropsEqual(prev, next)).toBe(false);
  });

  it('returns true when tags are in same order', () => {
    const tags = ['a', 'b', 'c'];
    const prev = createProps({ task: createTask({ tags }) });
    const next = createProps({ task: createTask({ tags: [...tags] }) });
    expect(areTaskCardPropsEqual(prev, next)).toBe(true);
  });
});
