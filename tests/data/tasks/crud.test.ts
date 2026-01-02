import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
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
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  describe('listTasks', () => {
    it('should return all tasks ordered by creation date (newest first)', async () => {
      const tasks: TaskRecord[] = [
        { ...baseDraft, id: '1', quadrant: 'urgent-important', completed: false, createdAt: '2025-01-15T10:00:00Z', updatedAt: '2025-01-15T10:00:00Z', vectorClock: {}, notificationSent: false },
        { ...baseDraft, id: '2', quadrant: 'urgent-important', completed: false, createdAt: '2025-01-14T10:00:00Z', updatedAt: '2025-01-14T10:00:00Z', vectorClock: {}, notificationSent: false },
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

    it('should initialize vector clock', async () => {
      mockDb.tasks.add.mockResolvedValue(undefined);

      const result = await createTask(baseDraft);

      expect(result.vectorClock).toBeDefined();
      expect(result.vectorClock).toHaveProperty('test-device');
    });

    it('should throw error for invalid task data', async () => {
      const invalid = { ...baseDraft, title: '' };

      await expect(createTask(invalid)).rejects.toThrow();
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
        vectorClock: {},
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
        vectorClock: {},
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
        vectorClock: {},
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
        vectorClock: {},
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
        vectorClock: {},
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
        vectorClock: {},
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
        vectorClock: {},
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockRemoveDependencyReferences.mockResolvedValue(undefined);
      mockDb.tasks.delete.mockResolvedValue(undefined);

      await deleteTask('task-1');

      expect(mockRemoveDependencyReferences).toHaveBeenCalledWith('task-1');
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
        vectorClock: {},
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await moveTaskToQuadrant('task-1', 'not-urgent-important');

      expect(result.urgent).toBe(false);
      expect(result.important).toBe(true);
      expect(result.quadrant).toBe('not-urgent-important');
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
        vectorClock: {},
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(original);
      mockDb.tasks.add.mockResolvedValue(undefined);

      const result = await duplicateTask('task-1');

      expect(result.id).not.toBe(original.id);
      expect(result.title).toBe('Original Task (Copy)');
      expect(result.completed).toBe(false);
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
  });
});
