import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSyncConfig,
  updateSyncConfig,
  enableSync,
  disableSync,
  isSyncEnabled,
  getSyncStatus,
  resetAndFullSync,
} from '@/lib/sync/config';
import { getDb } from '@/lib/db';
import type { PBSyncConfig } from '@/lib/sync/types';

// Mock dependencies

const mockQueue = {
  populateFromExistingTasks: vi.fn().mockResolvedValue(5),
};

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => mockQueue),
}));

const mockMonitor = {
  isActive: vi.fn().mockReturnValue(false),
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock('@/lib/sync/health-monitor', () => ({
  getHealthMonitor: vi.fn(() => mockMonitor),
}));

vi.mock('@/lib/sync/pocketbase-client', () => ({
  clearPocketBase: vi.fn(),
}));

describe('Sync Config', () => {
  let db: ReturnType<typeof getDb>;
  const mockSyncConfig: PBSyncConfig = {
    key: 'sync_config',
    enabled: false,
    userId: null,
    deviceId: 'device-123',
    deviceName: 'Test Device',
    email: null,
    provider: null,
    lastSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
  };

  beforeEach(async () => {
    db = getDb();
    await db.syncMetadata.clear();
    await db.tasks.clear();
    await db.syncQueue.clear();

    // Initialize default config
    await db.syncMetadata.put(mockSyncConfig);
  });

  afterEach(async () => {
    await db.syncMetadata.clear();
    await db.tasks.clear();
    await db.syncQueue.clear();
    vi.clearAllMocks();
  });

  describe('getSyncConfig', () => {
    it('should return sync config when it exists', async () => {
      const config = await getSyncConfig();

      expect(config).not.toBeNull();
      expect(config?.deviceId).toBe('device-123');
      expect(config?.deviceName).toBe('Test Device');
    });

    it('should return null when config does not exist', async () => {
      await db.syncMetadata.clear();

      const config = await getSyncConfig();

      expect(config).toBeNull();
    });
  });

  describe('updateSyncConfig', () => {
    it('should update sync config with partial updates', async () => {
      await updateSyncConfig({
        enabled: true,
        userId: 'user-456',
        email: 'test@example.com',
      });

      const updated = await getSyncConfig();

      expect(updated?.enabled).toBe(true);
      expect(updated?.userId).toBe('user-456');
      expect(updated?.email).toBe('test@example.com');
      expect(updated?.deviceId).toBe('device-123'); // Original value preserved
    });

    it('should throw when config does not exist', async () => {
      await db.syncMetadata.clear();

      await expect(updateSyncConfig({ enabled: true })).rejects.toThrow(
        'Sync config not initialized'
      );
    });

    it('should update lastSyncAt timestamp', async () => {
      const timestamp = '2026-01-15T10:00:00.000Z';

      await updateSyncConfig({
        lastSyncAt: timestamp,
      });

      const updated = await getSyncConfig();

      expect(updated?.lastSyncAt).toBe(timestamp);
    });

    it('should update provider field', async () => {
      await updateSyncConfig({
        provider: 'google',
      });

      const updated = await getSyncConfig();

      expect(updated?.provider).toBe('google');
    });

    it('should update auto-sync configuration', async () => {
      await updateSyncConfig({
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 5,
      });

      const updated = await getSyncConfig();

      expect(updated?.autoSyncEnabled).toBe(true);
      expect(updated?.autoSyncIntervalMinutes).toBe(5);
    });
  });

  describe('enableSync', () => {
    it('should queue existing tasks for initial sync', async () => {
      // Add some tasks
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
      ]);

      await enableSync();

      expect(mockQueue.populateFromExistingTasks).toHaveBeenCalled();
    });

    it('should start health monitor', async () => {
      await enableSync();

      expect(mockMonitor.start).toHaveBeenCalled();
    });

    it('should not start health monitor if already active', async () => {
      mockMonitor.isActive.mockReturnValue(true);

      await enableSync();

      expect(mockMonitor.start).not.toHaveBeenCalled();
    });
  });

  describe('disableSync', () => {
    beforeEach(async () => {
      // Set up enabled sync
      await updateSyncConfig({
        enabled: true,
        userId: 'user-123',
        email: 'test@example.com',
        provider: 'google',
      });

      // Add a queue item
      await db.syncQueue.add({
        id: 'queue-1',
        taskId: 'task-1',
        operation: 'create',
        timestamp: Date.now(),
        retryCount: 0,
        payload: null,
      });
    });

    it('should disable sync and clear user fields', async () => {
      await disableSync();

      const config = await getSyncConfig();

      expect(config?.enabled).toBe(false);
      expect(config?.userId).toBeNull();
      expect(config?.email).toBeNull();
      expect(config?.provider).toBeNull();
      expect(config?.lastSyncAt).toBeNull();
      expect(config?.consecutiveFailures).toBe(0);
      expect(config?.lastFailureAt).toBeNull();
      expect(config?.lastFailureReason).toBeNull();
      expect(config?.nextRetryAt).toBeNull();
    });

    it('should clear sync queue', async () => {
      const queueCountBefore = await db.syncQueue.count();
      expect(queueCountBefore).toBeGreaterThan(0);

      await disableSync();

      const queueCountAfter = await db.syncQueue.count();
      expect(queueCountAfter).toBe(0);
    });

    it('should stop health monitor when active', async () => {
      mockMonitor.isActive.mockReturnValue(true);

      await disableSync();

      expect(mockMonitor.stop).toHaveBeenCalled();
    });

    it('should call clearPocketBase', async () => {
      const { clearPocketBase } = await import('@/lib/sync/pocketbase-client');

      await disableSync();

      expect(clearPocketBase).toHaveBeenCalled();
    });

    it('should handle disabling when config does not exist', async () => {
      await db.syncMetadata.clear();

      // Should not throw — disableSync returns early when config is null
      await expect(disableSync()).resolves.not.toThrow();
    });
  });

  describe('isSyncEnabled', () => {
    it('should return true when sync is enabled', async () => {
      await updateSyncConfig({ enabled: true });

      const enabled = await isSyncEnabled();

      expect(enabled).toBe(true);
    });

    it('should return false when sync is disabled', async () => {
      const enabled = await isSyncEnabled();

      expect(enabled).toBe(false);
    });

    it('should return false when config does not exist', async () => {
      await db.syncMetadata.clear();

      const enabled = await isSyncEnabled();

      expect(enabled).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status summary', async () => {
      await updateSyncConfig({
        enabled: true,
        email: 'test@example.com',
        lastSyncAt: '2026-01-15T10:00:00.000Z',
      });

      await db.syncQueue.add({
        id: 'queue-1',
        taskId: 'task-1',
        operation: 'create',
        timestamp: Date.now(),
        retryCount: 0,
        payload: null,
      });

      const status = await getSyncStatus();

      expect(status.enabled).toBe(true);
      expect(status.email).toBe('test@example.com');
      expect(status.lastSyncAt).toBe('2026-01-15T10:00:00.000Z');
      expect(status.pendingCount).toBe(1);
      expect(status.deviceId).toBe('device-123');
    });

    it('should return default values when sync not configured', async () => {
      const status = await getSyncStatus();

      expect(status.enabled).toBe(false);
      expect(status.email).toBeNull();
      expect(status.lastSyncAt).toBeNull();
      expect(status.deviceId).toBe('device-123');
    });

    it('should not include serverUrl in status', async () => {
      const status = await getSyncStatus();

      expect(status).not.toHaveProperty('serverUrl');
    });

    it('should include pending operation count', async () => {
      await db.syncQueue.bulkAdd([
        {
          id: 'queue-1',
          taskId: 'task-1',
          operation: 'create',
          timestamp: Date.now(),
          retryCount: 0,
          payload: null,
        },
        {
          id: 'queue-2',
          taskId: 'task-2',
          operation: 'update',
          timestamp: Date.now(),
          retryCount: 0,
          payload: null,
        },
        {
          id: 'queue-3',
          taskId: 'task-3',
          operation: 'delete',
          timestamp: Date.now(),
          retryCount: 0,
          payload: null,
        },
      ]);

      const status = await getSyncStatus();

      expect(status.pendingCount).toBe(3);
    });
  });

  describe('resetAndFullSync', () => {
    beforeEach(async () => {
      // Set up enabled sync with data
      await updateSyncConfig({
        enabled: true,
        userId: 'user-123',
        email: 'test@example.com',
        provider: 'google',
        lastSyncAt: '2026-01-15T08:00:00.000Z',
      });

      // Add tasks
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
        },
      ]);

      // Add queue items
      await db.syncQueue.add({
        id: 'queue-1',
        taskId: 'task-1',
        operation: 'create',
        timestamp: Date.now(),
        retryCount: 0,
        payload: null,
      });
    });

    it('should reset lastSyncAt and clear local data', async () => {
      await resetAndFullSync();

      const config = await getSyncConfig();

      expect(config?.lastSyncAt).toBeNull();

      const taskCount = await db.tasks.count();
      expect(taskCount).toBe(0);

      const queueCount = await db.syncQueue.count();
      expect(queueCount).toBe(0);
    });

    it('should preserve auth credentials', async () => {
      await resetAndFullSync();

      const config = await getSyncConfig();

      expect(config?.enabled).toBe(true);
      expect(config?.userId).toBe('user-123');
      expect(config?.email).toBe('test@example.com');
      expect(config?.provider).toBe('google');
    });

    it('should throw error when sync not enabled', async () => {
      await updateSyncConfig({ enabled: false });

      await expect(resetAndFullSync()).rejects.toThrow('Sync not enabled');
    });

    it('should throw error when config does not exist', async () => {
      await db.syncMetadata.clear();

      await expect(resetAndFullSync()).rejects.toThrow('Sync not enabled');
    });
  });
});
