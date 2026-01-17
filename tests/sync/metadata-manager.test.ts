/**
 * Tests for metadata manager - sync configuration and metadata updates
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import {
  updateSyncMetadata,
  getSyncConfig,
  updateConfig,
  isEnabled,
  getStatus,
  queueExistingTasks,
} from '@/lib/sync/engine/metadata-manager';
import { getSyncQueue } from '@/lib/sync/queue';
import { createMockSyncConfig, createMockTask, mockConsole } from '../fixtures';

describe('MetadataManager', () => {
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    consoleMock.restore();
    await db.delete();
  });

  describe('updateSyncMetadata', () => {
    it('should update last sync timestamp', async () => {
      const config = createMockSyncConfig({ lastSyncAt: null });
      await db.syncMetadata.add(config);

      const syncStartTime = Date.now();
      const serverClock = { 'device-456': 2, 'device-789': 1 };

      await updateSyncMetadata(config, serverClock, syncStartTime);

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.lastSyncAt).toBe(syncStartTime);
    });

    it('should merge vector clocks', async () => {
      const config = createMockSyncConfig({
        vectorClock: { 'device-456': 1, 'device-111': 3 },
      });
      await db.syncMetadata.add(config);

      const syncStartTime = Date.now();
      const serverClock = { 'device-456': 2, 'device-789': 1 };

      await updateSyncMetadata(config, serverClock, syncStartTime);

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.vectorClock).toEqual({
        'device-456': 2, // Server clock wins (higher)
        'device-789': 1, // From server
        'device-111': 3, // Preserved from local
      });
    });

    it('should use sync start time to prevent race conditions', async () => {
      const config = createMockSyncConfig({ lastSyncAt: 1000 });
      await db.syncMetadata.add(config);

      const syncStartTime = 5000;
      const serverClock = { 'device-456': 1 };

      await updateSyncMetadata(config, serverClock, syncStartTime);

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.lastSyncAt).toBe(5000);
    });

    it('should preserve other config fields', async () => {
      const config = createMockSyncConfig({
        userId: 'user-123',
        email: 'test@example.com',
        deviceName: 'Test Device',
        enabled: true,
      });
      await db.syncMetadata.add(config);

      const syncStartTime = Date.now();
      const serverClock = { 'device-456': 1 };

      await updateSyncMetadata(config, serverClock, syncStartTime);

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.userId).toBe('user-123');
      expect(updated?.email).toBe('test@example.com');
      expect(updated?.deviceName).toBe('Test Device');
      expect(updated?.enabled).toBe(true);
    });
  });

  describe('getSyncConfig', () => {
    it('should return sync config when it exists', async () => {
      const config = createMockSyncConfig();
      await db.syncMetadata.add(config);

      const result = await getSyncConfig();

      expect(result).toBeDefined();
      expect(result?.key).toBe('sync_config');
      expect(result?.deviceId).toBe(config.deviceId);
    });

    it('should return null when config does not exist', async () => {
      const result = await getSyncConfig();

      expect(result).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('should update specific config fields', async () => {
      const config = createMockSyncConfig({ enabled: false });
      await db.syncMetadata.add(config);

      await updateConfig({ enabled: true });

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.enabled).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      const config = createMockSyncConfig({
        enabled: false,
        deviceName: 'Old Name',
      });
      await db.syncMetadata.add(config);

      await updateConfig({
        enabled: true,
        deviceName: 'New Name',
        email: 'new@example.com',
      });

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.enabled).toBe(true);
      expect(updated?.deviceName).toBe('New Name');
      expect(updated?.email).toBe('new@example.com');
    });

    it('should preserve unchanged fields', async () => {
      const config = createMockSyncConfig({
        userId: 'user-123',
        deviceId: 'device-456',
        token: 'token-abc',
      });
      await db.syncMetadata.add(config);

      await updateConfig({ enabled: true });

      const updated = await db.syncMetadata.get('sync_config');
      expect(updated?.userId).toBe('user-123');
      expect(updated?.deviceId).toBe('device-456');
      expect(updated?.token).toBe('token-abc');
    });

    it('should throw error when config not initialized', async () => {
      await expect(updateConfig({ enabled: true })).rejects.toThrow(
        'Sync config not initialized'
      );
    });
  });

  describe('isEnabled', () => {
    it('should return true when sync is enabled', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      const result = await isEnabled();

      expect(result).toBe(true);
    });

    it('should return false when sync is disabled', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: false }));

      const result = await isEnabled();

      expect(result).toBe(false);
    });

    it('should return false when config does not exist', async () => {
      const result = await isEnabled();

      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status with all fields when config exists', async () => {
      const config = createMockSyncConfig({
        enabled: true,
        lastSyncAt: 12345,
      });
      await db.syncMetadata.add(config);

      const status = await getStatus(false);

      expect(status.enabled).toBe(true);
      expect(status.lastSyncAt).toBe(12345);
      expect(status.pendingCount).toBe(0);
      expect(status.isRunning).toBe(false);
    });

    it('should return isRunning true when sync is active', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const status = await getStatus(true);

      expect(status.isRunning).toBe(true);
    });

    it('should include pending queue count', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const queue = getSyncQueue();
      await queue.enqueue('create', 'task-1', createMockTask(), {});
      await queue.enqueue('update', 'task-2', createMockTask({ id: 'task-2' }), {});

      const status = await getStatus(false);

      expect(status.pendingCount).toBe(2);
    });

    it('should return default values when config does not exist', async () => {
      const status = await getStatus(false);

      expect(status.enabled).toBe(false);
      expect(status.lastSyncAt).toBeNull();
      expect(status.pendingCount).toBe(0);
      expect(status.isRunning).toBe(false);
    });
  });

  describe('queueExistingTasks', () => {
    it('should queue all existing tasks', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      // Add tasks to database
      await db.tasks.add(createMockTask({ id: 'task-1', title: 'Task 1' }));
      await db.tasks.add(createMockTask({ id: 'task-2', title: 'Task 2' }));
      await db.tasks.add(createMockTask({ id: 'task-3', title: 'Task 3' }));

      const queuedCount = await queueExistingTasks();

      expect(queuedCount).toBe(3);

      const queue = getSyncQueue();
      const pending = await queue.getPending();
      expect(pending).toHaveLength(3);
      
      const taskIds = pending.map(p => p.taskId).sort();
      expect(taskIds).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should skip tasks already in queue', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      // Add tasks to database
      await db.tasks.add(createMockTask({ id: 'task-1' }));
      await db.tasks.add(createMockTask({ id: 'task-2' }));

      // Pre-queue one task
      const queue = getSyncQueue();
      await queue.enqueue('create', 'task-1', createMockTask({ id: 'task-1' }), {});

      const queuedCount = await queueExistingTasks();

      expect(queuedCount).toBe(1); // Only task-2 should be queued

      const pending = await queue.getPending();
      expect(pending).toHaveLength(2); // task-1 (pre-existing) + task-2 (newly queued)
    });

    it('should return 0 when sync is not enabled', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: false }));

      await db.tasks.add(createMockTask({ id: 'task-1' }));

      const queuedCount = await queueExistingTasks();

      expect(queuedCount).toBe(0);

      const queue = getSyncQueue();
      const pending = await queue.getPending();
      expect(pending).toHaveLength(0);
    });

    it('should return 0 when config does not exist', async () => {
      await db.tasks.add(createMockTask({ id: 'task-1' }));

      const queuedCount = await queueExistingTasks();

      expect(queuedCount).toBe(0);
    });

    it('should handle empty task list', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      const queuedCount = await queueExistingTasks();

      expect(queuedCount).toBe(0);
    });

    it('should queue tasks with create operation', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      await db.tasks.add(createMockTask({ id: 'task-1' }));

      await queueExistingTasks();

      const queue = getSyncQueue();
      const pending = await queue.getPending();

      expect(pending[0].operation).toBe('create');
      expect(pending[0].taskId).toBe('task-1');
    });

    it('should preserve task vector clocks when queueing', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      const taskWithClock = createMockTask({
        id: 'task-1',
        vectorClock: { 'device-456': 5 },
      });
      await db.tasks.add(taskWithClock);

      await queueExistingTasks();

      const queue = getSyncQueue();
      const pending = await queue.getPending();

      expect(pending[0].vectorClock).toEqual({ 'device-456': 5 });
    });

    it('should handle tasks without vector clocks', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      const taskWithoutClock = createMockTask({ id: 'task-1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (taskWithoutClock as any).vectorClock;
      await db.tasks.add(taskWithoutClock);

      await queueExistingTasks();

      const queue = getSyncQueue();
      const pending = await queue.getPending();

      expect(pending[0].vectorClock).toEqual({});
    });
  });
});
