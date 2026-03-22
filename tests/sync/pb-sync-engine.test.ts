import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(),
}));

vi.mock('@/lib/sync/task-mapper', () => ({
  taskRecordToPocketBase: vi.fn((task) => ({ task_id: task.id, ...task })),
  pocketBaseToTaskRecord: vi.fn((record) => ({
    id: record.task_id,
    title: record.title || 'Test',
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    createdAt: record.client_created_at || '2024-01-01T00:00:00.000Z',
    updatedAt: record.client_updated_at || '2024-01-01T00:00:00.000Z',
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: true,
    notificationSent: false,
    timeSpent: 0,
    timeEntries: [],
  })),
}));

vi.mock('@/lib/db', () => {
  const mockTasks = {
    get: vi.fn(),
    bulkGet: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
  };
  const mockSyncMetadata = {
    get: vi.fn(),
    put: vi.fn(),
  };
  const mockSyncQueue = {
    toArray: vi.fn().mockResolvedValue([]),
  };
  return {
    getDb: vi.fn(() => ({
      tasks: mockTasks,
      syncMetadata: mockSyncMetadata,
      syncQueue: mockSyncQueue,
    })),
  };
});

const mockRetryManager = {
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  canSyncNow: vi.fn().mockResolvedValue(true),
  shouldRetry: vi.fn().mockResolvedValue(true),
};

vi.mock('@/lib/sync/retry-manager', () => ({
  getRetryManager: vi.fn(() => mockRetryManager),
}));

vi.mock('@/lib/sync-history', () => ({
  recordSyncSuccess: vi.fn(),
  recordSyncError: vi.fn(),
}));

