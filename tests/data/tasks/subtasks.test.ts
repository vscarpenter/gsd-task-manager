import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  toggleSubtask,
  addSubtask,
  deleteSubtask,
} from '@/lib/tasks';
import { getDb } from '@/lib/db';
import { getSyncConfig } from '@/lib/sync/config';
import { getSyncQueue } from '@/lib/sync/queue';
import type { TaskRecord, Subtask } from '@/lib/types';

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

describe('Task Subtask Operations', () => {
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
    subtasks: [
      { id: 'sub-1', title: 'Subtask 1', completed: false },
      { id: 'sub-2', title: 'Subtask 2', completed: true },
      { id: 'sub-3', title: 'Subtask 3', completed: false },
    ],
    dependencies: [],
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
      },
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  describe('toggleSubtask', () => {
    it('should toggle subtask to completed', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleSubtask('task-1', 'sub-1', true);

      expect(result.subtasks[0].completed).toBe(true);
      expect(result.subtasks[1].completed).toBe(true); // Unchanged
      expect(result.subtasks[2].completed).toBe(false); // Unchanged
      expect(mockDb.tasks.put).toHaveBeenCalled();
    });

    it('should toggle subtask to uncompleted', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleSubtask('task-1', 'sub-2', false);

      expect(result.subtasks[0].completed).toBe(false); // Unchanged
      expect(result.subtasks[1].completed).toBe(false); // Toggled
      expect(result.subtasks[2].completed).toBe(false); // Unchanged
    });

    it('should increment vector clock', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleSubtask('task-1', 'sub-1', true);

      expect(result.vectorClock).toHaveProperty('test-device');
      expect(result.vectorClock['test-device']).toBeGreaterThan(baseTask.vectorClock['test-device']);
    });

    it('should update updatedAt timestamp', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleSubtask('task-1', 'sub-1', true);

      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(baseTask.updatedAt).getTime());
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ enabled: true, deviceId: 'test-device' });

      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleSubtask('task-1', 'sub-1', true);

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

      await toggleSubtask('task-1', 'sub-1', true);

      expect(getSyncQueue().enqueue).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(toggleSubtask('nonexistent', 'sub-1', true)).rejects.toThrow('Task nonexistent not found');
    });

    it('should only modify the target subtask', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await toggleSubtask('task-1', 'sub-2', false);

      // Verify subtask IDs remain the same
      expect(result.subtasks.map(s => s.id)).toEqual(['sub-1', 'sub-2', 'sub-3']);
      // Verify only sub-2 was modified
      expect(result.subtasks[0].title).toBe('Subtask 1');
      expect(result.subtasks[1].title).toBe('Subtask 2');
      expect(result.subtasks[2].title).toBe('Subtask 3');
    });
  });

  describe('addSubtask', () => {
    it('should add new subtask with generated ID', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'New Subtask');

      expect(result.subtasks).toHaveLength(4);
      expect(result.subtasks[3]).toMatchObject({
        title: 'New Subtask',
        completed: false,
      });
      expect(result.subtasks[3].id).toBeDefined();
      expect(result.subtasks[3].id).not.toBe(''); // Should have generated ID
    });

    it('should append to existing subtasks', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'Fourth Subtask');

      // Original subtasks should still be present
      expect(result.subtasks[0].id).toBe('sub-1');
      expect(result.subtasks[1].id).toBe('sub-2');
      expect(result.subtasks[2].id).toBe('sub-3');
      // New subtask appended at end
      expect(result.subtasks[3].title).toBe('Fourth Subtask');
    });

    it('should set new subtask as uncompleted by default', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'New Subtask');

      expect(result.subtasks[3].completed).toBe(false);
    });

    it('should increment vector clock', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'New Subtask');

      expect(result.vectorClock).toHaveProperty('test-device');
      expect(result.vectorClock['test-device']).toBeGreaterThan(baseTask.vectorClock['test-device']);
    });

    it('should update updatedAt timestamp', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'New Subtask');

      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(baseTask.updatedAt).getTime());
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ enabled: true, deviceId: 'test-device' });

      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'New Subtask');

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

      await addSubtask('task-1', 'New Subtask');

      expect(getSyncQueue().enqueue).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(addSubtask('nonexistent', 'New Subtask')).rejects.toThrow('Task nonexistent not found');
    });

    it('should work with task that has no existing subtasks', async () => {
      const taskWithNoSubtasks = { ...baseTask, subtasks: [] };
      mockDb.tasks.get.mockResolvedValue(taskWithNoSubtasks);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await addSubtask('task-1', 'First Subtask');

      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].title).toBe('First Subtask');
    });
  });

  describe('deleteSubtask', () => {
    it('should remove specified subtask', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'sub-2');

      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks.map(s => s.id)).toEqual(['sub-1', 'sub-3']);
    });

    it('should keep other subtasks unchanged', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'sub-2');

      expect(result.subtasks[0]).toEqual(baseTask.subtasks[0]);
      expect(result.subtasks[1]).toEqual(baseTask.subtasks[2]);
    });

    it('should increment vector clock', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'sub-2');

      expect(result.vectorClock).toHaveProperty('test-device');
      expect(result.vectorClock['test-device']).toBeGreaterThan(baseTask.vectorClock['test-device']);
    });

    it('should update updatedAt timestamp', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'sub-2');

      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(baseTask.updatedAt).getTime());
    });

    it('should enqueue sync operation when sync is enabled', async () => {
      (getSyncConfig as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ enabled: true, deviceId: 'test-device' });

      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'sub-2');

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

      await deleteSubtask('task-1', 'sub-2');

      expect(getSyncQueue().enqueue).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockDb.tasks.get.mockResolvedValue(null);

      await expect(deleteSubtask('nonexistent', 'sub-1')).rejects.toThrow('Task nonexistent not found');
    });

    it('should handle deletion of nonexistent subtask gracefully', async () => {
      mockDb.tasks.get.mockResolvedValue(baseTask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'nonexistent-subtask-id');

      // Should still work, just no subtasks removed
      expect(result.subtasks).toHaveLength(3);
      expect(result.subtasks).toEqual(baseTask.subtasks);
    });

    it('should handle deletion of last remaining subtask', async () => {
      const taskWithOneSubtask = {
        ...baseTask,
        subtasks: [{ id: 'only-sub', title: 'Only Subtask', completed: false }],
      };
      mockDb.tasks.get.mockResolvedValue(taskWithOneSubtask);
      mockDb.tasks.put.mockResolvedValue(undefined);

      const result = await deleteSubtask('task-1', 'only-sub');

      expect(result.subtasks).toHaveLength(0);
    });
  });
});
