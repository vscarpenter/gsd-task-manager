/**
 * Tests for lib/db.ts — schema and migration validation
 *
 * Focuses on post-migration state (v13): table existence, indexes,
 * singleton behaviour, and full-field task CRUD with fake-indexeddb.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';

describe('getDb', () => {
  it('should return a Dexie instance with the correct name', () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(db.name).toBe('GsdTaskManager');
  });

  it('should be a singleton — same instance returned on subsequent calls', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it('should not throw when called multiple times', () => {
    expect(() => getDb()).not.toThrow();
    expect(() => getDb()).not.toThrow();
  });
});

describe('Database schema — v13 tables', () => {
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.smartViews.clear();
    await db.syncMetadata.clear();
  });

  it('should initialise with all expected tables', () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('archivedTasks');
    expect(tableNames).toContain('smartViews');
    expect(tableNames).toContain('notificationSettings');
    expect(tableNames).toContain('syncQueue');
    expect(tableNames).toContain('syncMetadata');
    expect(tableNames).toContain('deviceInfo');
    expect(tableNames).toContain('archiveSettings');
    expect(tableNames).toContain('syncHistory');
    expect(tableNames).toContain('appPreferences');
  });

  it('should have tasks table with all expected indexes', () => {
    const tasksTable = db.tables.find((t) => t.name === 'tasks');
    expect(tasksTable).toBeDefined();

    const indexNames = tasksTable!.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('quadrant');
    expect(indexNames).toContain('completed');
    expect(indexNames).toContain('dueDate');
    expect(indexNames).toContain('createdAt');
    expect(indexNames).toContain('updatedAt');
    expect(indexNames).toContain('completedAt');
    expect(indexNames).toContain('notificationSent');
  });

  it('should have archivedTasks table with archival indexes', () => {
    const archivedTable = db.tables.find((t) => t.name === 'archivedTasks');
    expect(archivedTable).toBeDefined();

    const indexNames = archivedTable!.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('quadrant');
    expect(indexNames).toContain('completed');
    expect(indexNames).toContain('completedAt');
  });

  it('should insert and retrieve a task with all v13 fields', async () => {
    const task: TaskRecord = {
      id: 'v13-full-task',
      title: 'Full V13 Task',
      description: 'Tests all schema v13 fields',
      urgent: true,
      important: false,
      quadrant: 'urgent-not-important',
      completed: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      recurrence: 'weekly',
      tags: ['work', 'focus'],
      subtasks: [{ id: 'sub-1', title: 'Sub task', completed: false }],
      dependencies: ['other-task-id'],
      notificationEnabled: true,
      notificationSent: false,
      notifyBefore: 30,
      estimatedMinutes: 45,
      timeSpent: 30,
      timeEntries: [
        {
          id: 'entry-1',
          startedAt: '2025-01-01T09:00:00.000Z',
          endedAt: '2025-01-01T09:30:00.000Z',
          notes: 'Morning session',
        },
      ],
    };

    await db.tasks.add(task);
    const retrieved = await db.tasks.get('v13-full-task');

    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('v13-full-task');
    expect(retrieved!.title).toBe('Full V13 Task');
    expect(retrieved!.quadrant).toBe('urgent-not-important');
    expect(retrieved!.recurrence).toBe('weekly');
    expect(retrieved!.tags).toEqual(['work', 'focus']);
    expect(retrieved!.subtasks).toHaveLength(1);
    expect(retrieved!.dependencies).toEqual(['other-task-id']);
    expect(retrieved!.estimatedMinutes).toBe(45);
    expect(retrieved!.timeSpent).toBe(30);
    expect(retrieved!.timeEntries).toHaveLength(1);
    expect(retrieved!.timeEntries![0].notes).toBe('Morning session');
  });

  it('should query tasks by quadrant index', async () => {
    const makeTask = (id: string, quadrant: TaskRecord['quadrant']): TaskRecord => ({
      id,
      title: `Task ${id}`,
      description: '',
      urgent: quadrant.includes('urgent-important'),
      important: quadrant.includes('important'),
      quadrant,
      completed: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
      notificationSent: false,
    });

    await db.tasks.bulkAdd([
      makeTask('q1', 'urgent-important'),
      makeTask('q2', 'not-urgent-important'),
      makeTask('q3', 'urgent-not-important'),
    ]);

    const q1Tasks = await db.tasks.where('quadrant').equals('urgent-important').toArray();
    expect(q1Tasks).toHaveLength(1);
    expect(q1Tasks[0].id).toBe('q1');

    const q2Tasks = await db.tasks.where('quadrant').equals('not-urgent-important').toArray();
    expect(q2Tasks).toHaveLength(1);
    expect(q2Tasks[0].id).toBe('q2');
  });

  it('should query completed tasks using the completedAt index', async () => {
    const completedTask: TaskRecord = {
      id: 'done-task',
      title: 'Completed Task',
      description: '',
      urgent: false,
      important: false,
      quadrant: 'not-urgent-not-important',
      completed: true,
      completedAt: '2025-06-01T10:00:00.000Z',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-06-01T10:00:00.000Z',
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
      notificationSent: false,
    };

    await db.tasks.add(completedTask);

    const found = await db.tasks
      .where('completedAt')
      .equals('2025-06-01T10:00:00.000Z')
      .toArray();
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('done-task');
  });

  it('should store and retrieve syncMetadata records', async () => {
    const syncConfig = {
      key: 'sync_config' as const,
      enabled: false,
      userId: null,
      deviceId: 'test-device-id',
      deviceName: 'Test Device',
      email: null,
      provider: null,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 2,
    };

    await db.syncMetadata.add(syncConfig);
    const retrieved = await db.syncMetadata.get('sync_config');

    expect(retrieved).toBeDefined();
    expect((retrieved as typeof syncConfig).deviceId).toBe('test-device-id');
    expect((retrieved as typeof syncConfig).enabled).toBe(false);
  });

  it('should support tag index for multi-value tag queries', async () => {
    const taggedTask: TaskRecord = {
      id: 'tagged-task',
      title: 'Tagged Task',
      description: '',
      urgent: false,
      important: true,
      quadrant: 'not-urgent-important',
      completed: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      recurrence: 'none',
      tags: ['alpha', 'beta'],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
      notificationSent: false,
    };

    await db.tasks.add(taggedTask);

    const byAlpha = await db.tasks.where('tags').equals('alpha').toArray();
    expect(byAlpha).toHaveLength(1);
    expect(byAlpha[0].id).toBe('tagged-task');

    const byBeta = await db.tasks.where('tags').equals('beta').toArray();
    expect(byBeta).toHaveLength(1);
  });
});
