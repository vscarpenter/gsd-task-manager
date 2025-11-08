/**
 * Tests for sync debug utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { debugSyncQueue, clearStuckOperations, installSyncDebugTools } from '@/lib/sync/debug';
import {
  createMockSyncConfig,
  createMockSyncQueueItem,
  createMockTask,
  mockConsole,
} from '../fixtures';

// Mock dependencies
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => mockQueue),
}));

// Create mock queue instance
const mockQueue = {
  getPending: vi.fn(async () => []),
  clear: vi.fn(async () => {}),
};

describe('sync/debug', () => {
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();

    // Reset all mocks
    vi.clearAllMocks();
    mockQueue.getPending.mockResolvedValue([]);
    mockQueue.clear.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    consoleMock.restore();
    await db.delete();
  });

  describe('debugSyncQueue', () => {
    it('should log sync queue debug information', async () => {
      // Setup test data
      const config = createMockSyncConfig({
        enabled: true,
        lastSyncAt: Date.now() - 60000,
        consecutiveFailures: 0,
        vectorClock: { 'device-1': 5 },
      });
      await db.syncMetadata.add(config);

      const task = createMockTask({ id: 'task-1', title: 'Test Task' });
      await db.tasks.add(task);

      const queueItem = createMockSyncQueueItem({
        id: 'op-1',
        taskId: 'task-1',
        operation: 'update',
        timestamp: Date.now(),
        retryCount: 0,
      });
      mockQueue.getPending.mockResolvedValue([queueItem]);

      // Execute
      const result = await debugSyncQueue();

      // Verify console output
      expect(console.log).toHaveBeenCalledWith('=== SYNC QUEUE DEBUG ===');
      expect(console.log).toHaveBeenCalledWith('Total pending operations: 1');
      expect(console.log).toHaveBeenCalledWith('\nPending operations:');
      expect(console.log).toHaveBeenCalledWith('\n=== SYNC CONFIG ===');
      expect(console.log).toHaveBeenCalledWith('\n=== TASKS ===');
      expect(console.log).toHaveBeenCalledWith('Total tasks: 1');

      // Verify return value
      expect(result.pendingOps).toHaveLength(1);
      expect(result.pendingOps[0].id).toBe('op-1');
      expect(result.config).toBeDefined();
      expect(result.config?.enabled).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-1');
    });

    it('should log pending operation details', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const timestamp = Date.now();
      const queueItem = createMockSyncQueueItem({
        id: 'op-1',
        taskId: 'task-1',
        operation: 'create',
        timestamp,
        retryCount: 2,
        consolidatedFrom: ['op-0', 'op-00'],
      });
      mockQueue.getPending.mockResolvedValue([queueItem]);

      await debugSyncQueue();

      // Verify operation details were logged
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'op-1',
          taskId: 'task-1',
          operation: 'create',
          timestamp: new Date(timestamp).toISOString(),
          retryCount: 2,
          consolidatedFrom: 2,
          hasPayload: true,
        })
      );
    });

    it('should detect and warn about duplicate task IDs in queue', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const queueItems = [
        createMockSyncQueueItem({ id: 'op-1', taskId: 'task-1' }),
        createMockSyncQueueItem({ id: 'op-2', taskId: 'task-2' }),
        createMockSyncQueueItem({ id: 'op-3', taskId: 'task-1' }), // Duplicate
        createMockSyncQueueItem({ id: 'op-4', taskId: 'task-2' }), // Duplicate
      ];
      mockQueue.getPending.mockResolvedValue(queueItems);

      await debugSyncQueue();

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '\n⚠️  DUPLICATE TASK IDS IN QUEUE:',
        expect.arrayContaining(['task-1', 'task-2'])
      );
    });

    it('should not warn when no duplicate task IDs exist', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const queueItems = [
        createMockSyncQueueItem({ id: 'op-1', taskId: 'task-1' }),
        createMockSyncQueueItem({ id: 'op-2', taskId: 'task-2' }),
        createMockSyncQueueItem({ id: 'op-3', taskId: 'task-3' }),
      ];
      mockQueue.getPending.mockResolvedValue(queueItems);

      await debugSyncQueue();

      // Verify no warning was logged
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle empty queue', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      mockQueue.getPending.mockResolvedValue([]);

      const result = await debugSyncQueue();

      expect(console.log).toHaveBeenCalledWith('Total pending operations: 0');
      expect(result.pendingOps).toHaveLength(0);
    });

    it('should log sync config details', async () => {
      const lastSyncAt = Date.now() - 120000;
      const nextRetryAt = Date.now() + 60000;
      const config = createMockSyncConfig({
        enabled: true,
        lastSyncAt,
        consecutiveFailures: 3,
        nextRetryAt,
        vectorClock: { 'device-1': 10, 'device-2': 5 },
      });
      await db.syncMetadata.add(config);

      await debugSyncQueue();

      // Verify config was logged with formatted dates
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          lastSyncAt: new Date(lastSyncAt).toISOString(),
          consecutiveFailures: 3,
          nextRetryAt: new Date(nextRetryAt).toISOString(),
          vectorClock: { 'device-1': 10, 'device-2': 5 },
        })
      );
    });

    it('should handle missing sync config', async () => {
      // No sync config in database
      mockQueue.getPending.mockResolvedValue([]);

      const result = await debugSyncQueue();

      // Should log null values for config
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: undefined,
          lastSyncAt: null,
          consecutiveFailures: undefined,
          nextRetryAt: null,
          vectorClock: undefined,
        })
      );

      expect(result.config).toBeNull();
    });

    it('should count tasks correctly', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Add multiple tasks
      await db.tasks.add(createMockTask({ id: 'task-1' }));
      await db.tasks.add(createMockTask({ id: 'task-2' }));
      await db.tasks.add(createMockTask({ id: 'task-3' }));

      const result = await debugSyncQueue();

      expect(console.log).toHaveBeenCalledWith('Total tasks: 3');
      expect(result.tasks).toHaveLength(3);
    });

    it('should handle operations without consolidatedFrom', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const queueItem = createMockSyncQueueItem({
        id: 'op-1',
        consolidatedFrom: undefined,
      });
      mockQueue.getPending.mockResolvedValue([queueItem]);

      await debugSyncQueue();

      // Should log 0 for consolidatedFrom when undefined
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          consolidatedFrom: 0,
        })
      );
    });

    it('should handle operations without payload', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const queueItem = createMockSyncQueueItem({
        id: 'op-1',
        payload: undefined,
      });
      mockQueue.getPending.mockResolvedValue([queueItem]);

      await debugSyncQueue();

      // Should log false for hasPayload when undefined
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPayload: false,
        })
      );
    });
  });

  describe('clearStuckOperations', () => {
    it('should clear queue when user confirms', async () => {
      const queueItems = [
        createMockSyncQueueItem({ id: 'op-1' }),
        createMockSyncQueueItem({ id: 'op-2' }),
      ];
      mockQueue.getPending.mockResolvedValue(queueItems);

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      await clearStuckOperations();

      // Verify confirmation prompt
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to clear 2 pending operations? This cannot be undone.'
      );

      // Verify queue was cleared
      expect(mockQueue.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✓ Queue cleared');

      confirmSpy.mockRestore();
    });

    it('should not clear queue when user cancels', async () => {
      const queueItems = [
        createMockSyncQueueItem({ id: 'op-1' }),
      ];
      mockQueue.getPending.mockResolvedValue(queueItems);

      // Mock window.confirm to return false
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      await clearStuckOperations();

      // Verify confirmation prompt
      expect(confirmSpy).toHaveBeenCalled();

      // Verify queue was NOT cleared
      expect(mockQueue.clear).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Cancelled');

      confirmSpy.mockRestore();
    });

    it('should handle empty queue', async () => {
      mockQueue.getPending.mockResolvedValue([]);

      // Mock window.confirm (should not be called)
      const confirmSpy = vi.spyOn(window, 'confirm');

      await clearStuckOperations();

      expect(console.log).toHaveBeenCalledWith('Found 0 pending operations');
      expect(console.log).toHaveBeenCalledWith('No operations to clear');
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(mockQueue.clear).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('should log pending operation count', async () => {
      const queueItems = [
        createMockSyncQueueItem({ id: 'op-1' }),
        createMockSyncQueueItem({ id: 'op-2' }),
        createMockSyncQueueItem({ id: 'op-3' }),
      ];
      mockQueue.getPending.mockResolvedValue(queueItems);

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      await clearStuckOperations();

      expect(console.log).toHaveBeenCalledWith('Found 3 pending operations');

      confirmSpy.mockRestore();
    });
  });

  describe('installSyncDebugTools', () => {
    it('should install debug functions on window object', () => {
      // Clear any existing functions
      delete (window as any).debugSyncQueue;
      delete (window as any).clearStuckOperations;

      installSyncDebugTools();

      // Verify functions are installed
      expect((window as any).debugSyncQueue).toBe(debugSyncQueue);
      expect((window as any).clearStuckOperations).toBe(clearStuckOperations);

      // Verify installation message
      expect(console.log).toHaveBeenCalledWith(
        '[SYNC DEBUG] Debug tools installed. Available functions:'
      );
      expect(console.log).toHaveBeenCalledWith('  - debugSyncQueue()');
      expect(console.log).toHaveBeenCalledWith('  - clearStuckOperations()');
    });

    it('should be callable multiple times without error', () => {
      installSyncDebugTools();
      
      expect(() => installSyncDebugTools()).not.toThrow();
      
      // Functions should still be available
      expect((window as any).debugSyncQueue).toBe(debugSyncQueue);
      expect((window as any).clearStuckOperations).toBe(clearStuckOperations);
    });

    it('should make debug functions accessible from window', () => {
      installSyncDebugTools();

      // Verify we can call the functions from window
      expect(typeof (window as any).debugSyncQueue).toBe('function');
      expect(typeof (window as any).clearStuckOperations).toBe('function');
    });
  });
});
