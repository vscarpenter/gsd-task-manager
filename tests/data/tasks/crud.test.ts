import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  restoreTask,
  toggleCompleted,
  moveTaskToQuadrant,
  duplicateTask,
  clearTasks,
} from '@/lib/tasks';
import { getDb } from '@/lib/db';
import { getSyncConfig } from '@/lib/sync/config';
import type { TaskDraft, TaskRecord } from '@/lib/types';

// Mock dependencies
const mockRemoveDependencyReferences = vi.hoisted(() => vi.fn());
const mockEnqueue = vi.fn();
const mockScheduleDebouncedSync = vi.fn();
const mockIsRunning = vi.fn(() => false);

vi.mock('@/lib/db');
vi.mock('@/lib/tasks/dependencies', () => ({
  removeDependencyReferences: mockRemoveDependencyReferences,
  removeDependencyReferencesInTransaction: mockRemoveDependencyReferences,
}));
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => ({
    enqueue: mockEnqueue,
  })),
}));
vi.mock('@/lib/sync/config', () => ({
  getSyncConfig: vi.fn(async () => ({
    enabled: false,
    deviceId: 'test-device',
  })),
}));
vi.mock('@/lib/sync/background-sync', () => ({
  getBackgroundSyncManager: vi.fn(() => ({
    isRunning: mockIsRunning,
    scheduleDebouncedSync: mockScheduleDebouncedSync,
  })),
}));
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Task CRUD Operations', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  const baseDraft: TaskDraft = {
    title: 'Test Task',
    description: 'Test Description',
    urgent: true,
    important: true,
    dueDate: undefined,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notifyBefore: 15,
    notificationEnabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueue.mockClear();
    mockScheduleDebouncedSync.mockClear();
    mockIsRunning.mockReturnValue(false);
    mockRemoveDependencyReferences.mockClear();

    // Reset sync config to disabled state
    (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      enabled: false,
      deviceId: 'test-device',
    });

    // Create mock database
    mockDb = {
      tasks: {
        orderBy: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        add: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
      },
      syncQueue: {},
      transaction: vi.fn(async (_mode, _tables, callback) => callback()),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  describe('listTasks', () => {
    it('should return all tasks ordered by creation date (newest first)', async () => {
      const tasks: TaskRecord[] = [
        { ...baseDraft, id: '1', quadrant: 'urgent-important', completed: false, createdAt: '2025-01-15T10:00:00Z', updatedAt: '2025-01-15T10:00:00Z', notificationSent: false },
        { ...baseDraft, id: '2', quadrant: 'urgent-important', completed: false, createdAt: '2025-01-14T10:00:00Z', updatedAt: '2025-01-14T10:00:00Z', notificationSent: false },
      ];

      mockDb.tasks.toArray.mockResolvedValue(tasks);

      const result = await listTasks();

      expect(mockDb.tasks.orderBy).toHaveBeenCalledWith('createdAt');
      expect(mockDb.tasks.reverse).toHaveBeenCalled();
      expect(result).toEqual(tasks);
    });

    it('should throw error when database operation fails', async () => {
      mockDb.tasks.toArray.mockRejectedValue(new Error('DB error'));

      await expect(listTasks()).rejects.toThrow('Failed to list tasks');
    });
  });

  describe('createTask', () => {
    it('should create task with generated ID and timestamps', async () => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      const result = await createTask(baseDraft);

      expect(result).toMatchObject({
        title: baseDraft.title,
        description: baseDraft.description,
        urgent: baseDraft.urgent,
        important: baseDraft.important,
        completed: false,
        quadrant: 'urgent-important',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should set correct quadrant based on urgent/important flags', async () => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      const task1 = await createTask({ ...baseDraft, urgent: true, important: true });
      expect(task1.quadrant).toBe('urgent-important');

      const task2 = await createTask({ ...baseDraft, urgent: false, important: true });
      expect(task2.quadrant).toBe('not-urgent-important');

      const task3 = await createTask({ ...baseDraft, urgent: true, important: false });
      expect(task3.quadrant).toBe('urgent-not-important');

      const task4 = await createTask({ ...baseDraft, urgent: false, important: false });
      expect(task4.quadrant).toBe('not-urgent-not-important');
    });

    it('should throw error for invalid task data', async () => {
      const invalid = { ...baseDraft, title: '' };

      await expect(createTask(invalid)).rejects.toThrow();
    });

    it('should throw wrapped error when database add fails', async () => {
      mockDb.tasks.add.mockRejectedValue(new Error('Constraint violation'));

      await expect(createTask(baseDraft)).rejects.toThrow('Failed to create task');
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: true,
        deviceId: 'test-device',
      });
      mockDb.tasks.add.mockResolvedValue(undefined);

      const result = await createTask(baseDraft);

      expect(mockEnqueue).toHaveBeenCalledWith('create', result.id, expect.objectContaining({ title: baseDraft.title }));
    });

    it.each([
      {
        scenario: 'extracts URLs from title into description',
        title: 'Read https://example.com/article later',
        description: '',
        expectedTitle: 'Read later',
        expectedDescription: 'https://example.com/article',
      },
      {
        scenario: 'appends extracted URLs to existing description',
        title: 'Watch https://example.com/video',
        description: 'Existing notes',
        expectedTitle: 'Watch',
        expectedDescription: 'Existing notes\nhttps://example.com/video',
      },
      {
        scenario: 'falls back to placeholder title when title is URL-only',
        title: 'https://example.com',
        description: '',
        expectedTitle: 'Review link below',
        expectedDescription: 'https://example.com/',
      },
      {
        scenario: 'leaves title unchanged when no URLs are present',
        title: 'Plain task title',
        description: 'Plain description',
        expectedTitle: 'Plain task title',
        expectedDescription: 'Plain description',
      },
    ])('$scenario', async ({ title, description, expectedTitle, expectedDescription }) => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      const result = await createTask({ ...baseDraft, title, description });

      expect(result.title).toBe(expectedTitle);
      expect(result.description).toBe(expectedDescription);
    });
  });

  describe('updateTask', () => {
    it('should update task with partial changes', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await updateTask('task-1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(result.description).toBe(existing.description); // Unchanged
      expect(mockDb.tasks.put).toHaveBeenCalled();
    });

    it('should update quadrant when urgent/important change', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await updateTask('task-1', { urgent: false });

      expect(result.quadrant).toBe('not-urgent-important');
    });

    it('should throw error when task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(updateTask('nonexistent', { title: 'Test' })).rejects.toThrow('Task nonexistent not found');
    });

    it('should reset notification state when due date changes', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: true,
        lastNotificationAt: '2025-01-15T10:00:00Z',
        snoozedUntil: '2025-01-15T12:00:00Z',
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await updateTask('task-1', { dueDate: '2025-01-20T10:00:00Z' });

      expect(result.notificationSent).toBe(false);
      expect(result.lastNotificationAt).toBeUndefined();
      expect(result.snoozedUntil).toBeUndefined();
    });

    it('should throw descriptive error with field details when draft is invalid', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);

      await expect(
        updateTask('task-1', { title: '' })
      ).rejects.toThrow(/Task validation failed.*title/i);
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: true,
        deviceId: 'test-device',
      });

      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await updateTask('task-1', { title: 'Updated' });

      expect(mockEnqueue).toHaveBeenCalledWith('update', 'task-1', expect.objectContaining({ title: 'Updated' }));
    });

    it('should throw wrapped error when database put fails', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockRejectedValue(new Error('Write failed'));

      await expect(updateTask('task-1', { title: 'Updated' })).rejects.toThrow('Failed to update task');
    });

    it.each([
      {
        scenario: 'extracts a URL from an updated title into the description',
        initialDescription: 'Existing notes',
        newTitle: 'Watch https://example.com/video',
        expectedTitle: 'Watch',
        expectedDescription: 'Existing notes\nhttps://example.com/video',
      },
      {
        scenario: 'falls back to placeholder when the updated title is URL-only',
        initialDescription: '',
        newTitle: 'https://example.com',
        expectedTitle: 'Review link below',
        expectedDescription: 'https://example.com/',
      },
      {
        scenario: 'leaves the title unchanged when the updated title has no URL',
        initialDescription: 'Plain description',
        newTitle: 'Plain updated title',
        expectedTitle: 'Plain updated title',
        expectedDescription: 'Plain description',
      },
    ])('$scenario', async ({ initialDescription, newTitle, expectedTitle, expectedDescription }) => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        description: initialDescription,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await updateTask('task-1', { title: newTitle });

      expect(result.title).toBe(expectedTitle);
      expect(result.description).toBe(expectedDescription);
    });
  });

  describe('toggleCompleted', () => {
    it('should mark task as completed and set completedAt', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleCompleted('task-1', true);

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeDefined();
    });

    it('should mark task as uncompleted and clear completedAt', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: true,
        completedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleCompleted('task-1', false);

      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeUndefined();
    });

    it('should create recurring instance when completing recurring task', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        recurrence: 'daily',
        dueDate: '2025-01-15T10:00:00Z',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.add.mockResolvedValue(undefined);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await toggleCompleted('task-1', true);

      // Should add new recurring instance
      expect(mockDb.tasks.add).toHaveBeenCalled();
      const newInstance = mockDb.tasks.add.mock.calls[0][0];
      expect(newInstance.id).not.toBe('task-1');
      expect(newInstance.completed).toBe(false);
      expect(new Date(newInstance.dueDate).getTime()).toBeGreaterThan(new Date(existing.dueDate!).getTime());
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: true,
        deviceId: 'test-device',
      });

      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await toggleCompleted('task-1', true);

      expect(mockEnqueue).toHaveBeenCalledWith('update', 'task-1', expect.objectContaining({ completed: true }));
    });

    it('should throw wrapped error when database operation fails', async () => {
      mockDb.tasks.get.mockRejectedValue(new Error('DB unavailable'));

      await expect(toggleCompleted('task-1', true)).rejects.toThrow('Failed to toggle task completion');
    });
  });

  describe('deleteTask', () => {
    it('should delete task from database', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockRemoveDependencyReferences.mockResolvedValue(undefined);
      mockDb.tasks.delete.mockResolvedValue(undefined);

      await deleteTask('task-1');

      expect(mockRemoveDependencyReferences).toHaveBeenCalledWith(
        'task-1',
        expect.any(Function),
        false
      );
      expect(mockRemoveDependencyReferences.mock.invocationCallOrder[0]).toBeLessThan(
        mockDb.tasks.delete.mock.invocationCallOrder[0]
      );
      expect(mockDb.tasks.delete).toHaveBeenCalledWith('task-1');
    });

    it('should be idempotent (not throw if task does not exist)', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(deleteTask('nonexistent')).resolves.not.toThrow();
      expect(mockRemoveDependencyReferences).not.toHaveBeenCalled();
    });

    it('should enqueue sync delete when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: true,
        deviceId: 'test-device',
      });

      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockRemoveDependencyReferences.mockResolvedValue(undefined);
      mockDb.tasks.delete.mockResolvedValue(undefined);

      await deleteTask('task-1');

      expect(mockEnqueue).toHaveBeenCalledWith('delete', 'task-1', null);
    });

    it('should throw wrapped error when database operation fails', async () => {
      mockDb.tasks.get.mockRejectedValue(new Error('DB connection lost'));

      await expect(deleteTask('task-1')).rejects.toThrow('Failed to delete task');
    });
  });

  describe('restoreTask', () => {
    const deletedRecord: TaskRecord = {
      ...baseDraft,
      id: 'task-restore-1',
      quadrant: 'urgent-important',
      completed: true,
      completedAt: '2025-01-15T10:00:00Z',
      createdAt: '2025-01-10T08:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
      notificationSent: false,
    };

    it('should re-insert the exact record, preserving id, completed state, and createdAt', async () => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      await restoreTask(deletedRecord);

      expect(mockDb.tasks.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-restore-1',
          completed: true,
          completedAt: '2025-01-15T10:00:00Z',
          createdAt: '2025-01-10T08:00:00Z',
        })
      );
    });

    it('should not regenerate the id (faithful restore, not a new task)', async () => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      await restoreTask(deletedRecord);

      const added = mockDb.tasks.add.mock.calls[0][0];
      expect(added.id).toBe('task-restore-1');
    });

    it('should enqueue a create sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: true,
        deviceId: 'test-device',
      });
      mockDb.tasks.add.mockResolvedValue(undefined);

      await restoreTask(deletedRecord);

      expect(mockEnqueue).toHaveBeenCalledWith('create', 'task-restore-1', deletedRecord);
    });

    it('should not enqueue sync when sync is disabled', async () => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      await restoreTask(deletedRecord);

      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('should throw a wrapped error when the database add fails', async () => {
      mockDb.tasks.add.mockRejectedValue(new Error('Constraint violation'));

      await expect(restoreTask(deletedRecord)).rejects.toThrow('Failed to restore task');
    });
  });

  describe('moveTaskToQuadrant', () => {
    it('should update task urgent/important flags and quadrant', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await moveTaskToQuadrant('task-1', 'not-urgent-important');

      expect(result.urgent).toBe(false);
      expect(result.important).toBe(true);
      expect(result.quadrant).toBe('not-urgent-important');
    });

    it('should throw when task does not exist', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(moveTaskToQuadrant('nonexistent', 'urgent-important')).rejects.toThrow('Failed to move task to quadrant');
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: true,
        deviceId: 'test-device',
      });

      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await moveTaskToQuadrant('task-1', 'not-urgent-not-important');

      expect(mockEnqueue).toHaveBeenCalledWith('update', 'task-1', expect.objectContaining({ quadrant: 'not-urgent-not-important' }));
    });
  });

  describe('duplicateTask', () => {
    it('should create copy with new ID and updated title', async () => {
      const original: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        title: 'Original Task',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(original);
      mockDb.tasks.add.mockResolvedValue(undefined);

      const result = await duplicateTask('task-1');

      expect(result.id).not.toBe(original.id);
      expect(result.title).toBe('Original Task (Copy)');
      expect(result.completed).toBe(false);
    });

    it('should not enqueue sync when sync is disabled', async () => {
      const original: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        title: 'Original Task',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(original);
      mockDb.tasks.add.mockResolvedValue(undefined);
      (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        enabled: false,
        deviceId: 'test-device',
      });

      await duplicateTask('task-1');

      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('should throw error when original task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(duplicateTask('nonexistent')).rejects.toThrow('Task with id nonexistent not found');
    });
  });

  describe('clearTasks', () => {
    it('should clear all tasks from database', async () => {
      mockDb.tasks.count.mockResolvedValue(5);
      mockDb.tasks.clear.mockResolvedValue(undefined);

      await clearTasks();

      expect(mockDb.tasks.clear).toHaveBeenCalled();
    });

    it('should throw wrapped error when database operation fails', async () => {
      mockDb.tasks.count.mockRejectedValue(new Error('DB error'));

      await expect(clearTasks()).rejects.toThrow('Failed to clear tasks');
    });
  });
});
