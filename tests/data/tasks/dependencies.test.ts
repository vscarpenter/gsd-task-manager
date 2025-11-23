import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addDependency,
  removeDependency,
  removeDependencyReferences,
} from '@/lib/tasks';
import { getDb } from '@/lib/db';
import { getSyncConfig } from '@/lib/sync/config';
import { getSyncQueue } from '@/lib/sync/queue';
import type { TaskRecord } from '@/lib/types';

// Mock dependencies
const mockEnqueue = vi.fn();
vi.mock('@/lib/db');
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

describe('Task Dependency Operations', () => {
  let mockDb: any;
  let mockQueue: any;

  const baseTask: TaskRecord = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    urgent: true,
    important: true,
    quadrant: 'urgent-important',
    completed: false,
    dueDate: undefined,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: ['task-2', 'task-3'],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    vectorClock: { 'test-device': 1 },
    notifyBefore: 15,
    notificationEnabled: true,
    notificationSent: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueue.mockClear();

    // Create mock database
    mockDb = {
      tasks: {
        get: vi.fn(),
        put: vi.fn(),
        toArray: vi.fn(),
      },
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  describe('addDependency', () => {
    it('should add new dependency to task', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addDependency('task-1', 'task-4');

      expect(result.dependencies).toEqual(['task-2', 'task-3', 'task-4']);
      expect(mockDb.tasks.put).toHaveBeenCalled();
    });

    it('should be idempotent when dependency already exists', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addDependency('task-1', 'task-2');

      // Should return existing task without modifications
      expect(result).toBe(baseTask);
      expect(mockDb.tasks.put).not.toHaveBeenCalled();
    });

    it('should increment vector clock for new dependency', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addDependency('task-1', 'task-4');

      expect(result.vectorClock).toHaveProperty('test-device');
      expect(result.vectorClock['test-device']).toBeGreaterThan(baseTask.vectorClock['test-device']);
    });

    it('should update updatedAt timestamp', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addDependency('task-1', 'task-4');

      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(baseTask.updatedAt).getTime());
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ enabled: true, deviceId: 'test-device' });

      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addDependency('task-1', 'task-4');

      expect(getSyncQueue().enqueue).toHaveBeenCalledWith(
        'update',
        'task-1',
        result,
        result.vectorClock
      );
    });

    it('should not enqueue sync when sync is disabled', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await addDependency('task-1', 'task-4');

      expect(getSyncQueue().enqueue).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(addDependency('nonexistent', 'task-2')).rejects.toThrow('Task nonexistent not found');
    });

    it('should work with task that has no existing dependencies', async () => {
      const taskWithNoDeps = { ...baseTask, dependencies: [] };
      mockDb.tasks.get.mockResolvedValue(taskWithNoDeps);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addDependency('task-1', 'task-2');

      expect(result.dependencies).toEqual(['task-2']);
    });
  });

  describe('removeDependency', () => {
    it('should remove specified dependency', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-2');

      expect(result.dependencies).toEqual(['task-3']);
      expect(mockDb.tasks.put).toHaveBeenCalled();
    });

    it('should keep other dependencies unchanged', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-2');

      expect(result.dependencies).toContain('task-3');
      expect(result.dependencies).not.toContain('task-2');
    });

    it('should increment vector clock', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-2');

      expect(result.vectorClock).toHaveProperty('test-device');
      expect(result.vectorClock['test-device']).toBeGreaterThan(baseTask.vectorClock['test-device']);
    });

    it('should update updatedAt timestamp', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-2');

      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(baseTask.updatedAt).getTime());
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ enabled: true, deviceId: 'test-device' });

      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-2');

      expect(getSyncQueue().enqueue).toHaveBeenCalledWith(
        'update',
        'task-1',
        result,
        result.vectorClock
      );
    });

    it('should not enqueue sync when sync is disabled', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await removeDependency('task-1', 'task-2');

      expect(getSyncQueue().enqueue).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(removeDependency('nonexistent', 'task-2')).rejects.toThrow('Task nonexistent not found');
    });

    it('should handle removal of nonexistent dependency gracefully', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-99');

      // Should still work, original dependencies unchanged
      expect(result.dependencies).toEqual(['task-2', 'task-3']);
      expect(mockDb.tasks.put).toHaveBeenCalled();
    });

    it('should handle removal of last remaining dependency', async () => {
      const taskWithOneDep = { ...baseTask, dependencies: ['task-2'] };
      mockDb.tasks.get.mockResolvedValue(taskWithOneDep);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await removeDependency('task-1', 'task-2');

      expect(result.dependencies).toEqual([]);
    });
  });

  describe('removeDependencyReferences', () => {
    it('should find and update all tasks that depend on the target task', async () => {
      const task1 = { ...baseTask, id: 'task-1', dependencies: ['task-target', 'task-other'] };
      const task2 = { ...baseTask, id: 'task-2', dependencies: ['task-target'] };
      const task3 = { ...baseTask, id: 'task-3', dependencies: ['task-other'] }; // Doesn't depend on target
      const taskTarget = { ...baseTask, id: 'task-target', dependencies: [] };

      mockDb.tasks.toArray.mockResolvedValue([task1, task2, task3, taskTarget]);
      mockDb.tasks.get
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await removeDependencyReferences('task-target');

      // Should have updated task1 and task2 (removed task-target)
      expect(mockDb.tasks.put).toHaveBeenCalledTimes(2);
    });

    it('should handle case with no dependent tasks', async () => {
      const task1 = { ...baseTask, id: 'task-1', dependencies: ['task-other'] };
      const task2 = { ...baseTask, id: 'task-2', dependencies: [] };
      const taskTarget = { ...baseTask, id: 'task-target', dependencies: [] };

      mockDb.tasks.toArray.mockResolvedValue([task1, task2, taskTarget]);

      await removeDependencyReferences('task-target');

      // Should not update any tasks
      expect(mockDb.tasks.put).not.toHaveBeenCalled();
    });

    it('should handle multiple dependent tasks', async () => {
      const task1 = { ...baseTask, id: 'task-1', dependencies: ['task-target'] };
      const task2 = { ...baseTask, id: 'task-2', dependencies: ['task-target', 'task-other'] };
      const task3 = { ...baseTask, id: 'task-3', dependencies: ['task-target'] };
      const taskTarget = { ...baseTask, id: 'task-target', dependencies: [] };

      mockDb.tasks.toArray.mockResolvedValue([task1, task2, task3, taskTarget]);
      mockDb.tasks.get
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2)
        .mockResolvedValueOnce(task3);
      mockDb.tasks.put.mockResolvedValue(undefined);

      await removeDependencyReferences('task-target');

      // Should have updated all 3 dependent tasks
      expect(mockDb.tasks.put).toHaveBeenCalledTimes(3);
    });

    it('should handle task with undefined dependencies array', async () => {
      const task1 = { ...baseTask, id: 'task-1', dependencies: undefined } as any;
      const taskTarget = { ...baseTask, id: 'task-target', dependencies: [] };

      mockDb.tasks.toArray.mockResolvedValue([task1, taskTarget]);

      await removeDependencyReferences('task-target');

      // Should not throw error, just skip tasks with undefined dependencies
      expect(mockDb.tasks.put).not.toHaveBeenCalled();
    });

    it('should return void', async () => {
      mockDb.tasks.toArray.mockResolvedValue([]);

      const result = await removeDependencyReferences('task-target');

      expect(result).toBeUndefined();
    });
  });
});
