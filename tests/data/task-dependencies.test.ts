/**
 * Tests for lib/tasks/dependencies.ts - Task dependency CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import {
  addDependency,
  removeDependency,
  removeDependencyReferences,
} from '@/lib/tasks/dependencies';
import { createTask, clearTasks } from '@/lib/tasks';
import { createMockTaskDraft } from '../fixtures';

// Mock sync modules
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => ({
    enqueue: vi.fn(),
  })),
}));

vi.mock('@/lib/sync/config', () => ({
  getSyncConfig: vi.fn(async () => ({
    enabled: false,
    deviceId: 'test-device',
  })),
}));

vi.mock('@/lib/sync/vector-clock', () => ({
  incrementVectorClock: vi.fn((clock) => ({
    ...clock,
    'test-device': (clock['test-device'] || 0) + 1,
  })),
}));

describe('Task Dependency CRUD Operations', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete();
    await db.open();
    await clearTasks();
  });

  afterEach(async () => {
    await clearTasks();
    vi.clearAllMocks();
  });

  describe('addDependency', () => {
    it('should add a dependency to a task', async () => {
      // Create two tasks
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      // Add taskB as a dependency of taskA
      const updated = await addDependency(taskA.id, taskB.id);

      expect(updated.dependencies).toContain(taskB.id);
      expect(updated.dependencies).toHaveLength(1);
      expect(updated.updatedAt).not.toBe(taskA.updatedAt);
    });

    it('should add multiple dependencies to a task', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));

      // Add taskB as dependency
      let updated = await addDependency(taskA.id, taskB.id);
      expect(updated.dependencies).toHaveLength(1);

      // Add taskC as dependency
      updated = await addDependency(taskA.id, taskC.id);
      expect(updated.dependencies).toHaveLength(2);
      expect(updated.dependencies).toContain(taskB.id);
      expect(updated.dependencies).toContain(taskC.id);
    });

    it('should not add duplicate dependencies', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      // Add taskB as dependency twice
      await addDependency(taskA.id, taskB.id);
      const updated = await addDependency(taskA.id, taskB.id);

      expect(updated.dependencies).toHaveLength(1);
      expect(updated.dependencies).toContain(taskB.id);
    });

    it('should throw error for non-existent task', async () => {
      await expect(addDependency('non-existent', 'some-id')).rejects.toThrow(
        'Task non-existent not found'
      );
    });

    it('should update vector clock when adding dependency', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      const updated = await addDependency(taskA.id, taskB.id);

      expect(updated.vectorClock).toBeDefined();
      expect(updated.vectorClock?.['test-device']).toBeGreaterThan(0);
    });

    it('should preserve existing task properties when adding dependency', async () => {
      const taskA = await createTask(
        createMockTaskDraft({
          title: 'Task A',
          description: 'Description A',
          tags: ['tag1', 'tag2'],
          urgent: true,
          important: false,
        })
      );
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      const updated = await addDependency(taskA.id, taskB.id);

      expect(updated.title).toBe('Task A');
      expect(updated.description).toBe('Description A');
      expect(updated.tags).toEqual(['tag1', 'tag2']);
      expect(updated.urgent).toBe(true);
      expect(updated.important).toBe(false);
    });
  });

  describe('removeDependency', () => {
    it('should remove a dependency from a task', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      // Add dependency
      await addDependency(taskA.id, taskB.id);

      // Remove dependency
      const updated = await removeDependency(taskA.id, taskB.id);

      expect(updated.dependencies).not.toContain(taskB.id);
      expect(updated.dependencies).toHaveLength(0);
    });

    it('should remove only the specified dependency', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));

      // Add multiple dependencies
      await addDependency(taskA.id, taskB.id);
      await addDependency(taskA.id, taskC.id);

      // Remove only taskB
      const updated = await removeDependency(taskA.id, taskB.id);

      expect(updated.dependencies).not.toContain(taskB.id);
      expect(updated.dependencies).toContain(taskC.id);
      expect(updated.dependencies).toHaveLength(1);
    });

    it('should handle removing non-existent dependency gracefully', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));

      // Remove dependency that doesn't exist
      const updated = await removeDependency(taskA.id, 'non-existent');

      expect(updated.dependencies).toHaveLength(0);
    });

    it('should throw error for non-existent task', async () => {
      await expect(removeDependency('non-existent', 'some-id')).rejects.toThrow(
        'Task non-existent not found'
      );
    });

    it('should update vector clock when removing dependency', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      await addDependency(taskA.id, taskB.id);
      const updated = await removeDependency(taskA.id, taskB.id);

      expect(updated.vectorClock).toBeDefined();
      expect(updated.vectorClock?.['test-device']).toBeGreaterThan(0);
    });

    it('should update updatedAt timestamp when removing dependency', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      const withDep = await addDependency(taskA.id, taskB.id);
      
      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await removeDependency(taskA.id, taskB.id);

      expect(updated.updatedAt).not.toBe(withDep.updatedAt);
    });
  });

  describe('removeDependencyReferences', () => {
    it('should remove task from all other tasks dependencies', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));

      // Make taskB and taskC depend on taskA
      await addDependency(taskB.id, taskA.id);
      await addDependency(taskC.id, taskA.id);

      // Remove all references to taskA
      await removeDependencyReferences(taskA.id);

      // Verify taskA is removed from both dependencies
      const db = getDb();
      const updatedB = await db.tasks.get(taskB.id);
      const updatedC = await db.tasks.get(taskC.id);

      expect(updatedB?.dependencies).not.toContain(taskA.id);
      expect(updatedC?.dependencies).not.toContain(taskA.id);
    });

    it('should handle task with no references gracefully', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));

      // Should not throw error
      await expect(removeDependencyReferences(taskA.id)).resolves.toBeUndefined();
    });

    it('should only remove specified task from dependencies', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));

      // Make taskC depend on both taskA and taskB
      await addDependency(taskC.id, taskA.id);
      await addDependency(taskC.id, taskB.id);

      // Remove only taskA references
      await removeDependencyReferences(taskA.id);

      const db = getDb();
      const updatedC = await db.tasks.get(taskC.id);

      expect(updatedC?.dependencies).not.toContain(taskA.id);
      expect(updatedC?.dependencies).toContain(taskB.id);
      expect(updatedC?.dependencies).toHaveLength(1);
    });

    it('should handle multiple tasks with same dependency', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));
      const taskD = await createTask(createMockTaskDraft({ title: 'Task D' }));

      // Make multiple tasks depend on taskA
      await addDependency(taskB.id, taskA.id);
      await addDependency(taskC.id, taskA.id);
      await addDependency(taskD.id, taskA.id);

      // Remove all references to taskA
      await removeDependencyReferences(taskA.id);

      const db = getDb();
      const updatedB = await db.tasks.get(taskB.id);
      const updatedC = await db.tasks.get(taskC.id);
      const updatedD = await db.tasks.get(taskD.id);

      expect(updatedB?.dependencies).toHaveLength(0);
      expect(updatedC?.dependencies).toHaveLength(0);
      expect(updatedD?.dependencies).toHaveLength(0);
    });

    it('should not affect tasks without the dependency', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));

      // Only taskB depends on taskA
      await addDependency(taskB.id, taskA.id);

      const originalC = await getDb().tasks.get(taskC.id);
      const originalCUpdatedAt = originalC?.updatedAt;

      // Remove taskA references
      await removeDependencyReferences(taskA.id);

      const db = getDb();
      const updatedC = await db.tasks.get(taskC.id);

      // TaskC should be unchanged
      expect(updatedC?.updatedAt).toBe(originalCUpdatedAt);
      expect(updatedC?.dependencies).toHaveLength(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex dependency chain cleanup', async () => {
      // Create a dependency chain: A <- B <- C <- D
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));
      const taskD = await createTask(createMockTaskDraft({ title: 'Task D' }));

      await addDependency(taskB.id, taskA.id);
      await addDependency(taskC.id, taskB.id);
      await addDependency(taskD.id, taskC.id);

      // Remove taskB from the chain
      await removeDependencyReferences(taskB.id);

      const db = getDb();
      const updatedC = await db.tasks.get(taskC.id);

      expect(updatedC?.dependencies).not.toContain(taskB.id);
      expect(updatedC?.dependencies).toHaveLength(0);
    });

    it('should handle adding and removing same dependency multiple times', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));

      // Add, remove, add again
      await addDependency(taskA.id, taskB.id);
      await removeDependency(taskA.id, taskB.id);
      const final = await addDependency(taskA.id, taskB.id);

      expect(final.dependencies).toContain(taskB.id);
      expect(final.dependencies).toHaveLength(1);
    });

    it('should maintain dependency integrity across operations', async () => {
      const taskA = await createTask(createMockTaskDraft({ title: 'Task A' }));
      const taskB = await createTask(createMockTaskDraft({ title: 'Task B' }));
      const taskC = await createTask(createMockTaskDraft({ title: 'Task C' }));

      // Create dependencies: A depends on B and C
      await addDependency(taskA.id, taskB.id);
      await addDependency(taskA.id, taskC.id);

      // Remove B
      await removeDependency(taskA.id, taskB.id);

      const db = getDb();
      const updated = await db.tasks.get(taskA.id);

      expect(updated?.dependencies).toEqual([taskC.id]);
    });
  });
});
