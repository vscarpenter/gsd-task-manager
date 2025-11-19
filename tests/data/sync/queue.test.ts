import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncQueue, getSyncQueue } from '@/lib/sync/queue';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';

describe('SyncQueue', () => {
  let queue: SyncQueue;
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    queue = getSyncQueue();
    db = getDb();
    await db.syncQueue.clear();
    await db.tasks.clear();
  });

  afterEach(async () => {
    await db.syncQueue.clear();
    await db.tasks.clear();
  });

  describe('enqueue', () => {
    it('should add operation to queue', async () => {
      const task: TaskRecord = {
        id: 'task-1',
        title: 'Test Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: { 'device-1': 1 },
      };

      await queue.enqueue('create', 'task-1', task, task.vectorClock);

      const pending = await queue.getPending();

      expect(pending.length).toBe(1);
      expect(pending[0].taskId).toBe('task-1');
      expect(pending[0].operation).toBe('create');
      expect(pending[0].payload).toEqual(task);
      expect(pending[0].vectorClock).toEqual({ 'device-1': 1 });
      expect(pending[0].retryCount).toBe(0);
    });

    it('should enqueue multiple operations', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});
      await queue.enqueue('delete', 'task-3', null, {});

      const pending = await queue.getPending();

      expect(pending.length).toBe(3);
      expect(pending.map(p => p.operation)).toEqual(['create', 'update', 'delete']);
    });

    it('should set timestamp on enqueue', async () => {
      const beforeEnqueue = Date.now();

      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();
      const afterEnqueue = Date.now();

      expect(pending[0].timestamp).toBeGreaterThanOrEqual(beforeEnqueue);
      expect(pending[0].timestamp).toBeLessThanOrEqual(afterEnqueue);
    });

    it('should initialize retry count to 0', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();

      expect(pending[0].retryCount).toBe(0);
    });
  });

  describe('getPending', () => {
    it('should return empty array when queue is empty', async () => {
      const pending = await queue.getPending();

      expect(pending).toEqual([]);
    });

    it('should return all pending operations ordered by timestamp', async () => {
      // Add operations in reverse order
      await queue.enqueue('delete', 'task-3', null, {});
      await queue.enqueue('update', 'task-2', null, {});
      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();

      // Should be ordered by timestamp (oldest first)
      expect(pending.length).toBe(3);
      expect(pending[0].operation).toBe('delete');
      expect(pending[1].operation).toBe('update');
      expect(pending[2].operation).toBe('create');
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 when queue is empty', async () => {
      const count = await queue.getPendingCount();

      expect(count).toBe(0);
    });

    it('should return correct count of pending operations', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});
      await queue.enqueue('delete', 'task-3', null, {});

      const count = await queue.getPendingCount();

      expect(count).toBe(3);
    });

    it('should update count after dequeue', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});

      const pending = await queue.getPending();
      await queue.dequeue(pending[0].id);

      const count = await queue.getPendingCount();

      expect(count).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should remove operation from queue', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();
      expect(pending.length).toBe(1);

      await queue.dequeue(pending[0].id);

      const afterDequeue = await queue.getPending();
      expect(afterDequeue.length).toBe(0);
    });

    it('should only remove specified operation', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});
      await queue.enqueue('delete', 'task-3', null, {});

      const pending = await queue.getPending();
      await queue.dequeue(pending[1].id); // Remove middle one

      const remaining = await queue.getPending();

      expect(remaining.length).toBe(2);
      expect(remaining[0].taskId).toBe('task-1');
      expect(remaining[1].taskId).toBe('task-3');
    });

    it('should handle dequeuing non-existent operation', async () => {
      await expect(queue.dequeue('non-existent')).resolves.not.toThrow();
    });
  });

  describe('dequeueBulk', () => {
    it('should remove multiple operations at once', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});
      await queue.enqueue('delete', 'task-3', null, {});

      const pending = await queue.getPending();
      const idsToRemove = [pending[0].id, pending[2].id];

      await queue.dequeueBulk(idsToRemove);

      const remaining = await queue.getPending();

      expect(remaining.length).toBe(1);
      expect(remaining[0].taskId).toBe('task-2');
    });

    it('should handle empty bulk delete', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      await queue.dequeueBulk([]);

      const pending = await queue.getPending();

      expect(pending.length).toBe(1);
    });

    it('should handle deleting all operations in bulk', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});

      const pending = await queue.getPending();
      await queue.dequeueBulk(pending.map(p => p.id));

      const remaining = await queue.getPending();

      expect(remaining.length).toBe(0);
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();
      const itemId = pending[0].id;

      await queue.incrementRetry(itemId);

      const updated = await queue.getPending();

      expect(updated[0].retryCount).toBe(1);
    });

    it('should increment multiple times', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();
      const itemId = pending[0].id;

      await queue.incrementRetry(itemId);
      await queue.incrementRetry(itemId);
      await queue.incrementRetry(itemId);

      const updated = await queue.getPending();

      expect(updated[0].retryCount).toBe(3);
    });

    it('should handle incrementing non-existent operation', async () => {
      await expect(queue.incrementRetry('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all operations', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});
      await queue.enqueue('delete', 'task-3', null, {});

      await queue.clear();

      const pending = await queue.getPending();

      expect(pending.length).toBe(0);
    });

    it('should handle clearing empty queue', async () => {
      await queue.clear();

      const pending = await queue.getPending();

      expect(pending.length).toBe(0);
    });
  });

  describe('getForTask', () => {
    it('should return operations for specific task', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-1', null, {});
      await queue.enqueue('update', 'task-2', null, {});

      const operations = await queue.getForTask('task-1');

      expect(operations.length).toBe(2);
      expect(operations.every(op => op.taskId === 'task-1')).toBe(true);
    });

    it('should return empty array when no operations for task', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      const operations = await queue.getForTask('task-2');

      expect(operations).toEqual([]);
    });

    it('should return all operation types for a task', async () => {
      await queue.enqueue('create', 'task-1', null, {});
      await queue.enqueue('update', 'task-1', null, {});
      await queue.enqueue('delete', 'task-1', null, {});

      const operations = await queue.getForTask('task-1');

      expect(operations.length).toBe(3);
      expect(operations.map(op => op.operation)).toEqual(['create', 'update', 'delete']);
    });
  });

  describe('populateFromExistingTasks', () => {
    it('should add all existing tasks to queue', async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: '',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const count = await queue.populateFromExistingTasks();

      expect(count).toBe(2);

      const pending = await queue.getPending();

      expect(pending.length).toBe(2);
      expect(pending.every(p => p.operation === 'create')).toBe(true);
      expect(pending.map(p => p.taskId).sort()).toEqual(['task-1', 'task-2']);
    });

    it('should return 0 when no tasks exist', async () => {
      const count = await queue.populateFromExistingTasks();

      expect(count).toBe(0);

      const pending = await queue.getPending();

      expect(pending.length).toBe(0);
    });

    it('should skip tasks already in queue', async () => {
      const task: TaskRecord = {
        id: 'task-1',
        title: 'Task 1',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      };

      await db.tasks.add(task);

      // Manually add task to queue first
      await queue.enqueue('update', 'task-1', task, {});

      // Now try to populate
      const count = await queue.populateFromExistingTasks();

      expect(count).toBe(0); // Should skip because already in queue

      const pending = await queue.getPending();

      expect(pending.length).toBe(1); // Still only one operation
      expect(pending[0].operation).toBe('update'); // Original operation preserved
    });

    it('should handle large number of tasks', async () => {
      const tasks: TaskRecord[] = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      }));

      await db.tasks.bulkAdd(tasks);

      const count = await queue.populateFromExistingTasks();

      expect(count).toBe(100);

      const pending = await queue.getPending();

      expect(pending.length).toBe(100);
    });

    it('should use task vector clock when adding to queue', async () => {
      const task: TaskRecord = {
        id: 'task-1',
        title: 'Task 1',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: { 'device-1': 5, 'device-2': 3 },
      };

      await db.tasks.add(task);

      await queue.populateFromExistingTasks();

      const pending = await queue.getPending();

      expect(pending[0].vectorClock).toEqual({ 'device-1': 5, 'device-2': 3 });
    });
  });

  describe('getSyncQueue singleton', () => {
    it('should return same instance', () => {
      const queue1 = getSyncQueue();
      const queue2 = getSyncQueue();

      expect(queue1).toBe(queue2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle enqueueing null payload', async () => {
      await queue.enqueue('delete', 'task-1', null, {});

      const pending = await queue.getPending();

      expect(pending[0].payload).toBeNull();
    });

    it('should handle empty vector clock', async () => {
      await queue.enqueue('create', 'task-1', null, {});

      const pending = await queue.getPending();

      expect(pending[0].vectorClock).toEqual({});
    });

    it('should handle complex vector clock', async () => {
      const complexClock = {
        'device-1': 10,
        'device-2': 5,
        'device-3': 15,
        'device-4': 2,
      };

      await queue.enqueue('update', 'task-1', null, complexClock);

      const pending = await queue.getPending();

      expect(pending[0].vectorClock).toEqual(complexClock);
    });

    it('should handle rapid enqueue operations', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(queue.enqueue('create', `task-${i}`, null, {}));
      }

      await Promise.all(promises);

      const count = await queue.getPendingCount();

      expect(count).toBe(50);
    });

    it('should handle concurrent dequeue operations', async () => {
      // Add 10 operations
      for (let i = 0; i < 10; i++) {
        await queue.enqueue('create', `task-${i}`, null, {});
      }

      const pending = await queue.getPending();

      // Dequeue half concurrently
      const dequeuePromises = pending
        .slice(0, 5)
        .map(item => queue.dequeue(item.id));

      await Promise.all(dequeuePromises);

      const remaining = await queue.getPendingCount();

      expect(remaining).toBe(5);
    });
  });

  describe('FIFO Ordering', () => {
    it('should maintain FIFO order', async () => {
      const timestamps: number[] = [];

      for (let i = 0; i < 5; i++) {
        await queue.enqueue('create', `task-${i}`, null, {});
        const pending = await queue.getPending();
        timestamps.push(pending[pending.length - 1].timestamp);
      }

      const pending = await queue.getPending();

      // Timestamps should be in ascending order
      for (let i = 1; i < pending.length; i++) {
        expect(pending[i].timestamp).toBeGreaterThanOrEqual(pending[i - 1].timestamp);
      }
    });
  });
});