vi.mock('@/lib/sync/notifications', () => ({
  notifySyncSuccess: vi.fn(),
  notifySyncError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { pushLocalChanges, pullRemoteChanges, fullSync } from '@/lib/sync/pb-sync-engine';
import { getCurrentUserId, getPocketBase } from '@/lib/sync/pocketbase-client';
import { getSyncQueue } from '@/lib/sync/queue';
import { getDb } from '@/lib/db';
import { getRetryManager } from '@/lib/sync/retry-manager';
import { notifySyncError } from '@/lib/sync/notifications';
import { recordSyncError } from '@/lib/sync-history';

// Helper to create a mock PocketBase instance
// Returns a stable collection mock so chained getFullList calls work correctly
function createMockPB() {
  const collectionMock = {
    getFullList: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'pb-123' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  };
  return {
    collection: vi.fn(() => collectionMock),
    _collectionMock: collectionMock,
  };
}

// Helper to create a mock queue
function createMockQueue() {
  return {
    getPending: vi.fn().mockResolvedValue([]),
    dequeue: vi.fn(),
    incrementRetry: vi.fn(),
    getForTask: vi.fn().mockResolvedValue([]),
    populateFromExistingTasks: vi.fn(),
  };
}

describe('pb-sync-engine', () => {
  let mockPB: ReturnType<typeof createMockPB>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPB = createMockPB();
    mockQueue = createMockQueue();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue(mockPB);
    (getSyncQueue as ReturnType<typeof vi.fn>).mockReturnValue(mockQueue);
  });

  describe('pushLocalChanges', () => {
    it('should return authenticated: false when user is not authenticated', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await pushLocalChanges();

      expect(result.authenticated).toBe(false);
      expect(result.pushedCount).toBe(0);
    });

    it('should return authenticated: true when user is authenticated', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');
      mockQueue.getPending.mockResolvedValue([]);

      const result = await pushLocalChanges();

      expect(result.authenticated).toBe(true);
    });

    it('should not dequeue delete operations when remote index fetch fails', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      // Simulate index fetch failure by making getFullList reject
      const mockCollection = {
        getFullList: vi.fn().mockRejectedValue(new Error('Network error')),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const db = getDb();
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'sync_config',
        deviceId: 'device-1',
      });

      mockQueue.getPending.mockResolvedValue([
        { id: 'q1', taskId: 'task-1', operation: 'delete', payload: null, retryCount: 0, timestamp: Date.now() },
      ]);

      const result = await pushLocalChanges();

      // Delete should NOT be dequeued
      expect(mockQueue.dequeue).not.toHaveBeenCalled();
      // Should be counted as failed
      expect(result.failedCount).toBe(1);
      // Retry should be incremented
      expect(mockQueue.incrementRetry).toHaveBeenCalledWith('q1');
    });

    it('should dequeue delete operations when index fetch succeeds and task not found remotely', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]), // Success but empty
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const db = getDb();
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'sync_config',
        deviceId: 'device-1',
      });

      mockQueue.getPending.mockResolvedValue([
        { id: 'q1', taskId: 'task-1', operation: 'delete', payload: null, retryCount: 0, timestamp: Date.now() },
      ]);

      const result = await pushLocalChanges();

      // Delete should be dequeued (task not found remotely, which is fine)
      expect(mockQueue.dequeue).toHaveBeenCalledWith('q1');
      expect(result.pushedCount).toBe(1);
    });
  });

  describe('pullRemoteChanges', () => {
    it('should return authenticated: false when user is not authenticated', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await pullRemoteChanges(null);

      expect(result.authenticated).toBe(false);
      expect(result.pulledCount).toBe(0);
      expect(result.maxObservedTimestamp).toBeNull();
    });

    it('should track maxObservedTimestamp from pulled records', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const records = [
        { id: 'pb-1', task_id: 'task-1', title: 'A', client_updated_at: '2024-01-01T00:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'pb-2', task_id: 'task-2', title: 'B', client_updated_at: '2024-06-15T12:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z' },
        { id: 'pb-3', task_id: 'task-3', title: 'C', client_updated_at: '2024-03-10T08:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z' },
      ];

      // First call returns records for pull, second call returns records for reconcileDeletedTasks index fetch
      const mockCollection = {
        getFullList: vi.fn()
          .mockResolvedValueOnce(records) // pullRemoteChanges fetch
          .mockResolvedValueOnce(records.map(r => ({ id: r.id, task_id: r.task_id }))), // reconcileDeletedTasks index fetch
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const db = getDb();
      (db.tasks.bulkGet as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await pullRemoteChanges(null);

      expect(result.authenticated).toBe(true);
      expect(result.maxObservedTimestamp).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should return null maxObservedTimestamp when no records pulled', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const result = await pullRemoteChanges('2024-01-01T00:00:00.000Z');

      expect(result.maxObservedTimestamp).toBeNull();
    });

    it('should skip invalid records returned by pocketBaseToTaskRecord', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const { pocketBaseToTaskRecord } = await import('@/lib/sync/task-mapper');
      (pocketBaseToTaskRecord as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(null)  // Invalid record
        .mockReturnValueOnce({      // Valid record
          id: 'task-2',
          title: 'Valid',
          updatedAt: '2024-01-01T00:00:00.000Z',
        });

      const records = [
        { id: 'pb-1', task_id: 'task-1', client_updated_at: '2024-01-01T00:00:00.000Z' },
        { id: 'pb-2', task_id: 'task-2', client_updated_at: '2024-01-02T00:00:00.000Z' },
      ];

      const mockCollection = {
        getFullList: vi.fn()
          .mockResolvedValueOnce(records) // pullRemoteChanges fetch
          .mockResolvedValueOnce(records.map(r => ({ id: r.id, task_id: r.task_id }))), // reconcileDeletedTasks index fetch
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const db = getDb();
      (db.tasks.bulkGet as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await pullRemoteChanges(null);

      expect(result.pulledCount).toBe(1); // Only the valid record
    });
  });

  describe('fullSync', () => {
    it('should return auth error when not authenticated and not update lastSyncAt', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const db = getDb();
      const config = {
        key: 'sync_config',
        enabled: true,
        deviceId: 'device-1',
        lastSyncAt: '2024-01-01T00:00:00.000Z',
      };
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue(config);

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const result = await fullSync('auto');

      expect(result.status).toBe('error');
      expect(result.error).toContain('not authenticated');

      // Verify lastSyncAt was NOT updated
      expect(db.syncMetadata.put).not.toHaveBeenCalled();

      // Verify recordFailure was called (not recordSuccess)
      const retryManager = getRetryManager();
      expect(retryManager.recordFailure).toHaveBeenCalled();
      expect(retryManager.recordSuccess).not.toHaveBeenCalled();

      // Verify error was reported
      expect(recordSyncError).toHaveBeenCalled();
      expect(notifySyncError).toHaveBeenCalled();
    });

    it('should use server-observed timestamp for cursor instead of client clock', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const records = [
        { id: 'pb-1', task_id: 'task-1', title: 'A', client_updated_at: '2024-06-15T12:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z' },
      ];

      // pushLocalChanges returns early (no pending items), so no getFullList for push.
      // pullRemoteChanges calls getFullList once, then reconcileDeletedTasks calls it again.
      const mockCollection = {
        getFullList: vi.fn()
          .mockResolvedValueOnce(records) // pullRemoteChanges fetch
          .mockResolvedValueOnce(records.map(r => ({ id: r.id, task_id: r.task_id }))), // reconcileDeletedTasks index fetch
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      mockQueue.getPending.mockResolvedValue([]);
      mockQueue.getForTask.mockResolvedValue([]);

      const db = getDb();
      const config = {
        key: 'sync_config',
        enabled: true,
        deviceId: 'device-1',
        lastSyncAt: '2024-01-01T00:00:00.000Z',
      };
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue(config);
      (db.tasks.bulkGet as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await fullSync('auto');

      expect(result.status).toBe('success');

      // Verify cursor was set to server-observed timestamp, not client clock
      const putCalls = (db.syncMetadata.put as ReturnType<typeof vi.fn>).mock.calls;
      expect(putCalls.length).toBeGreaterThan(0);
      const putCall = putCalls[0][0];
      expect(putCall.lastSyncAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should not call recordSuccess on partial failure', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      // Set up push to partially fail
      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]),
        create: vi.fn()
          .mockResolvedValueOnce({ id: 'pb-1' }) // First succeeds
          .mockRejectedValueOnce(new Error('Server error')), // Second fails
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      mockQueue.getPending.mockResolvedValue([
        { id: 'q1', taskId: 'task-1', operation: 'create', payload: { id: 'task-1', title: 'A', updatedAt: '2024-01-01T00:00:00.000Z' }, retryCount: 0, timestamp: Date.now() },
        { id: 'q2', taskId: 'task-2', operation: 'create', payload: { id: 'task-2', title: 'B', updatedAt: '2024-01-01T00:00:00.000Z' }, retryCount: 0, timestamp: Date.now() },
      ]);

      const db = getDb();
      const config = {
        key: 'sync_config',
        enabled: true,
        deviceId: 'device-1',
        lastSyncAt: null,
      };
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue(config);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await fullSync('auto');

      expect(result.status).toBe('partial');

      // recordSuccess should NOT have been called
      const retryManager = getRetryManager();
      expect(retryManager.recordSuccess).not.toHaveBeenCalled();
      // recordFailure SHOULD have been called
      expect(retryManager.recordFailure).toHaveBeenCalled();
    });

    it('should preserve existing cursor when no new records are pulled', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]), // No records
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      mockQueue.getPending.mockResolvedValue([]);

      const db = getDb();
      const existingCursor = '2024-03-01T00:00:00.000Z';
      const config = {
        key: 'sync_config',
        enabled: true,
        deviceId: 'device-1',
        lastSyncAt: existingCursor,
      };
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue(config);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await fullSync('auto');

      expect(result.status).toBe('success');

      // Cursor should remain at the existing value (not advance to now)
      const putCalls = (db.syncMetadata.put as ReturnType<typeof vi.fn>).mock.calls;
      expect(putCalls.length).toBeGreaterThan(0);
      const putCall = putCalls[0][0];
      expect(putCall.lastSyncAt).toBe(existingCursor);
    });
  });
});
