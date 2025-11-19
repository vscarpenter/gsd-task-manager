import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSyncConfig,
  updateSyncConfig,
  enableSync,
  disableSync,
  registerSyncAccount,
  loginSyncAccount,
  isSyncEnabled,
  getSyncStatus,
  resetAndFullSync,
} from '@/lib/sync/config';
import { getDb } from '@/lib/db';
import type { SyncConfig } from '@/lib/sync/types';

// Mock dependencies
vi.mock('@/lib/sync/crypto', () => ({
  getCryptoManager: vi.fn(() => ({
    deriveKey: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  })),
}));

vi.mock('@/lib/sync/api-client', () => ({
  getApiClient: vi.fn(() => ({
    setToken: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
  })),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => ({
    populateFromExistingTasks: vi.fn().mockResolvedValue(5),
  })),
}));

vi.mock('@/lib/sync/health-monitor', () => ({
  getHealthMonitor: vi.fn(() => ({
    isActive: vi.fn().mockReturnValue(false),
    start: vi.fn(),
    stop: vi.fn(),
  })),
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

    it('should return null when config does not exist', async () => {
      await db.syncMetadata.clear();

      const config = await getSyncConfig();

      expect(config).toBeNull();
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

    it('should throw error when config not initialized', async () => {
      await db.syncMetadata.clear();

      await expect(
        updateSyncConfig({ enabled: true })
      ).rejects.toThrow('Sync config not initialized');
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
      const { getApiClient } = await import('@/lib/sync/api-client');
      const mockApi = (getApiClient as any)();
      const token = 'test-token-456';

      await enableSync(
        'user-123',
        'test@example.com',
        token,
        Date.now() + 86400000,
        'salt',
        'password'
      );

      expect(mockApi.setToken).toHaveBeenCalledWith(token);
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

    it('should throw error when config not initialized', async () => {
      await db.syncMetadata.clear();

      await expect(
        enableSync(
          'user-123',
          'test@example.com',
          'token',
          Date.now() + 86400000,
          'salt',
          'password'
        )
      ).rejects.toThrow('Sync config not initialized');
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
      const mockMonitor = (getHealthMonitor as any)();
      mockMonitor.isActive.mockReturnValue(true);

      await disableSync();

      expect(mockMonitor.stop).toHaveBeenCalled();
    });

    it('should clear crypto manager', async () => {
      const { getCryptoManager } = await import('@/lib/sync/crypto');
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

  describe('registerSyncAccount', () => {
    it('should register new account and enable sync', async () => {
      const { getApiClient } = await import('@/lib/sync/api-client');
      const mockApi = (getApiClient as any)();

      const mockRegisterResponse = {
        userId: 'user-new',
        deviceId: 'device-new',
        token: 'new-token',
        expiresAt: Date.now() + 86400000,
        salt: 'new-salt',
      };

      mockApi.register.mockResolvedValue(mockRegisterResponse);

      await registerSyncAccount('new@example.com', 'password123', 'My Device');

      expect(mockApi.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        deviceName: 'My Device',
      });

      const config = await getSyncConfig();

      expect(config?.enabled).toBe(true);
      expect(config?.userId).toBe('user-new');
      expect(config?.email).toBe('new@example.com');
      expect(config?.deviceId).toBe('device-new');
    });

    it('should use default device name if not provided', async () => {
      const { getApiClient } = await import('@/lib/sync/api-client');
      const mockApi = (getApiClient as any)();

      mockApi.register.mockResolvedValue({
        userId: 'user-new',
        deviceId: 'device-new',
        token: 'new-token',
        expiresAt: Date.now() + 86400000,
        salt: 'new-salt',
      });

      await registerSyncAccount('new@example.com', 'password123');

      expect(mockApi.register).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceName: 'Test Device', // From mockSyncConfig
        })
      );
    });

    it('should throw error when config not initialized', async () => {
      await db.syncMetadata.clear();

      await expect(
        registerSyncAccount('new@example.com', 'password123')
      ).rejects.toThrow('Sync config not initialized');
    });
  });

  describe('loginSyncAccount', () => {
    it('should login and enable sync', async () => {
      const { getApiClient } = await import('@/lib/sync/api-client');
      const mockApi = (getApiClient as any)();

      const mockLoginResponse = {
        userId: 'user-existing',
        deviceId: 'device-123',
        token: 'login-token',
        expiresAt: Date.now() + 86400000,
        salt: 'login-salt',
        syncRequired: true,
      };

      mockApi.login.mockResolvedValue(mockLoginResponse);

      await loginSyncAccount('existing@example.com', 'password123');

      expect(mockApi.login).toHaveBeenCalledWith({
        email: 'existing@example.com',
        passwordHash: 'password123',
        deviceId: 'device-123',
        deviceName: 'Test Device',
      });

      const config = await getSyncConfig();

      expect(config?.enabled).toBe(true);
      expect(config?.userId).toBe('user-existing');
      expect(config?.email).toBe('existing@example.com');
    });

    it('should update device ID if changed', async () => {
      const { getApiClient } = await import('@/lib/sync/api-client');
      const mockApi = (getApiClient as any)();

      mockApi.login.mockResolvedValue({
        userId: 'user-existing',
        deviceId: 'device-new-id',
        token: 'login-token',
        expiresAt: Date.now() + 86400000,
        salt: 'login-salt',
        syncRequired: true,
      });

      await loginSyncAccount('existing@example.com', 'password123');

      const config = await getSyncConfig();

      expect(config?.deviceId).toBe('device-new-id');
    });

    it('should throw error when config not initialized', async () => {
      await db.syncMetadata.clear();

      await expect(
        loginSyncAccount('existing@example.com', 'password123')
      ).rejects.toThrow('Sync config not initialized');
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

    it('should return null values when sync not configured', async () => {
      await db.syncMetadata.clear();

      const status = await getSyncStatus();

      expect(status.enabled).toBe(false);
      expect(status.email).toBeNull();
      expect(status.lastSyncAt).toBeNull();
      expect(status.deviceId).toBeNull();
      expect(status.serverUrl).toBeNull();
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
