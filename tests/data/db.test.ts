import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import type { TaskRecord, QuadrantId } from '@/lib/types';

describe('Database', () => {
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    // Clear all tables
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.smartViews.clear();
    await db.notificationSettings.clear();
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
    await db.archiveSettings.clear();
    await db.syncHistory.clear();
  });

  afterEach(async () => {
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.smartViews.clear();
    await db.notificationSettings.clear();
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
    await db.archiveSettings.clear();
    await db.syncHistory.clear();
  });

  describe('Database Initialization', () => {
    it('should initialize database with correct name', () => {
      expect(db.name).toBe('GsdTaskManager');
    });

    it('should create tasks table', async () => {
      const tables = db.tables.map(t => t.name);
      expect(tables).toContain('tasks');
    });

    it('should create all required tables', async () => {
      const tables = db.tables.map(t => t.name);
      expect(tables).toContain('tasks');
      expect(tables).toContain('archivedTasks');
      expect(tables).toContain('smartViews');
      expect(tables).toContain('notificationSettings');
      expect(tables).toContain('syncQueue');
      expect(tables).toContain('syncMetadata');
      expect(tables).toContain('archiveSettings');
      expect(tables).toContain('syncHistory');
    });

    it('should be a singleton instance', () => {
      const db1 = getDb();
      const db2 = getDb();

      expect(db1).toBe(db2);
    });
  });

  describe('Tasks Table', () => {
    it('should add and retrieve a task', async () => {
      const task: TaskRecord = {
        id: 'test-task-1',
        title: 'Test Task',
        description: 'Test description',
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
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      };

      await db.tasks.add(task);

      const retrieved = await db.tasks.get('test-task-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Task');
      expect(retrieved?.quadrant).toBe('urgent-important');
    });

    it('should query tasks by quadrant', async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Urgent Important',
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Not Urgent Important',
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const urgentImportant = await db.tasks.where('quadrant').equals('urgent-important').toArray();
      const notUrgentImportant = await db.tasks.where('quadrant').equals('not-urgent-important').toArray();

      expect(urgentImportant.length).toBe(1);
      expect(urgentImportant[0].id).toBe('task-1');

      expect(notUrgentImportant.length).toBe(1);
      expect(notUrgentImportant[0].id).toBe('task-2');
    });

    it('should query tasks by completion status', async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Completed Task',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: true,
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Active Task',
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const completed = await db.tasks.filter(t => t.completed === true).toArray();
      const active = await db.tasks.filter(t => t.completed === false).toArray();

      expect(completed.length).toBe(1);
      expect(completed[0].id).toBe('task-1');

      expect(active.length).toBe(1);
      expect(active[0].id).toBe('task-2');
    });

    it('should query tasks by compound index [quadrant+completed]', async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Urgent Important Active',
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Urgent Important Completed',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: true,
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const urgentImportantActive = await db.tasks
        .filter(t => t.quadrant === 'urgent-important' && t.completed === false)
        .toArray();

      expect(urgentImportantActive.length).toBe(1);
      expect(urgentImportantActive[0].id).toBe('task-1');
    });

    it('should query tasks by tags using multi-entry index', async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Work Task',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['work', 'urgent'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Personal Task',
          description: '',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['personal'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const workTasks = await db.tasks.where('tags').equals('work').toArray();
      const urgentTasks = await db.tasks.where('tags').equals('urgent').toArray();

      expect(workTasks.length).toBe(1);
      expect(workTasks[0].id).toBe('task-1');

      expect(urgentTasks.length).toBe(1);
      expect(urgentTasks[0].id).toBe('task-1');
    });

    it('should query tasks by dependencies using multi-entry index', async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Dependent Task',
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
          dependencies: ['task-0'],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Independent Task',
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const dependentTasks = await db.tasks.where('dependencies').equals('task-0').toArray();

      expect(dependentTasks.length).toBe(1);
      expect(dependentTasks[0].id).toBe('task-1');
    });

    it('should update a task', async () => {
      const task: TaskRecord = {
        id: 'task-1',
        title: 'Original Title',
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
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      };

      await db.tasks.add(task);

      await db.tasks.update('task-1', { title: 'Updated Title' });

      const updated = await db.tasks.get('task-1');

      expect(updated?.title).toBe('Updated Title');
    });

    it('should delete a task', async () => {
      const task: TaskRecord = {
        id: 'task-1',
        title: 'Task to Delete',
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
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      };

      await db.tasks.add(task);

      await db.tasks.delete('task-1');

      const deleted = await db.tasks.get('task-1');

      expect(deleted).toBeUndefined();
    });

    it('should count tasks', async () => {
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      const count = await db.tasks.count();

      expect(count).toBe(2);
    });

    it('should clear all tasks', async () => {
      await db.tasks.bulkAdd([
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ]);

      await db.tasks.clear();

      const count = await db.tasks.count();

      expect(count).toBe(0);
    });
  });

  describe('Archived Tasks Table', () => {
    it('should add and retrieve archived task', async () => {
      const now = Date.now();
      const archivedTask: TaskRecord = {
        id: 'archived-1',
        title: 'Archived Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: true,
        completedAt: new Date(now - 86400000).toISOString(),
        archivedAt: new Date(now).toISOString(),
        createdAt: new Date(now - 172800000).toISOString(),
        updatedAt: new Date(now - 86400000).toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      };

      await db.archivedTasks.add(archivedTask);

      const retrieved = await db.archivedTasks.get('archived-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Archived Task');
      expect(retrieved?.archivedAt).toBeDefined();
    });

    it('should query archived tasks by archivedAt', async () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 86400000).toISOString();
      const twoDaysAgo = new Date(now - 172800000).toISOString();

      const tasks: TaskRecord[] = [
        {
          id: 'archived-1',
          title: 'Recently Archived',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: true,
          completedAt: oneDayAgo,
          archivedAt: oneDayAgo,
          createdAt: twoDaysAgo,
          updatedAt: oneDayAgo,
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'archived-2',
          title: 'Old Archived',
          description: '',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: true,
          completedAt: twoDaysAgo,
          archivedAt: twoDaysAgo,
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.archivedTasks.bulkAdd(tasks);

      const recentlyArchived = await db.archivedTasks
        .where('archivedAt')
        .above(new Date(now - 86400000 - 1000).toISOString())
        .toArray();

      expect(recentlyArchived.length).toBe(1);
      expect(recentlyArchived[0].id).toBe('archived-1');
    });
  });

  describe('Smart Views Table', () => {
    it('should add and retrieve smart view', async () => {
      const smartView = {
        id: 'view-1',
        name: 'My View',
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        criteria: {
          quadrants: ['urgent-important'] as QuadrantId[],
          status: 'active' as const,
          tags: [],
        },
      };

      await db.smartViews.add(smartView);

      const retrieved = await db.smartViews.get('view-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('My View');
    });

    it('should query smart views by isBuiltIn', async () => {
      await db.smartViews.bulkAdd([
        {
          id: 'view-1',
          name: 'Built-in View',
          isBuiltIn: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          criteria: {},
        },
        {
          id: 'view-2',
          name: 'Custom View',
          isBuiltIn: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          criteria: {},
        },
      ]);

      const builtIn = await db.smartViews.filter(v => v.isBuiltIn === true).toArray();
      const custom = await db.smartViews.filter(v => v.isBuiltIn === false).toArray();

      expect(builtIn.length).toBe(1);
      expect(custom.length).toBe(1);
    });
  });

  describe('Sync Queue Table', () => {
    it('should add and retrieve sync queue item', async () => {
      const queueItem = {
        id: 'queue-1',
        taskId: 'task-1',
        operation: 'create' as const,
        timestamp: Date.now(),
        retryCount: 0,
        payload: null,
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      };

      await db.syncQueue.add(queueItem);

      const retrieved = await db.syncQueue.get('queue-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.taskId).toBe('task-1');
      expect(retrieved?.operation).toBe('create');
    });

    it('should query queue items by operation', async () => {
      const now = Date.now();

      await db.syncQueue.bulkAdd([
        {
          id: 'queue-1',
          taskId: 'task-1',
          operation: 'create' as const,
          timestamp: now,
          retryCount: 0,
          payload: null,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'queue-2',
          taskId: 'task-2',
          operation: 'update' as const,
          timestamp: now,
          retryCount: 0,
          payload: null,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'queue-3',
          taskId: 'task-3',
          operation: 'delete' as const,
          timestamp: now,
          retryCount: 0,
          payload: null,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ]);

      const creates = await db.syncQueue.where('operation').equals('create').toArray();
      const updates = await db.syncQueue.where('operation').equals('update').toArray();
      const deletes = await db.syncQueue.where('operation').equals('delete').toArray();

      expect(creates.length).toBe(1);
      expect(updates.length).toBe(1);
      expect(deletes.length).toBe(1);
    });

    it('should order queue items by timestamp', async () => {
      const now = Date.now();

      await db.syncQueue.bulkAdd([
        {
          id: 'queue-3',
          taskId: 'task-3',
          operation: 'create' as const,
          timestamp: now + 2000,
          retryCount: 0,
          payload: null,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'queue-1',
          taskId: 'task-1',
          operation: 'create' as const,
          timestamp: now,
          retryCount: 0,
          payload: null,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'queue-2',
          taskId: 'task-2',
          operation: 'update' as const,
          timestamp: now + 1000,
          retryCount: 0,
          payload: null,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ]);

      const ordered = await db.syncQueue.orderBy('timestamp').toArray();

      expect(ordered[0].id).toBe('queue-1');
      expect(ordered[1].id).toBe('queue-2');
      expect(ordered[2].id).toBe('queue-3');
    });
  });

  describe('Sync Metadata Table', () => {
    it('should store sync config', async () => {
      const syncConfig = {
        key: 'sync_config' as const,
        enabled: true,
        userId: 'user-123',
        deviceId: 'device-123',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'token-123',
        tokenExpiresAt: Date.now() + 86400000,
        lastSyncAt: Date.now(),
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
        conflictStrategy: 'last_write_wins' as const,
        serverUrl: 'https://api.example.com',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      };

      await db.syncMetadata.put(syncConfig);

      const retrieved = await db.syncMetadata.get('sync_config');

      expect(retrieved).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((retrieved as any)?.userId).toBe('user-123');
    });
  });

  describe('Sync History Table', () => {
    it('should add and retrieve sync history record', async () => {
      const historyRecord = {
        id: 'history-1',
        timestamp: new Date().toISOString(),
        status: 'success' as const,
        deviceId: 'device-123',
        pushedCount: 5,
        pulledCount: 3,
        conflictsResolved: 0,
        triggeredBy: 'user' as const,
      };

      await db.syncHistory.add(historyRecord);

      const retrieved = await db.syncHistory.get('history-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe('success');
      expect(retrieved?.pushedCount).toBe(5);
    });

    it('should query sync history by status', async () => {
      const now = new Date().toISOString();
      const later = new Date(Date.now() + 1000).toISOString();

      await db.syncHistory.bulkAdd([
        {
          id: 'history-1',
          timestamp: now,
          status: 'success' as const,
          deviceId: 'device-123',
          pushedCount: 5,
          pulledCount: 3,
          conflictsResolved: 0,
          triggeredBy: 'user' as const,
        },
        {
          id: 'history-2',
          timestamp: later,
          status: 'error' as const,
          deviceId: 'device-123',
          errorMessage: 'Network error',
          pushedCount: 0,
          pulledCount: 0,
          conflictsResolved: 0,
          triggeredBy: 'auto' as const,
        },
      ]);

      const successes = await db.syncHistory.where('status').equals('success').toArray();
      const errors = await db.syncHistory.where('status').equals('error').toArray();

      expect(successes.length).toBe(1);
      expect(errors.length).toBe(1);
    });

    it('should order sync history by timestamp', async () => {
      const now = new Date().toISOString();
      const later = new Date(Date.now() + 1000).toISOString();

      await db.syncHistory.bulkAdd([
        {
          id: 'history-2',
          timestamp: later,
          status: 'success' as const,
          deviceId: 'device-123',
          pushedCount: 0,
          pulledCount: 0,
          conflictsResolved: 0,
          triggeredBy: 'user' as const,
        },
        {
          id: 'history-1',
          timestamp: now,
          status: 'success' as const,
          deviceId: 'device-123',
          pushedCount: 0,
          pulledCount: 0,
          conflictsResolved: 0,
          triggeredBy: 'user' as const,
        },
      ]);

      const ordered = await db.syncHistory.orderBy('timestamp').reverse().toArray();

      expect(ordered[0].id).toBe('history-2');
      expect(ordered[1].id).toBe('history-1');
    });
  });

  describe('Archive Settings Table', () => {
    it('should store and retrieve archive settings', async () => {
      const settings = {
        id: 'settings' as const,
        enabled: true,
        archiveAfterDays: 30 as const,
      };

      await db.archiveSettings.put(settings);

      const retrieved = await db.archiveSettings.get('settings');

      expect(retrieved).toBeDefined();
      expect(retrieved?.enabled).toBe(true);
      expect(retrieved?.archiveAfterDays).toBe(30);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk add', async () => {
      const tasks: TaskRecord[] = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        description: '',
        urgent: i % 2 === 0,
        important: i % 3 === 0,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      }));

      await db.tasks.bulkAdd(tasks);

      const count = await db.tasks.count();

      expect(count).toBe(100);
    });

    it('should perform bulk delete', async () => {
      const tasks: TaskRecord[] = Array.from({ length: 10 }, (_, i) => ({
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
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      }));

      await db.tasks.bulkAdd(tasks);

      const idsToDelete = ['task-0', 'task-1', 'task-2'];
      await db.tasks.bulkDelete(idsToDelete);

      const remaining = await db.tasks.count();

      expect(remaining).toBe(7);
    });

    it('should perform bulk update', async () => {
      const tasks: TaskRecord[] = Array.from({ length: 5 }, (_, i) => ({
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
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      }));

      await db.tasks.bulkAdd(tasks);

      const initialTasks = await db.tasks.filter(t => t.completed === true).toArray();
      expect(initialTasks.length).toBe(0);

      await db.tasks.bulkPut(
        tasks.map(task => ({ ...task, completed: true, completedAt: new Date().toISOString() }))
      );

      const updatedTasks = await db.tasks.filter(t => t.completed === true).toArray();

      expect(updatedTasks.length).toBe(5);
    });
  });

  describe('Transaction Support', () => {
    it('should support transactions across multiple tables', async () => {
      await db.transaction('rw', [db.tasks, db.syncQueue], async () => {
        const task: TaskRecord = {
          id: 'task-1',
          title: 'Transaction Task',
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
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        };

        await db.tasks.add(task);

        await db.syncQueue.add({
          id: 'queue-1',
          taskId: 'task-1',
          operation: 'create',
          timestamp: Date.now(),
          retryCount: 0,
          payload: task,
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        });
      });

      const task = await db.tasks.get('task-1');
      const queueItem = await db.syncQueue.get('queue-1');

      expect(task).toBeDefined();
      expect(queueItem).toBeDefined();
      expect(queueItem?.taskId).toBe('task-1');
    });

    it('should rollback transaction on error', async () => {
      const addTasksWithError = async () => {
        await db.transaction('rw', db.tasks, async () => {
          await db.tasks.add({
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
            vectorClock: {}, notificationEnabled: true, notificationSent: false,
          });

          throw new Error('Simulated error');
        });
      };

      await expect(addTasksWithError()).rejects.toThrow('Simulated error');

      const count = await db.tasks.count();

      expect(count).toBe(0); // Transaction should have rolled back
    });
  });

  describe('Error Handling', () => {
    it('should throw error when adding duplicate primary key', async () => {
      const task: TaskRecord = {
        id: 'duplicate-task',
        title: 'Task',
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
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      };

      await db.tasks.add(task);

      await expect(db.tasks.add(task)).rejects.toThrow();
    });

    it('should handle getting non-existent record', async () => {
      const task = await db.tasks.get('non-existent');

      expect(task).toBeUndefined();
    });

    it('should handle deleting non-existent record', async () => {
      // Should not throw
      await expect(db.tasks.delete('non-existent')).resolves.not.toThrow();
    });
  });
});
