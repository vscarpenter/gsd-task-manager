/**
 * Tests for QueueOptimizer - queue consolidation functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import { QueueOptimizer, getQueueOptimizer } from '@/lib/sync/queue-optimizer';
import { getSyncQueue } from '@/lib/sync/queue';
import type { TaskRecord } from '@/lib/types';

describe('QueueOptimizer', () => {
  let optimizer: QueueOptimizer;
  let db: ReturnType<typeof getDb>;
  let queue: ReturnType<typeof getSyncQueue>;

  beforeEach(async () => {
    optimizer = getQueueOptimizer();
    db = getDb();
    queue = getSyncQueue();

    // Clear database
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('consolidating multiple updates for same task', () => {
    it('should merge multiple updates into single operation', async () => {
      const taskId = 'task1';
      const basePayload: TaskRecord = {
        id: taskId,
        title: 'Test Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        tags: [],
        subtasks: [],
        dependencies: [],
        recurrence: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationEnabled: true,
        notificationSent: false,
      };

      // Add multiple update operations (with small delays to ensure different timestamps)
      await queue.enqueue('update', taskId, { ...basePayload, title: 'Update 1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', taskId, { ...basePayload, title: 'Update 2' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', taskId, { ...basePayload, title: 'Update 3' });

      let pending = await queue.getPending();
      expect(pending.length).toBe(3);

      // Consolidate
      await optimizer.consolidateTask(taskId);

      pending = await queue.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].payload?.title).toBe('Update 3'); // Latest payload
    });
  });

  describe('removing operations when task deleted', () => {
    it('should remove all operations except delete when task is deleted', async () => {
      const taskId = 'task1';
      const basePayload: TaskRecord = {
        id: taskId,
        title: 'Test Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        tags: [],
        subtasks: [],
        dependencies: [],
        recurrence: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationEnabled: true,
        notificationSent: false,
      };

      // Add create and update operations (with small delays to ensure different timestamps)
      await queue.enqueue('create', taskId, basePayload);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', taskId, { ...basePayload, title: 'Updated' });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Add delete operation
      await queue.enqueue('delete', taskId, null);

      let pending = await queue.getPending();
      expect(pending.length).toBe(3);

      // Consolidate
      await optimizer.consolidateTask(taskId);

      pending = await queue.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].operation).toBe('delete');
    });
  });

  describe('merging create + updates into single create', () => {
    it('should consolidate create and updates into single create with final state', async () => {
      const taskId = 'task1';
      const basePayload: TaskRecord = {
        id: taskId,
        title: 'Initial',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        tags: [],
        subtasks: [],
        dependencies: [],
        recurrence: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationEnabled: true,
        notificationSent: false,
      };

      // Add create operation
      await queue.enqueue('create', taskId, basePayload);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Add update operations (with small delays to ensure different timestamps)
      await queue.enqueue('update', taskId, { ...basePayload, title: 'Update 1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', taskId, { ...basePayload, title: 'Final' });

      let pending = await queue.getPending();
      expect(pending.length).toBe(3);

      // Consolidate
      await optimizer.consolidateTask(taskId);

      pending = await queue.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].operation).toBe('create');
      expect(pending[0].payload?.title).toBe('Final'); // Latest payload
    });
  });

  describe('consolidating duplicate updates', () => {
    it('should consolidate all operations into single operation', async () => {
      const taskId = 'task1';
      const basePayload: TaskRecord = {
        id: taskId,
        title: 'Test Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        tags: [],
        subtasks: [],
        dependencies: [],
        recurrence: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationEnabled: true,
        notificationSent: false,
      };

      // Add operations with small delays to ensure different timestamps
      await queue.enqueue('update', taskId, basePayload);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', taskId, basePayload);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', taskId, basePayload);

      // Consolidate
      await optimizer.consolidateTask(taskId);

      const pending = await queue.getPending();
      expect(pending.length).toBe(1);
    });
  });

  describe('consolidateAll', () => {
    it('should consolidate operations for all tasks and return count removed', async () => {
      const basePayload: TaskRecord = {
        id: 'task1',
        title: 'Test Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        tags: [],
        subtasks: [],
        dependencies: [],
        recurrence: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationEnabled: true,
        notificationSent: false,
      };

      // Add operations for multiple tasks (with small delays to ensure different timestamps)
      await queue.enqueue('update', 'task1', { ...basePayload, id: 'task1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', 'task1', { ...basePayload, id: 'task1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', 'task2', { ...basePayload, id: 'task2' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue('update', 'task2', { ...basePayload, id: 'task2' });

      let pending = await queue.getPending();
      expect(pending.length).toBe(4);

      // Consolidate all
      const removed = await optimizer.consolidateAll();

      expect(removed).toBe(2); // 2 operations removed (1 per task)
      
      pending = await queue.getPending();
      expect(pending.length).toBe(2); // 1 operation per task remains
    });
  });
});
