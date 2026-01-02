import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportTasks,
  importTasks,
  importFromJson,
  exportToJson,
} from '@/lib/tasks';
import { getDb } from '@/lib/db';
import type { TaskRecord, ImportPayload } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/logger');

describe('Task Import/Export Operations', () => {
  let mockDb: any;

  const sampleTask1: TaskRecord = {
    id: 'task-1',
    title: 'Task 1',
    description: 'Description 1',
    urgent: true,
    important: true,
    quadrant: 'urgent-important',
    completed: false,
    dueDate: undefined,
    recurrence: 'none',
    tags: ['work'],
    subtasks: [
      { id: 'sub-1', title: 'Subtask 1', completed: false },
    ],
    dependencies: [],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    vectorClock: { 'device-1': 1 },
    notifyBefore: 15,
    notificationEnabled: true,
    notificationSent: false,
  };

  const sampleTask2: TaskRecord = {
    id: 'task-2',
    title: 'Task 2',
    description: 'Description 2',
    urgent: false,
    important: true,
    quadrant: 'not-urgent-important',
    completed: true,
    completedAt: '2025-01-16T10:00:00Z',
    dueDate: undefined,
    recurrence: 'none',
    tags: ['personal'],
    subtasks: [],
    dependencies: [],
    createdAt: '2025-01-14T10:00:00Z',
    updatedAt: '2025-01-16T10:00:00Z',
    vectorClock: { 'device-1': 2 },
    notifyBefore: 15,
    notificationEnabled: true,
    notificationSent: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database with transaction support
    mockDb = {
      tasks: {
        toArray: vi.fn(),
        clear: vi.fn(),
        bulkAdd: vi.fn(),
      },
      transaction: vi.fn((mode, table, callback) => callback()),
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  describe('exportTasks', () => {
    it('should export all tasks with correct structure', async () => {
      mockDb.tasks.toArray.mockResolvedValue([sampleTask1, sampleTask2]);

      const result = await exportTasks();

      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('version');
      expect(result.tasks).toHaveLength(2);
      expect(result.version).toBe('1.0.0');
    });

    it('should validate tasks with schema', async () => {
      mockDb.tasks.toArray.mockResolvedValue([sampleTask1]);

      const result = await exportTasks();

      // If schema validation fails, this would throw
      expect(result.tasks[0]).toMatchObject({
        id: 'task-1',
        title: 'Task 1',
        quadrant: 'urgent-important',
      });
    });

    it('should include exportedAt timestamp', async () => {
      mockDb.tasks.toArray.mockResolvedValue([]);

      const result = await exportTasks();

      expect(result.exportedAt).toBeDefined();
      expect(typeof result.exportedAt).toBe('string');
      expect(new Date(result.exportedAt).getTime()).toBeGreaterThan(0);
    });

    it('should handle empty task list', async () => {
      mockDb.tasks.toArray.mockResolvedValue([]);

      const result = await exportTasks();

      expect(result.tasks).toEqual([]);
      expect(result.version).toBe('1.0.0');
    });

    it('should throw error on invalid task data', async () => {
      // Task with extra fields that violate schema
      const taskWithExtra = { ...sampleTask1, extraField: 'should-cause-error' } as any;
      mockDb.tasks.toArray.mockResolvedValue([taskWithExtra]);

      // Schema validation should throw on unknown fields
      await expect(exportTasks()).rejects.toThrow();
    });
  });

  describe('importTasks', () => {
    const validPayload: ImportPayload = {
      tasks: [sampleTask1, sampleTask2],
      exportedAt: '2025-01-17T10:00:00Z',
      version: '1.0.0',
    };

    it('should clear existing tasks in replace mode', async () => {
      mockDb.tasks.clear.mockResolvedValue(undefined);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(validPayload, 'replace');

      expect(mockDb.tasks.clear).toHaveBeenCalled();
      expect(mockDb.tasks.bulkAdd).toHaveBeenCalledWith(validPayload.tasks);
    });

    it('should not clear existing tasks in merge mode', async () => {
      mockDb.tasks.toArray.mockResolvedValue([]);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(validPayload, 'merge');

      expect(mockDb.tasks.clear).not.toHaveBeenCalled();
      expect(mockDb.tasks.bulkAdd).toHaveBeenCalled();
    });

    it('should regenerate conflicting IDs in merge mode', async () => {
      // Existing task has same ID as imported task
      const existingTask = { ...sampleTask1, title: 'Existing Task' };
      mockDb.tasks.toArray.mockResolvedValue([existingTask]);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(validPayload, 'merge');

      expect(mockDb.tasks.bulkAdd).toHaveBeenCalled();
      const importedTasks = mockDb.tasks.bulkAdd.mock.calls[0][0];

      // First task (task-1) should have regenerated ID
      expect(importedTasks[0].id).not.toBe('task-1');
      expect(importedTasks[0].title).toBe('Task 1'); // Content preserved

      // Second task (task-2) has no conflict, ID unchanged
      expect(importedTasks[1].id).toBe('task-2');
    });

    it('should regenerate subtask IDs when parent task ID is regenerated', async () => {
      const existingTask = { ...sampleTask1 };
      mockDb.tasks.toArray.mockResolvedValue([existingTask]);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(validPayload, 'merge');

      const importedTasks = mockDb.tasks.bulkAdd.mock.calls[0][0];
      const regeneratedTask = importedTasks[0];

      // Task ID should be regenerated
      expect(regeneratedTask.id).not.toBe('task-1');
      // Subtask ID should also be regenerated
      expect(regeneratedTask.subtasks[0].id).not.toBe('sub-1');
      // Subtask content preserved
      expect(regeneratedTask.subtasks[0].title).toBe('Subtask 1');
    });

    it('should remap dependencies and parentTaskId when IDs are regenerated', async () => {
      const existingTask = { ...sampleTask1, id: 'task-2', title: 'Existing Task' };
      const parentTask = { ...sampleTask1, id: 'task-2', title: 'Parent Task', dependencies: [] };
      const childTask = {
        ...sampleTask1,
        id: 'task-3',
        title: 'Child Task',
        dependencies: ['task-2'],
        parentTaskId: 'task-2',
      };
      const dependentTask = {
        ...sampleTask1,
        id: 'task-4',
        title: 'Dependent Task',
        dependencies: ['task-2'],
      };

      const payload: ImportPayload = {
        tasks: [parentTask, childTask, dependentTask],
        exportedAt: '2025-01-17T10:00:00Z',
        version: '1.0.0',
      };

      mockDb.tasks.toArray.mockResolvedValue([existingTask]);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(payload, 'merge');

      const importedTasks = mockDb.tasks.bulkAdd.mock.calls[0][0];
      const importedParent = importedTasks.find((task: TaskRecord) => task.title === 'Parent Task');
      const importedChild = importedTasks.find((task: TaskRecord) => task.title === 'Child Task');
      const importedDependent = importedTasks.find((task: TaskRecord) => task.title === 'Dependent Task');

      expect(importedParent).toBeDefined();
      expect(importedChild).toBeDefined();
      expect(importedDependent).toBeDefined();

      const parentId = importedParent!.id;

      expect(parentId).not.toBe('task-2');
      expect(importedChild!.parentTaskId).toBe(parentId);
      expect(importedChild!.dependencies).toContain(parentId);
      expect(importedChild!.dependencies).not.toContain('task-2');
      expect(importedDependent!.dependencies).toContain(parentId);
    });

    it('should validate payload with schema', async () => {
      const invalidPayload = {
        tasks: [{ id: '1', title: 'Invalid' }], // Missing required fields
        exportedAt: '2025-01-17T10:00:00Z',
        version: '1.0.0',
      } as any;

      await expect(importTasks(invalidPayload, 'replace')).rejects.toThrow();
    });

    it('should default to replace mode', async () => {
      mockDb.tasks.clear.mockResolvedValue(undefined);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(validPayload);

      expect(mockDb.tasks.clear).toHaveBeenCalled();
    });

    it('should use database transaction', async () => {
      mockDb.tasks.clear.mockResolvedValue(undefined);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importTasks(validPayload, 'replace');

      expect(mockDb.transaction).toHaveBeenCalledWith(
        'rw',
        mockDb.tasks,
        expect.any(Function)
      );
    });
  });

  describe('importFromJson', () => {
    const validJson = JSON.stringify({
      tasks: [sampleTask1],
      exportedAt: '2025-01-17T10:00:00Z',
      version: '1.0.0',
    });

    it('should parse JSON and import tasks', async () => {
      mockDb.tasks.clear.mockResolvedValue(undefined);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importFromJson(validJson, 'replace');

      expect(mockDb.tasks.clear).toHaveBeenCalled();
      expect(mockDb.tasks.bulkAdd).toHaveBeenCalled();
    });

    it('should throw clear error on invalid JSON', async () => {
      const invalidJson = '{ invalid json }';

      await expect(importFromJson(invalidJson, 'replace')).rejects.toThrow(
        'Invalid JSON format'
      );
    });

    it('should re-throw validation errors from schema', async () => {
      const invalidPayload = JSON.stringify({
        tasks: [{ id: '1' }], // Missing required fields
        exportedAt: '2025-01-17T10:00:00Z',
        version: '1.0.0',
      });

      await expect(importFromJson(invalidPayload, 'replace')).rejects.toThrow();
    });

    it('should work with merge mode', async () => {
      mockDb.tasks.toArray.mockResolvedValue([]);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importFromJson(validJson, 'merge');

      expect(mockDb.tasks.clear).not.toHaveBeenCalled();
      expect(mockDb.tasks.bulkAdd).toHaveBeenCalled();
    });

    it('should default to replace mode', async () => {
      mockDb.tasks.clear.mockResolvedValue(undefined);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);

      await importFromJson(validJson);

      expect(mockDb.tasks.clear).toHaveBeenCalled();
    });
  });

  describe('exportToJson', () => {
    it('should export as formatted JSON string', async () => {
      mockDb.tasks.toArray.mockResolvedValue([sampleTask1]);

      const result = await exportToJson();

      expect(typeof result).toBe('string');
      expect(result).toContain('"tasks"');
      expect(result).toContain('"exportedAt"');
      expect(result).toContain('"version"');
    });

    it('should be parseable', async () => {
      mockDb.tasks.toArray.mockResolvedValue([sampleTask1, sampleTask2]);

      const result = await exportToJson();
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('tasks');
      expect(parsed.tasks).toHaveLength(2);
      expect(parsed.version).toBe('1.0.0');
    });

    it('should format with indentation', async () => {
      mockDb.tasks.toArray.mockResolvedValue([]);

      const result = await exportToJson();

      // Pretty printed JSON should have newlines and indentation
      expect(result).toContain('\n');
      expect(result).toContain('  '); // 2-space indent
    });

    it('should include all task data', async () => {
      mockDb.tasks.toArray.mockResolvedValue([sampleTask1]);

      const result = await exportToJson();
      const parsed = JSON.parse(result);

      expect(parsed.tasks[0]).toMatchObject({
        id: 'task-1',
        title: 'Task 1',
        urgent: true,
        important: true,
        tags: ['work'],
        subtasks: [{ id: 'sub-1', title: 'Subtask 1', completed: false }],
      });
    });
  });

  describe('Round-trip export/import', () => {
    it('should preserve data through export and import cycle', async () => {
      // Export
      mockDb.tasks.toArray.mockResolvedValue([sampleTask1, sampleTask2]);
      const exported = await exportToJson();

      // Import
      mockDb.tasks.clear.mockResolvedValue(undefined);
      mockDb.tasks.bulkAdd.mockResolvedValue(undefined);
      await importFromJson(exported, 'replace');

      const importedTasks = mockDb.tasks.bulkAdd.mock.calls[0][0];

      expect(importedTasks).toHaveLength(2);
      expect(importedTasks[0]).toMatchObject({
        id: sampleTask1.id,
        title: sampleTask1.title,
        tags: sampleTask1.tags,
      });
      expect(importedTasks[1]).toMatchObject({
        id: sampleTask2.id,
        title: sampleTask2.title,
        completed: sampleTask2.completed,
      });
    });
  });
});
