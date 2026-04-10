/**
 * Additional database coverage tests
 * Targets: getDb() singleton behavior, appPreferences table, deviceInfo table,
 * and notification settings table — all underexercised in existing db.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db';

describe('Database - Additional Coverage', () => {
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    await db.appPreferences.clear();
    await db.deviceInfo.clear();
    await db.notificationSettings.clear();
  });

  afterEach(async () => {
    await db.appPreferences.clear();
    await db.deviceInfo.clear();
    await db.notificationSettings.clear();
  });

  describe('appPreferences table', () => {
    it('should create the appPreferences table', () => {
      const tableNames = db.tables.map(t => t.name);
      expect(tableNames).toContain('appPreferences');
    });

    it('should store and retrieve app preferences', async () => {
      const prefs = {
        id: 'preferences',
        pinnedSmartViewIds: ['view-1', 'view-2'],
        maxPinnedViews: 5,
      };

      await db.appPreferences.put(prefs);

      const retrieved = await db.appPreferences.get('preferences');
      expect(retrieved).toBeDefined();
      expect(retrieved?.pinnedSmartViewIds).toEqual(['view-1', 'view-2']);
      expect(retrieved?.maxPinnedViews).toBe(5);
    });

    it('should update existing app preferences', async () => {
      await db.appPreferences.put({
        id: 'preferences',
        pinnedSmartViewIds: [],
        maxPinnedViews: 5,
      });

      await db.appPreferences.update('preferences', {
        pinnedSmartViewIds: ['view-1'],
      });

      const updated = await db.appPreferences.get('preferences');
      expect(updated?.pinnedSmartViewIds).toEqual(['view-1']);
    });
  });

  describe('deviceInfo table', () => {
    it('should create the deviceInfo table', () => {
      const tableNames = db.tables.map(t => t.name);
      expect(tableNames).toContain('deviceInfo');
    });

    it('should store and retrieve device info', async () => {
      const deviceInfo = {
        key: 'device_info',
        deviceId: 'test-device-123',
        deviceName: 'Test Device',
        createdAt: new Date().toISOString(),
      };

      await db.deviceInfo.put(deviceInfo);

      const retrieved = await db.deviceInfo.get('device_info');
      expect(retrieved).toBeDefined();
      expect(retrieved?.deviceId).toBe('test-device-123');
      expect(retrieved?.deviceName).toBe('Test Device');
    });
  });

  describe('notificationSettings table', () => {
    it('should create the notificationSettings table', () => {
      const tableNames = db.tables.map(t => t.name);
      expect(tableNames).toContain('notificationSettings');
    });

    it('should store and retrieve notification settings', async () => {
      const settings = {
        id: 'settings',
        enabled: true,
        permission: 'granted' as const,
        defaultNotifyBefore: 15,
      };

      await db.notificationSettings.put(settings);

      const retrieved = await db.notificationSettings.get('settings');
      expect(retrieved).toBeDefined();
      expect(retrieved?.enabled).toBe(true);
    });
  });

  describe('getDb singleton', () => {
    it('returns the same instance on multiple calls', () => {
      const db1 = getDb();
      const db2 = getDb();
      const db3 = getDb();

      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
    });

    it('returns a Dexie instance with version 13', () => {
      const instance = getDb();
      expect(instance.verno).toBe(13);
    });
  });

  describe('cross-table operations', () => {
    it('should move a task to archivedTasks in a transaction', async () => {
      const task = {
        id: 'task-to-archive',
        title: 'Archive Me',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important' as const,
        completed: true,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none' as const,
        tags: [],
        subtasks: [],
        dependencies: [],
        notificationEnabled: true,
        notificationSent: false,
      };

      await db.tasks.add(task);

      await db.transaction('rw', [db.tasks, db.archivedTasks], async () => {
        const archivedTask = {
          ...task,
          archivedAt: new Date().toISOString(),
        };
        await db.archivedTasks.add(archivedTask);
        await db.tasks.delete(task.id);
      });

      const inTasks = await db.tasks.get('task-to-archive');
      const inArchive = await db.archivedTasks.get('task-to-archive');

      expect(inTasks).toBeUndefined();
      expect(inArchive).toBeDefined();
      expect(inArchive?.title).toBe('Archive Me');
      expect(inArchive?.archivedAt).toBeDefined();

      // Cleanup
      await db.archivedTasks.clear();
      await db.tasks.clear();
    });
  });
});
