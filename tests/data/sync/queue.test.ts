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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
      };

      await queue.enqueue('create', 'task-1', task);

      const pending = await queue.getPending();

      expect(pending.length).toBe(1);
      expect(pending[0].taskId).toBe('task-1');
      expect(pending[0].operation).toBe('create');
      expect(pending[0].payload).toEqual(task);
      expect(pending[0].retryCount).toBe(0);
    });

    it('should enqueue multiple operations', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);
      await queue.enqueue('delete', 'task-3', null);

      const pending = await queue.getPending();

      expect(pending.length).toBe(3);
      const operations = pending.map(p => p.operation).sort();
      expect(operations).toEqual(['create', 'delete', 'update']);
    });

    it('should set timestamp on enqueue', async () => {
      const beforeEnqueue = Date.now();

      await queue.enqueue('create', 'task-1', null);

      const pending = await queue.getPending();
      const afterEnqueue = Date.now();

      expect(pending[0].timestamp).toBeGreaterThanOrEqual(beforeEnqueue);
      expect(pending[0].timestamp).toBeLessThanOrEqual(afterEnqueue);
    });

    it('should initialize retry count to 0', async () => {
      await queue.enqueue('create', 'task-1', null);

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
      // Add operations with small delays to ensure different timestamps
      await queue.enqueue('delete', 'task-3', null);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', 'task-2', null);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('create', 'task-1', null);

      const pending = await queue.getPending();

      // Should be ordered by timestamp (oldest first)
      expect(pending.length).toBe(3);

      // Verify timestamps are ascending
      for (let i = 1; i < pending.length; i++) {
        expect(pending[i].timestamp).toBeGreaterThanOrEqual(pending[i - 1].timestamp);
      }

      // Verify all operations are present
      const operations = pending.map(p => p.operation).sort();
      expect(operations).toEqual(['create', 'delete', 'update']);
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 when queue is empty', async () => {
      const count = await queue.getPendingCount();

      expect(count).toBe(0);
    });

    it('should return correct count of pending operations', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);
      await queue.enqueue('delete', 'task-3', null);

      const count = await queue.getPendingCount();

      expect(count).toBe(3);
    });

    it('should update count after dequeue', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);

      const pending = await queue.getPending();
      await queue.dequeue(pending[0].id);

      const count = await queue.getPendingCount();

      expect(count).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should remove operation from queue', async () => {
      await queue.enqueue('create', 'task-1', null);

      const pending = await queue.getPending();
      expect(pending.length).toBe(1);

      await queue.dequeue(pending[0].id);

      const afterDequeue = await queue.getPending();
      expect(afterDequeue.length).toBe(0);
    });

    it('should only remove specified operation', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);
      await queue.enqueue('delete', 'task-3', null);

      const pending = await queue.getPending();
      const task2Operation = pending.find(p => p.taskId === 'task-2');
      await queue.dequeue(task2Operation!.id); // Remove task-2

      const remaining = await queue.getPending();

      expect(remaining.length).toBe(2);
      expect(remaining.map(r => r.taskId).sort()).toEqual(['task-1', 'task-3']);
    });

    it('should handle dequeuing non-existent operation', async () => {
      await expect(queue.dequeue('non-existent')).resolves.not.toThrow();
    });
  });

  describe('dequeueBulk', () => {
    it('should remove multiple operations at once', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);
      await queue.enqueue('delete', 'task-3', null);

      const pending = await queue.getPending();
      const task1Op = pending.find(p => p.taskId === 'task-1');
      const task3Op = pending.find(p => p.taskId === 'task-3');
      const idsToRemove = [task1Op!.id, task3Op!.id];

      await queue.dequeueBulk(idsToRemove);

      const remaining = await queue.getPending();

      expect(remaining.length).toBe(1);
      expect(remaining[0].taskId).toBe('task-2');
    });

    it('should handle empty bulk delete', async () => {
      await queue.enqueue('create', 'task-1', null);

      await queue.dequeueBulk([]);

      const pending = await queue.getPending();

      expect(pending.length).toBe(1);
    });

    it('should handle deleting all operations in bulk', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);

      const pending = await queue.getPending();
      await queue.dequeueBulk(pending.map(p => p.id));

      const remaining = await queue.getPending();

      expect(remaining.length).toBe(0);
    });
  });

  describe('recordAttemptFailure', () => {
    it('should increment retry count and stamp last error', async () => {
      await queue.enqueue('create', 'task-1', null);

      const pending = await queue.getPending();
      const itemId = pending[0].id;

      await queue.recordAttemptFailure(itemId, 'Network timeout');

      const updated = await queue.getPending();

      expect(updated[0].retryCount).toBe(1);
      expect(updated[0].lastError).toBe('Network timeout');
      expect(updated[0].lastAttemptAt).toBeGreaterThan(0);
      expect(updated[0].status ?? 'pending').toBe('pending');
    });

    it('should mark item as failed when retries are exhausted, not delete it', async () => {
      await queue.enqueue('update', 'task-1', null);
      const [item] = await queue.getPending();

      // MAX_RETRIES = 5. After 5 failures, the item must be in 'failed' status,
      // NOT deleted from the queue.
      for (let i = 0; i < 5; i++) {
        await queue.recordAttemptFailure(item.id, `Attempt ${i + 1} failed`);
      }

      const pending = await queue.getPending();
      const failed = await queue.getFailed();

      expect(pending).toHaveLength(0);
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe(item.id);
      expect(failed[0].status).toBe('failed');
      expect(failed[0].lastError).toBe('Attempt 5 failed');
      expect(failed[0].failedAt).toBeGreaterThan(0);
      expect(failed[0].retryCount).toBe(5);
    });

    it('should truncate very long error messages', async () => {
      await queue.enqueue('create', 'task-1', null);
      const [item] = await queue.getPending();

      const hugeError = 'X'.repeat(5000);
      await queue.recordAttemptFailure(item.id, hugeError);

      const [updated] = await queue.getPending();
      expect(updated.lastError).toBeDefined();
      expect(updated.lastError!.length).toBeLessThanOrEqual(500);
    });

    it('should handle non-existent operation', async () => {
      await expect(queue.recordAttemptFailure('non-existent', 'err')).resolves.not.toThrow();
    });
  });

  describe('getPending excludes failed items', () => {
    it('should not include failed items in getPending', async () => {
      await queue.enqueue('create', 'task-good', null);
      await queue.enqueue('create', 'task-bad', null);
      const items = await queue.getPending();
      const badItem = items.find(i => i.taskId === 'task-bad')!;

      // Drive task-bad to failure
      for (let i = 0; i < 5; i++) {
        await queue.recordAttemptFailure(badItem.id, 'persistent failure');
      }

      const stillPending = await queue.getPending();
      expect(stillPending.map(i => i.taskId)).toEqual(['task-good']);
      expect(await queue.getPendingCount()).toBe(1);
    });
  });

  describe('getFailed', () => {
    it('should return only failed items', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('create', 'task-2', null);
      const items = await queue.getPending();

      // Fail item 0
      for (let i = 0; i < 5; i++) {
        await queue.recordAttemptFailure(items[0].id, 'boom');
      }

      const failed = await queue.getFailed();
      expect(failed).toHaveLength(1);
      expect(failed[0].taskId).toBe(items[0].taskId);
    });

    it('should return empty array when no failed items', async () => {
      await queue.enqueue('create', 'task-1', null);
      const failed = await queue.getFailed();
      expect(failed).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all operations', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);
      await queue.enqueue('delete', 'task-3', null);

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
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-1', null);
      await queue.enqueue('update', 'task-2', null);

      const operations = await queue.getForTask('task-1');

      expect(operations.length).toBe(2);
      expect(operations.every(op => op.taskId === 'task-1')).toBe(true);
    });

    it('should return empty array when no operations for task', async () => {
      await queue.enqueue('create', 'task-1', null);

      const operations = await queue.getForTask('task-2');

      expect(operations).toEqual([]);
    });

    it('should return all operation types for a task', async () => {
      await queue.enqueue('create', 'task-1', null);
      await queue.enqueue('update', 'task-1', null);
      await queue.enqueue('delete', 'task-1', null);

      const operations = await queue.getForTask('task-1');

      expect(operations.length).toBe(3);
      const operationTypes = operations.map(op => op.operation).sort();
      expect(operationTypes).toEqual(['create', 'delete', 'update']);
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          },
        {
          id: 'task-2',
          title: 'Task 2',
          description: '',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
      };

      await db.tasks.add(task);

      // Manually add task to queue first
      await queue.enqueue('update', 'task-1', task);

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
      }));

      await db.tasks.bulkAdd(tasks);

      const count = await queue.populateFromExistingTasks();

      expect(count).toBe(100);

      const pending = await queue.getPending();

      expect(pending.length).toBe(100);
    });

    it('should add tasks without extra metadata', async () => {
      const task: TaskRecord = {
        id: 'task-1',
        title: 'Task 1',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
      };

      await db.tasks.add(task);

      await queue.populateFromExistingTasks();

      const pending = await queue.getPending();

      expect(pending[0].taskId).toBe('task-1');
      expect(pending[0].operation).toBe('create');
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
      await queue.enqueue('delete', 'task-1', null);

      const pending = await queue.getPending();

      expect(pending[0].payload).toBeNull();
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
        await queue.enqueue('create', `task-${i}`, null);
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
        await queue.enqueue('create', `task-${i}`, null);
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
