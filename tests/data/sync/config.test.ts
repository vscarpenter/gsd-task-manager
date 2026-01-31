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
import type { SyncConfig } from '@/lib/sync/types';

// Mock dependencies - shared objects so we can spy on methods
const mockCrypto = {
  deriveKey: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn(),
};

vi.mock('@/lib/sync/crypto', () => ({
  getCryptoManager: vi.fn(() => mockCrypto),
}));

const mockApiClient = {
  setToken: vi.fn(),
};

vi.mock('@/lib/sync/api-client', () => ({
  getApiClient: vi.fn(() => mockApiClient),
}));

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

describe('Sync Config', () => {
  let db: ReturnType<typeof getDb>;
  const mockSyncConfig: SyncConfig = {
    key: 'sync_config',
    enabled: false,
    userId: null,
    deviceId: 'device-123',
    deviceName: 'Test Device',
    email: null,
    token: null,
    tokenExpiresAt: null,
    lastSyncAt: null,
    vectorClock: {},
    conflictStrategy: 'last_write_wins',
    serverUrl: 'https://test-api.example.com',
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

    it('should auto-create config if it does not exist', async () => {
      await db.syncMetadata.clear();

      const config = await getSyncConfig();

      // Config should be auto-created by ensureSyncConfigInitialized()
      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(false);
      expect(config?.deviceId).toBeDefined();
    });

    it('should migrate legacy config', async () => {
      // This test ensures backward compatibility with old config formats
      const legacyConfig = {
        ...mockSyncConfig,
        // Add any legacy fields that might need migration
      };

      await db.syncMetadata.put(legacyConfig);

      const config = await getSyncConfig();

      expect(config).not.toBeNull();
      expect(config?.key).toBe('sync_config');
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

    it('should auto-create config and update it', async () => {
      await db.syncMetadata.clear();

      // updateSyncConfig calls getSyncConfig which auto-initializes
      await updateSyncConfig({ enabled: true });

      const config = await getSyncConfig();
      expect(config?.enabled).toBe(true);
    });

    it('should update vector clock', async () => {
      const newVectorClock = { 'device-123': 5, 'device-456': 3 };

      await updateSyncConfig({
        vectorClock: newVectorClock,
      });

      const updated = await getSyncConfig();

      expect(updated?.vectorClock).toEqual(newVectorClock);
    });

    it('should update lastSyncAt timestamp', async () => {
      const timestamp = Date.now();

      await updateSyncConfig({
        lastSyncAt: timestamp,
      });

      const updated = await getSyncConfig();

      expect(updated?.lastSyncAt).toBe(timestamp);
    });
  });

  describe('enableSync', () => {
    it('should enable sync with auth credentials', async () => {
      const userId = 'user-789';
      const email = 'test@example.com';
      const token = 'test-token-123';
      const expiresAt = Date.now() + 86400000;
      const salt = 'test-salt';
      const password = 'password123';

      await enableSync(userId, email, token, expiresAt, salt, password);

      const config = await getSyncConfig();

      expect(config?.enabled).toBe(true);
      expect(config?.userId).toBe(userId);
      expect(config?.email).toBe(email);
      expect(config?.token).toBe(token);
      expect(config?.tokenExpiresAt).toBe(expiresAt);
    });

    it('should initialize crypto with password and salt', async () => {
      const { getCryptoManager } = await import('@/lib/sync/crypto');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockCrypto = (getCryptoManager as any)();

      await enableSync(
        'user-123',
        'test@example.com',
        'token',
        Date.now() + 86400000,
        'salt',
        'password'
      );

      expect(mockCrypto.deriveKey).toHaveBeenCalledWith('password', 'salt');
    });

    it('should set token in API client', async () => {
      const token = 'test-token-456';

      await enableSync(
        'user-123',
        'test@example.com',
        token,
        Date.now() + 86400000,
        'salt',
        'password'
      );

      expect(mockApiClient.setToken).toHaveBeenCalledWith(token);
    });

    it('should queue existing tasks when tasks exist', async () => {
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
          createdAt: Date.now(),
          updatedAt: Date.now(),
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
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
        },
      ]);

      const { getSyncQueue } = await import('@/lib/sync/queue');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockQueue = (getSyncQueue as any)();

      await enableSync(
        'user-123',
        'test@example.com',
        'token',
        Date.now() + 86400000,
        'salt',
        'password'
      );

      expect(mockQueue.populateFromExistingTasks).toHaveBeenCalled();
    });

    it('should start health monitor', async () => {
      const { getHealthMonitor } = await import('@/lib/sync/health-monitor');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockMonitor = (getHealthMonitor as any)();

      await enableSync(
        'user-123',
        'test@example.com',
        'token',
        Date.now() + 86400000,
        'salt',
        'password'
      );

      expect(mockMonitor.start).toHaveBeenCalled();
    });

    it('should work with auto-created config', async () => {
      await db.syncMetadata.clear();

      // enableSync calls getSyncConfig which auto-initializes
      await enableSync(
        'user-123',
        'test@example.com',
        'token',
        Date.now() + 86400000,
        'salt',
        'password'
      );

      const config = await getSyncConfig();
      expect(config?.enabled).toBe(true);
      expect(config?.userId).toBe('user-123');
    });
  });

  describe('disableSync', () => {
    beforeEach(async () => {
      // Set up enabled sync
      await updateSyncConfig({
        enabled: true,
        userId: 'user-123',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: Date.now() + 86400000,
      });

      // Add some queue items
      await db.syncQueue.add({
        id: 'queue-1',
        taskId: 'task-1',
        operation: 'create',
        timestamp: Date.now(),
        retryCount: 0,
        payload: null,
        vectorClock: {},
      });
    });

    it('should disable sync and clear credentials', async () => {
      await disableSync();

      const config = await getSyncConfig();

      expect(config?.enabled).toBe(false);
      expect(config?.userId).toBeNull();
      expect(config?.email).toBeNull();
      expect(config?.token).toBeNull();
      expect(config?.tokenExpiresAt).toBeNull();
      expect(config?.lastSyncAt).toBeNull();
      expect(config?.vectorClock).toEqual({});
    });

    it('should clear sync queue', async () => {
      const queueCountBefore = await db.syncQueue.count();
      expect(queueCountBefore).toBeGreaterThan(0);

      await disableSync();

      const queueCountAfter = await db.syncQueue.count();
      expect(queueCountAfter).toBe(0);
    });

    it('should stop health monitor', async () => {
      const { getHealthMonitor } = await import('@/lib/sync/health-monitor');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockMonitor = (getHealthMonitor as any)();
      mockMonitor.isActive.mockReturnValue(true);

      await disableSync();

      expect(mockMonitor.stop).toHaveBeenCalled();
    });

    it('should clear crypto manager', async () => {
      const { getCryptoManager } = await import('@/lib/sync/crypto');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockCrypto = (getCryptoManager as any)();

      await disableSync();

      expect(mockCrypto.clear).toHaveBeenCalled();
    });

    it('should handle disabling when config does not exist', async () => {
      await db.syncMetadata.clear();

      // Should not throw
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
        lastSyncAt: 1234567890,
      });

      await db.syncQueue.add({
        id: 'queue-1',
        taskId: 'task-1',
        operation: 'create',
        timestamp: Date.now(),
        retryCount: 0,
        payload: null,
        vectorClock: {},
      });

      const status = await getSyncStatus();

      expect(status.enabled).toBe(true);
      expect(status.email).toBe('test@example.com');
      expect(status.lastSyncAt).toBe(1234567890);
      expect(status.pendingCount).toBe(1);
      expect(status.deviceId).toBe('device-123');
      expect(status.serverUrl).toBe('https://test-api.example.com');
    });

    it('should return default values when sync not enabled', async () => {
      // Don't clear syncMetadata - just use the default config from beforeEach
      const status = await getSyncStatus();

      expect(status.enabled).toBe(false);
      expect(status.email).toBeNull();
      expect(status.lastSyncAt).toBeNull();
      expect(status.deviceId).toBeDefined(); // Auto-created by DB migration
      expect(status.serverUrl).toBeDefined(); // Auto-created by DB migration
    });

    it('should include pending operation count', async () => {
      // Add multiple queue items
      await db.syncQueue.bulkAdd([
        {
          id: 'queue-1',
          taskId: 'task-1',
          operation: 'create',
          timestamp: Date.now(),
          retryCount: 0,
          payload: null,
          vectorClock: {},
        },
        {
          id: 'queue-2',
          taskId: 'task-2',
          operation: 'update',
          timestamp: Date.now(),
          retryCount: 0,
          payload: null,
          vectorClock: {},
        },
        {
          id: 'queue-3',
          taskId: 'task-3',
          operation: 'delete',
          timestamp: Date.now(),
          retryCount: 0,
          payload: null,
          vectorClock: {},
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
        token: 'test-token',
        lastSyncAt: Date.now() - 3600000,
        vectorClock: { 'device-123': 10, 'device-456': 5 },
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
          createdAt: Date.now(),
          updatedAt: Date.now(),
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
        vectorClock: {},
      });
    });

    it('should reset sync metadata and clear local data', async () => {
      await resetAndFullSync();

      const config = await getSyncConfig();

      expect(config?.lastSyncAt).toBe(0);
      expect(config?.vectorClock).toEqual({});

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
      expect(config?.token).toBe('test-token');
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
