import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearSelection,
  toggleSelectionMode,
  bulkDelete,
  bulkComplete,
  bulkUncomplete,
  bulkMoveToQuadrant,
  bulkAddTags,
} from '@/lib/bulk-operations';
import * as tasks from '@/lib/tasks';
import type { TaskRecord, TaskDraft } from '@/lib/types';
import { ErrorActions, ErrorMessages } from '@/lib/error-logger';

// Mock the tasks module
vi.mock('@/lib/tasks', () => ({
  deleteTask: vi.fn(),
  toggleCompleted: vi.fn(),
  moveTaskToQuadrant: vi.fn(),
  updateTask: vi.fn(),
}));

describe('Bulk Operations', () => {
  // Sample task data
  const createTask = (id: string, completed = false, tags: string[] = []): TaskRecord => ({
    id,
    title: `Task ${id}`,
    description: '',
    urgent: false,
    important: false,
    completed,
    createdAt: Date.now(),
    tags,
    subtasks: [],
    dependencies: [],
  });

  const toDraft = (task: TaskRecord): TaskDraft => ({
    title: task.title,
    description: task.description,
    urgent: task.urgent,
    important: task.important,
    dueDate: task.dueDate,
    recurrence: task.recurrence,
    tags: task.tags,
    subtasks: task.subtasks,
    dependencies: task.dependencies,
    notifyBefore: task.notifyBefore,
    notificationEnabled: task.notificationEnabled,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clearSelection', () => {
    it('should clear selected task IDs and exit selection mode', () => {
      const setSelectedTaskIds = vi.fn();
      const setSelectionMode = vi.fn();

      clearSelection(setSelectedTaskIds, setSelectionMode);

      expect(setSelectedTaskIds).toHaveBeenCalledWith(new Set());
      expect(setSelectionMode).toHaveBeenCalledWith(false);
    });
  });

  describe('toggleSelectionMode', () => {
    it('should exit selection mode and clear selections when currently enabled', () => {
      const clearSelectionFn = vi.fn();
      const setSelectionMode = vi.fn();

      toggleSelectionMode(true, clearSelectionFn, setSelectionMode);

      expect(clearSelectionFn).toHaveBeenCalledOnce();
      expect(setSelectionMode).not.toHaveBeenCalled();
    });

    it('should enter selection mode when currently disabled', () => {
      const clearSelectionFn = vi.fn();
      const setSelectionMode = vi.fn();

      toggleSelectionMode(false, clearSelectionFn, setSelectionMode);

      expect(clearSelectionFn).not.toHaveBeenCalled();
      expect(setSelectionMode).toHaveBeenCalledWith(true);
    });
  });

  describe('bulkDelete', () => {
    it('should delete all selected tasks and call onSuccess', async () => {
      const task1 = createTask('1');
      const task2 = createTask('2');
      const task3 = createTask('3');
      const allTasks = [task1, task2, task3];
      const selectedTaskIds = new Set(['1', '2']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.deleteTask).mockResolvedValue();

      await bulkDelete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(tasks.deleteTask).toHaveBeenCalledTimes(2);
      expect(tasks.deleteTask).toHaveBeenCalledWith('1');
      expect(tasks.deleteTask).toHaveBeenCalledWith('2');
      expect(onSuccess).toHaveBeenCalledWith('Deleted 2 tasks');
      expect(onError).not.toHaveBeenCalled();
    });

    it('should use singular form for single task', async () => {
      const task1 = createTask('1');
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.deleteTask).mockResolvedValue();

      await bulkDelete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith('Deleted 1 task');
    });

    it('should do nothing if no tasks are selected', async () => {
      const allTasks = [createTask('1')];
      const selectedTaskIds = new Set<string>();
      const onSuccess = vi.fn();
      const onError = vi.fn();

      await bulkDelete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(tasks.deleteTask).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const task1 = createTask('1');
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const error = new Error('Database error');

      vi.mocked(tasks.deleteTask).mockRejectedValue(error);

      await bulkDelete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error, {
        action: ErrorActions.DELETE_TASK,
        userMessage: ErrorMessages.TASK_DELETE_FAILED,
        timestamp: expect.any(String),
      });
    });
  });

  describe('bulkComplete', () => {
    it('should complete all selected incomplete tasks', async () => {
      const task1 = createTask('1', false);
      const task2 = createTask('2', false);
      const task3 = createTask('3', true); // Already completed
      const allTasks = [task1, task2, task3];
      const selectedTaskIds = new Set(['1', '2', '3']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.toggleCompleted).mockResolvedValue();

      await bulkComplete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(tasks.toggleCompleted).toHaveBeenCalledTimes(2);
      expect(tasks.toggleCompleted).toHaveBeenCalledWith('1', true);
      expect(tasks.toggleCompleted).toHaveBeenCalledWith('2', true);
      expect(tasks.toggleCompleted).not.toHaveBeenCalledWith('3', true);
      expect(onSuccess).toHaveBeenCalledWith('Completed 2 tasks');
    });

    it('should use singular form for single task', async () => {
      const task1 = createTask('1', false);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.toggleCompleted).mockResolvedValue();

      await bulkComplete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith('Completed 1 task');
    });

    it('should handle completion errors', async () => {
      const task1 = createTask('1', false);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const error = new Error('Update failed');

      vi.mocked(tasks.toggleCompleted).mockRejectedValue(error);

      await bulkComplete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error, {
        action: ErrorActions.TOGGLE_TASK,
        userMessage: ErrorMessages.TASK_UPDATE_FAILED,
        timestamp: expect.any(String),
      });
    });
  });

  describe('bulkUncomplete', () => {
    it('should uncomplete all selected completed tasks', async () => {
      const task1 = createTask('1', true);
      const task2 = createTask('2', true);
      const task3 = createTask('3', false); // Already incomplete
      const allTasks = [task1, task2, task3];
      const selectedTaskIds = new Set(['1', '2', '3']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.toggleCompleted).mockResolvedValue();

      await bulkUncomplete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(tasks.toggleCompleted).toHaveBeenCalledTimes(2);
      expect(tasks.toggleCompleted).toHaveBeenCalledWith('1', false);
      expect(tasks.toggleCompleted).toHaveBeenCalledWith('2', false);
      expect(tasks.toggleCompleted).not.toHaveBeenCalledWith('3', false);
      expect(onSuccess).toHaveBeenCalledWith('Marked 2 tasks as incomplete');
    });

    it('should use singular form for single task', async () => {
      const task1 = createTask('1', true);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.toggleCompleted).mockResolvedValue();

      await bulkUncomplete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith('Marked 1 task as incomplete');
    });

    it('should handle uncomplete errors', async () => {
      const task1 = createTask('1', true);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const error = new Error('Update failed');

      vi.mocked(tasks.toggleCompleted).mockRejectedValue(error);

      await bulkUncomplete(selectedTaskIds, allTasks, onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error, {
        action: ErrorActions.TOGGLE_TASK,
        userMessage: ErrorMessages.TASK_UPDATE_FAILED,
        timestamp: expect.any(String),
      });
    });
  });

  describe('bulkMoveToQuadrant', () => {
    it('should move all selected tasks to specified quadrant', async () => {
      const task1 = createTask('1');
      const task2 = createTask('2');
      const allTasks = [task1, task2];
      const selectedTaskIds = new Set(['1', '2']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.moveTaskToQuadrant).mockResolvedValue();

      await bulkMoveToQuadrant(selectedTaskIds, allTasks, 'urgent-important', onSuccess, onError);

      expect(tasks.moveTaskToQuadrant).toHaveBeenCalledTimes(2);
      expect(tasks.moveTaskToQuadrant).toHaveBeenCalledWith('1', 'urgent-important');
      expect(tasks.moveTaskToQuadrant).toHaveBeenCalledWith('2', 'urgent-important');
      expect(onSuccess).toHaveBeenCalledWith('Moved 2 tasks to Do First');
    });

    it('should use singular form for single task', async () => {
      const task1 = createTask('1');
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.moveTaskToQuadrant).mockResolvedValue();

      await bulkMoveToQuadrant(selectedTaskIds, allTasks, 'not-urgent-important', onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith('Moved 1 task to Schedule');
    });

    it('should handle move errors', async () => {
      const task1 = createTask('1');
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const error = new Error('Move failed');

      vi.mocked(tasks.moveTaskToQuadrant).mockRejectedValue(error);

      await bulkMoveToQuadrant(selectedTaskIds, allTasks, 'urgent-important', onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error, {
        action: ErrorActions.MOVE_TASK,
        userMessage: ErrorMessages.TASK_MOVE_FAILED,
        timestamp: expect.any(String),
      });
    });

    it('should do nothing if no tasks are selected', async () => {
      const allTasks = [createTask('1')];
      const selectedTaskIds = new Set<string>();
      const onSuccess = vi.fn();
      const onError = vi.fn();

      await bulkMoveToQuadrant(selectedTaskIds, allTasks, 'urgent-important', onSuccess, onError);

      expect(tasks.moveTaskToQuadrant).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('bulkAddTags', () => {
    it('should add tags to all selected tasks', async () => {
      const task1 = createTask('1', false, ['existing']);
      const task2 = createTask('2', false, []);
      const allTasks = [task1, task2];
      const selectedTaskIds = new Set(['1', '2']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.updateTask).mockResolvedValue();

      await bulkAddTags(['new', 'tag'], selectedTaskIds, allTasks, toDraft, onSuccess, onError);

      expect(tasks.updateTask).toHaveBeenCalledTimes(2);
      expect(tasks.updateTask).toHaveBeenCalledWith('1', expect.objectContaining({
        tags: expect.arrayContaining(['existing', 'new', 'tag']),
      }));
      expect(tasks.updateTask).toHaveBeenCalledWith('2', expect.objectContaining({
        tags: expect.arrayContaining(['new', 'tag']),
      }));
      expect(onSuccess).toHaveBeenCalledWith('Added tags to 2 tasks');
    });

    it('should deduplicate tags', async () => {
      const task1 = createTask('1', false, ['existing', 'tag']);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.updateTask).mockResolvedValue();

      await bulkAddTags(['tag', 'new'], selectedTaskIds, allTasks, toDraft, onSuccess, onError);

      expect(tasks.updateTask).toHaveBeenCalledWith('1', expect.objectContaining({
        tags: expect.arrayContaining(['existing', 'tag', 'new']),
      }));

      // Verify no duplicate tags
      const updateCall = vi.mocked(tasks.updateTask).mock.calls[0];
      const updatedTags = (updateCall[1] as TaskDraft).tags;
      expect(updatedTags?.length).toBe(3); // existing, tag, new
      expect(new Set(updatedTags).size).toBe(3); // All unique
    });

    it('should use singular form for single task', async () => {
      const task1 = createTask('1', false, []);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      vi.mocked(tasks.updateTask).mockResolvedValue();

      await bulkAddTags(['tag'], selectedTaskIds, allTasks, toDraft, onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith('Added tags to 1 task');
    });

    it('should do nothing if no tasks are selected', async () => {
      const allTasks = [createTask('1')];
      const selectedTaskIds = new Set<string>();
      const onSuccess = vi.fn();
      const onError = vi.fn();

      await bulkAddTags(['tag'], selectedTaskIds, allTasks, toDraft, onSuccess, onError);

      expect(tasks.updateTask).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should do nothing if no tags to add', async () => {
      const task1 = createTask('1');
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      await bulkAddTags([], selectedTaskIds, allTasks, toDraft, onSuccess, onError);

      expect(tasks.updateTask).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      const task1 = createTask('1', false, []);
      const allTasks = [task1];
      const selectedTaskIds = new Set(['1']);
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const error = new Error('Update failed');

      vi.mocked(tasks.updateTask).mockRejectedValue(error);

      await bulkAddTags(['tag'], selectedTaskIds, allTasks, toDraft, onSuccess, onError);

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error, {
        action: ErrorActions.UPDATE_TASK,
        userMessage: ErrorMessages.TASK_UPDATE_FAILED,
        timestamp: expect.any(String),
      });
    });
  });
});
