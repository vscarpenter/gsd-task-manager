import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(),
  isPendingSyncQueueItem: vi.fn((item) => (item.status ?? 'pending') === 'pending'),
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

// fullSync attempts a silent token refresh before push/pull; keep it a no-op
// here so these engine tests don't exercise the real auth path.
vi.mock('@/lib/sync/pb-auth', () => ({
  ensureValidAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/sync-history', () => ({
  recordSyncSuccess: vi.fn(),
  recordSyncError: vi.fn(),
  recordSyncPartial: vi.fn(),
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
    recordAttemptFailure: vi.fn(),
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
      // Retry should be recorded with an error message
      expect(mockQueue.recordAttemptFailure).toHaveBeenCalledWith('q1', expect.any(String));
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

    it('should filter and sort on the server-stamped updated field', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      await pullRemoteChanges('2026-06-10T15:00:00.000Z');

      // `updated` is a PB date field: the filter literal must use PocketBase's
      // space-separated form, not ISO `T` form.
      const listOptions = mockCollection.getFullList.mock.calls[0][0];
      expect(listOptions.sort).toBe('updated');
      expect(listOptions.filter).toContain('updated >= "2026-06-10 15:00:00.000Z"');
      expect(listOptions.filter).not.toContain('client_updated_at');
    });

    it('should track maxObservedTimestamp from the records\' server-stamped updated', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      // `updated` values deliberately differ from client_updated_at to prove
      // the cursor reads the server stamp, not the client one.
      const records = [
        { id: 'pb-1', task_id: 'task-1', title: 'A', client_updated_at: '2024-01-01T00:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z', updated: '2024-06-18 10:00:00.000Z' },
        { id: 'pb-2', task_id: 'task-2', title: 'B', client_updated_at: '2024-06-15T12:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z', updated: '2024-06-20 09:00:00.000Z' },
        { id: 'pb-3', task_id: 'task-3', title: 'C', client_updated_at: '2024-03-10T08:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z', updated: '2024-06-19 08:00:00.000Z' },
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
      // Cursor is persisted with a 30s overlap subtracted so the next pull's
      // `>=` filter can re-catch boundary records, normalized to ISO form.
      expect(result.maxObservedTimestamp).toBe('2024-06-20T08:59:30.000Z');
    });

    it('should advance the cursor from fetched records even when LWW applies none', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      // The server watermark moves on every fetch we complete — an LWW no-op
      // record never needs re-fetching, so it must still advance the cursor.
      const records = [
        { id: 'pb-1', task_id: 'task-1', title: 'A', client_updated_at: '2024-01-01T00:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z', updated: '2024-06-20 09:00:00.000Z' },
      ];

      const mockCollection = {
        getFullList: vi.fn()
          .mockResolvedValueOnce(records)
          .mockResolvedValueOnce(records.map(r => ({ id: r.id, task_id: r.task_id }))),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const db = getDb();
      // Local task already has the same client timestamp -> LWW no-op
      (db.tasks.bulkGet as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'task-1', updatedAt: '2024-01-01T00:00:00.000Z' },
      ]);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await pullRemoteChanges(null);

      expect(result.pulledCount).toBe(0);
      expect(result.maxObservedTimestamp).toBe('2024-06-20T08:59:30.000Z');
    });

    it('should ignore records without a server-stamped updated when computing the cursor', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const records = [
        { id: 'pb-1', task_id: 'task-1', title: 'A', client_updated_at: '2024-06-15T12:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z', updated: '' },
        { id: 'pb-2', task_id: 'task-2', title: 'B', client_updated_at: '2024-06-16T12:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z' },
      ];

      const mockCollection = {
        getFullList: vi.fn()
          .mockResolvedValueOnce(records)
          .mockResolvedValueOnce(records.map(r => ({ id: r.id, task_id: r.task_id }))),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);

      const db = getDb();
      (db.tasks.bulkGet as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await pullRemoteChanges(null);

      // Records were applied, but neither carried a server stamp the cursor
      // could trust — the client timestamps must NOT leak into the cursor.
      expect(result.pulledCount).toBe(2);
      expect(result.maxObservedTimestamp).toBeNull();
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
        { id: 'pb-1', task_id: 'task-1', title: 'A', client_updated_at: '2024-06-15T12:00:00.000Z', client_created_at: '2024-01-01T00:00:00.000Z', updated: '2024-06-16 03:00:00.000Z' },
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

      // Verify cursor was set to the PB server-stamped `updated`, not the
      // client-stamped client_updated_at, and persisted to the new field.
      const putCalls = (db.syncMetadata.put as ReturnType<typeof vi.fn>).mock.calls;
      expect(putCalls.length).toBeGreaterThan(0);
      const putCall = putCalls[0][0];
      // Cursor is persisted with a 30s overlap subtracted; see pb-pull.ts.
      expect(putCall.lastServerUpdatedAt).toBe('2024-06-16T02:59:30.000Z');
      // The legacy client-stamped cursor is left untouched (only read once,
      // for migration).
      expect(putCall.lastSyncAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should prefer lastServerUpdatedAt over the legacy lastSyncAt for the pull filter', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);
      mockQueue.getPending.mockResolvedValue([]);

      const db = getDb();
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        deviceId: 'device-1',
        lastSyncAt: '2024-01-01T00:00:00.000Z',
        lastServerUpdatedAt: '2024-06-01T00:00:00.000Z',
      });
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await fullSync('auto');

      const pullOptions = mockCollection.getFullList.mock.calls[0][0];
      expect(pullOptions.filter).toContain('updated >= "2024-06-01 00:00:00.000Z"');
    });

    it('should migrate a legacy client-stamped cursor by rewinding 24 hours', async () => {
      (getCurrentUserId as ReturnType<typeof vi.fn>).mockReturnValue('user-123');

      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockPB.collection.mockReturnValue(mockCollection);
      mockQueue.getPending.mockResolvedValue([]);

      const db = getDb();
      // Old-build config: only the client-stamped cursor exists. It may carry
      // up to ±5min of client clock skew, so the first server-stamped pull
      // rewinds a full day; re-pulled records are LWW no-ops.
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        deviceId: 'device-1',
        lastSyncAt: '2024-06-15T12:00:00.000Z',
      });
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await fullSync('auto');

      const pullOptions = mockCollection.getFullList.mock.calls[0][0];
      expect(pullOptions.filter).toContain('updated >= "2024-06-14 12:00:00.000Z"');
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
        lastSyncAt: null,
        lastServerUpdatedAt: existingCursor,
      };
      (db.syncMetadata.get as ReturnType<typeof vi.fn>).mockResolvedValue(config);
      (db.tasks.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await fullSync('auto');

      expect(result.status).toBe('success');

      // Cursor should remain at the existing value (not advance to now)
      const putCalls = (db.syncMetadata.put as ReturnType<typeof vi.fn>).mock.calls;
      expect(putCalls.length).toBeGreaterThan(0);
      const putCall = putCalls[0][0];
      expect(putCall.lastServerUpdatedAt).toBe(existingCursor);
    });
  });
});
