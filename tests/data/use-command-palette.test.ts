/**
 * Tests for lib/use-command-palette.ts
 * Covers the command palette hook: open/close, search filtering, task matching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/filters', () => ({
  applyFilters: vi.fn((tasks: unknown[], filters: { searchQuery?: string }) => {
    const query = filters.searchQuery?.toLowerCase() ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tasks as any[]).filter((t) =>
      t.title.toLowerCase().includes(query)
    );
  }),
}));

vi.mock('@/lib/constants/ui', () => ({
  SEARCH_CONFIG: {
    MAX_COMMAND_PALETTE_RESULTS: 10,
  },
}));

import { useCommandPalette } from '@/lib/use-command-palette';
import type { CommandAction } from '@/lib/command-actions';
import type { TaskRecord } from '@/lib/types';

function createAction(overrides?: Partial<CommandAction>): CommandAction {
  return {
    id: 'action-1',
    label: 'Test Action',
    section: 'actions',
    keywords: ['test'],
    onExecute: vi.fn(),
    ...overrides,
  };
}

function createTask(overrides?: Partial<TaskRecord>): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'task-1',
    title: 'Buy groceries',
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    createdAt: now,
    updatedAt: now,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
    ...overrides,
  };
}

describe('useCommandPalette', () => {
  const actions = [
    createAction({ id: 'a1', label: 'New Task', keywords: ['create', 'add'] }),
    createAction({ id: 'a2', label: 'Export Data', keywords: ['download', 'backup'] }),
    createAction({
      id: 'a3',
      label: 'Conditional Action',
      keywords: ['hidden'],
      condition: () => false,
    }),
  ];
  const tasks = [
    createTask({ id: 't1', title: 'Buy groceries' }),
    createTask({ id: 't2', title: 'Fix bug in login' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with palette closed and empty search', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    expect(result.current.open).toBe(false);
    expect(result.current.search).toBe('');
    expect(result.current.matchingTasks).toHaveLength(0);
  });

  it('should show all non-conditional actions when search is empty', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    // With no search, all actions without failing conditions should appear
    expect(result.current.filteredActions).toHaveLength(2);
    expect(result.current.filteredActions.map((a) => a.id)).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('should filter actions by search query', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    act(() => {
      result.current.setSearch('export');
    });

    expect(result.current.filteredActions).toHaveLength(1);
    expect(result.current.filteredActions[0].id).toBe('a2');
  });

  it('should filter actions by keywords', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    act(() => {
      result.current.setSearch('backup');
    });

    expect(result.current.filteredActions).toHaveLength(1);
    expect(result.current.filteredActions[0].id).toBe('a2');
  });

  it('should match tasks when search has 2+ characters', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    act(() => {
      result.current.setSearch('buy');
    });

    expect(result.current.matchingTasks).toHaveLength(1);
    expect(result.current.matchingTasks[0].id).toBe('t1');
  });

  it('should not show matching tasks when search is less than 2 chars', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    act(() => {
      result.current.setSearch('b');
    });

    expect(result.current.matchingTasks).toHaveLength(0);
  });

  it('should execute action and close palette', () => {
    const onExecute = vi.fn();
    const actionsWithCallback = [
      createAction({ id: 'a1', label: 'Do Thing', onExecute }),
    ];

    const { result } = renderHook(() =>
      useCommandPalette({ actions: actionsWithCallback, tasks: [] })
    );

    // Open the palette first
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);

    // Execute the action
    act(() => {
      result.current.executeAction(result.current.filteredActions[0]);
    });

    expect(onExecute).toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it('should clear search when closing palette', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    act(() => {
      result.current.setOpen(true);
      result.current.setSearch('test');
    });

    act(() => {
      result.current.setOpen(false);
    });

    expect(result.current.search).toBe('');
  });

  it('should toggle open state with Cmd+K', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    // Simulate Cmd+K
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      );
    });

    expect(result.current.open).toBe(true);

    // Toggle closed
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      );
    });

    expect(result.current.open).toBe(false);
  });

  it('should dispatch highlightTask event on selectTask', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { result } = renderHook(() =>
      useCommandPalette({ actions, tasks })
    );

    act(() => {
      result.current.setOpen(true);
    });

    act(() => {
      result.current.selectTask('task-42');
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'highlightTask',
        detail: { taskId: 'task-42' },
      })
    );
    expect(result.current.open).toBe(false);

    dispatchSpy.mockRestore();
  });
});
