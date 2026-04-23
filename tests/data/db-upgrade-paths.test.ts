/**
 * Tests for lib/db.ts upgrade callbacks (v2 → v13).
 *
 * Strategy: seed a raw Dexie database at an older version, then reset the
 * module cache and re-import `getDb()` to force the full v1→v13 upgrade chain.
 * fake-indexeddb persists across module resets, so each test deletes the
 * "GsdTaskManager" IDB first to get a clean slate.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Dexie from 'dexie';

const DB_NAME = 'GsdTaskManager';

async function deleteDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function seedAtVersion(version: number, seed: (db: Dexie) => Promise<void>, stores: Record<number, Record<string, string>>): Promise<void> {
  const legacy = new Dexie(DB_NAME);
  for (const [v, store] of Object.entries(stores)) {
    legacy.version(Number(v)).stores(store);
  }
  await legacy.open();
  expect(legacy.verno).toBe(version);
  await seed(legacy);
  legacy.close();
}

async function openCurrentDb() {
  vi.resetModules();
  const { getDb } = await import('@/lib/db');
  return getDb();
}

describe('db upgrade callbacks', () => {
  beforeEach(async () => {
    await deleteDb();
    vi.resetModules();
  });

  it('v2 upgrade: should backfill recurrence, tags, and subtasks defaults', async () => {
    await seedAtVersion(1, async (legacy) => {
      // v1 task shape — no recurrence/tags/subtasks
      await legacy.table('tasks').add({
        id: 'legacy-v1',
        title: 'Legacy',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
    });

    const db = await openCurrentDb();
    const migrated = await db.tasks.get('legacy-v1');
    expect(migrated).toBeDefined();
    expect(migrated!.recurrence).toBe('none');
    expect(migrated!.tags).toEqual([]);
    expect(migrated!.subtasks).toEqual([]);
  });

  it('v5 upgrade: should backfill notification defaults', async () => {
    await seedAtVersion(4, async (legacy) => {
      await legacy.table('tasks').add({
        id: 'legacy-v4',
        title: 'No Notif Fields',
        description: '',
        urgent: false,
        important: true,
        quadrant: 'not-urgent-important',
        completed: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        recurrence: 'none',
        tags: [],
        subtasks: [],
      });
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
      2: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags' },
      3: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]' },
      4: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]', smartViews: 'id, name, isBuiltIn, createdAt' },
    });

    const db = await openCurrentDb();
    const migrated = await db.tasks.get('legacy-v4');
    expect(migrated).toBeDefined();
    expect(migrated!.notificationEnabled).toBe(true);
    expect(migrated!.notificationSent).toBe(false);
  });

  it('v6 upgrade: should backfill dependencies as empty array', async () => {
    await seedAtVersion(5, async (legacy) => {
      await legacy.table('tasks').add({
        id: 'no-deps',
        title: 'No Deps',
        description: '',
        urgent: false,
        important: false,
        quadrant: 'not-urgent-not-important',
        completed: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        recurrence: 'none',
        tags: [],
        subtasks: [],
        notificationEnabled: true,
        notificationSent: false,
      });
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
      2: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags' },
      3: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]' },
      4: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]', smartViews: 'id, name, isBuiltIn, createdAt' },
      5: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
    });

    const db = await openCurrentDb();
    const migrated = await db.tasks.get('no-deps');
    expect(migrated).toBeDefined();
    expect(migrated!.dependencies).toEqual([]);
  });

  it('v8 upgrade: should backfill completedAt from updatedAt for completed tasks', async () => {
    await seedAtVersion(7, async (legacy) => {
      await legacy.table('tasks').add({
        id: 'completed-pre-v8',
        title: 'Done Old',
        description: '',
        urgent: false,
        important: false,
        quadrant: 'not-urgent-not-important',
        completed: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-06-01T00:00:00.000Z',
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        notificationEnabled: false,
        notificationSent: false,
      });
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
      2: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags' },
      3: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]' },
      4: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]', smartViews: 'id, name, isBuiltIn, createdAt' },
      5: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      6: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      7: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
    });

    const db = await openCurrentDb();
    const migrated = await db.tasks.get('completed-pre-v8');
    expect(migrated).toBeDefined();
    expect(migrated!.completedAt).toBe('2025-06-01T00:00:00.000Z');
  });

  it('v11 upgrade: should initialise default appPreferences row', async () => {
    await seedAtVersion(10, async () => {
      // No seeding needed — migration creates defaults.
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
      2: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags' },
      3: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]' },
      4: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]', smartViews: 'id, name, isBuiltIn, createdAt' },
      5: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      6: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      7: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
      8: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
      9: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
      },
      10: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
        syncHistory: 'id, timestamp, status, deviceId',
      },
    });

    const db = await openCurrentDb();
    const prefs = await db.appPreferences.get('preferences');
    expect(prefs).toBeDefined();
    expect(prefs!.pinnedSmartViewIds).toEqual([]);
    expect(prefs!.maxPinnedViews).toBe(5);
  });

  it('v12 upgrade: should initialise time-tracking fields and reset corrupt data', async () => {
    await seedAtVersion(11, async (legacy) => {
      await legacy.table('tasks').bulkAdd([
        {
          id: 'no-time',
          title: 'No Time Fields',
          description: '',
          urgent: false,
          important: false,
          quadrant: 'not-urgent-not-important',
          completed: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
        },
        {
          id: 'corrupt-time',
          title: 'Corrupt Time Data',
          description: '',
          urgent: false,
          important: false,
          quadrant: 'not-urgent-not-important',
          completed: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
          timeEntries: 'not-an-array',
          timeSpent: -5,
        },
        {
          id: 'mixed-entries',
          title: 'Mixed valid/invalid time entries',
          description: '',
          urgent: false,
          important: false,
          quadrant: 'not-urgent-not-important',
          completed: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: false,
          notificationSent: false,
          timeEntries: [
            { id: 'ok', startedAt: '2025-01-01T00:00:00.000Z' },
            { id: 42, startedAt: 'bad' },
            null,
          ],
          timeSpent: Number.NaN,
        },
      ]);
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
      2: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags' },
      3: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]' },
      4: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]', smartViews: 'id, name, isBuiltIn, createdAt' },
      5: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      6: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      7: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
      8: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
      9: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
      },
      10: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
        syncHistory: 'id, timestamp, status, deviceId',
      },
      11: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
        syncHistory: 'id, timestamp, status, deviceId',
        appPreferences: 'id',
      },
    });

    const db = await openCurrentDb();

    const noTime = await db.tasks.get('no-time');
    expect(noTime!.timeEntries).toEqual([]);
    expect(noTime!.timeSpent).toBe(0);

    const corrupt = await db.tasks.get('corrupt-time');
    expect(corrupt!.timeEntries).toEqual([]);
    expect(corrupt!.timeSpent).toBe(0);

    const mixed = await db.tasks.get('mixed-entries');
    expect(mixed!.timeEntries).toHaveLength(1);
    expect(mixed!.timeEntries![0].id).toBe('ok');
    expect(mixed!.timeSpent).toBe(0);
  });

  it('v13 upgrade: should reset sync state, strip vectorClock, and remove encryption_salt', async () => {
    await seedAtVersion(12, async (legacy) => {
      // Seed a task with the legacy vectorClock field.
      await legacy.table('tasks').add({
        id: 'vc-task',
        title: 'Has Vector Clock',
        description: '',
        urgent: false,
        important: false,
        quadrant: 'not-urgent-not-important',
        completed: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        notificationEnabled: false,
        notificationSent: false,
        timeEntries: [],
        timeSpent: 0,
        vectorClock: { 'device-a': 1, 'device-b': 2 },
      });

      await legacy.table('archivedTasks').add({
        id: 'archived-vc',
        title: 'Archived With VC',
        description: '',
        urgent: false,
        important: false,
        quadrant: 'not-urgent-not-important',
        completed: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-02T00:00:00.000Z',
        archivedAt: '2025-01-03T00:00:00.000Z',
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        notificationEnabled: false,
        notificationSent: false,
        timeEntries: [],
        timeSpent: 0,
        vectorClock: { 'device-a': 5 },
      });

      // Seed sync state that should be reset.
      await legacy.table('syncQueue').add({
        id: 'queue-1',
        taskId: 'vc-task',
        operation: 'update',
        timestamp: 123,
        retryCount: 0,
      });

      await legacy.table('syncMetadata').put({
        key: 'sync_config',
        enabled: true,
        userId: 'legacy-user',
        deviceId: 'preserved-device-id',
        deviceName: 'Legacy Device',
        email: 'legacy@example.com',
        token: 'legacy-token',
        tokenExpiresAt: 9999999999,
        lastSyncAt: 1000,
        vectorClock: { 'device-a': 1 },
        conflictStrategy: 'last_write_wins',
        serverUrl: 'https://old-server.example.com',
      });

      await legacy.table('syncMetadata').put({
        key: 'encryption_salt',
        salt: 'legacy-salt-value',
      });
    }, {
      1: { tasks: 'id, quadrant, completed, dueDate' },
      2: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags' },
      3: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]' },
      4: { tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]', smartViews: 'id, name, isBuiltIn, createdAt' },
      5: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      6: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
      },
      7: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
      8: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
      },
      9: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
      },
      10: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
        syncHistory: 'id, timestamp, status, deviceId',
      },
      11: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
        syncHistory: 'id, timestamp, status, deviceId',
        appPreferences: 'id',
      },
      12: {
        tasks: 'id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt',
        archivedTasks: 'id, quadrant, completed, dueDate, completedAt, archivedAt',
        smartViews: 'id, name, isBuiltIn, createdAt',
        notificationSettings: 'id',
        syncQueue: 'id, taskId, operation, timestamp, retryCount',
        syncMetadata: 'key',
        deviceInfo: 'key',
        archiveSettings: 'id',
        syncHistory: 'id, timestamp, status, deviceId',
        appPreferences: 'id',
      },
    });

    const db = await openCurrentDb();

    // vectorClock stripped from both tables.
    const task = await db.tasks.get('vc-task');
    expect(task).toBeDefined();
    expect((task as Record<string, unknown>).vectorClock).toBeUndefined();

    const archived = await db.archivedTasks.get('archived-vc');
    expect(archived).toBeDefined();
    expect((archived as Record<string, unknown>).vectorClock).toBeUndefined();

    // syncQueue cleared.
    const queueSize = await db.syncQueue.count();
    expect(queueSize).toBe(0);

    // encryption_salt removed.
    const salt = await db.syncMetadata.get('encryption_salt');
    expect(salt).toBeUndefined();

    // sync_config reset but deviceId preserved.
    const config = await db.syncMetadata.get('sync_config') as {
      enabled: boolean;
      userId: string | null;
      deviceId: string;
      token?: unknown;
      autoSyncEnabled: boolean;
      consecutiveFailures: number;
    };
    expect(config).toBeDefined();
    expect(config.enabled).toBe(false);
    expect(config.userId).toBeNull();
    expect(config.deviceId).toBe('preserved-device-id');
    expect(config.autoSyncEnabled).toBe(true);
    expect(config.consecutiveFailures).toBe(0);
    expect(config.token).toBeUndefined();
  });
});

describe('getDb() environment guard', () => {
  beforeEach(async () => {
    await deleteDb();
    vi.resetModules();
  });

  it('should throw when indexedDB is not available', async () => {
    const originalIDB = globalThis.indexedDB;
    // Simulate a server environment by removing indexedDB before first call.
    // @ts-expect-error — deliberately removing for the guard path.
    delete globalThis.indexedDB;

    try {
      const { getDb } = await import('@/lib/db');
      expect(() => getDb()).toThrow(/IndexedDB is not available/);
    } finally {
      globalThis.indexedDB = originalIDB;
    }
  });
});
