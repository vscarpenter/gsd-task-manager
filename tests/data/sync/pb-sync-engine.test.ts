import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRemoteChange, fullSync } from '@/lib/sync/pb-sync-engine';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock task-mapper
vi.mock('@/lib/sync/task-mapper', () => ({
  pocketBaseToTaskRecord: vi.fn((record) => {
    if (record.task_id === 'invalid') return null;
    return {
      id: record.task_id,
      title: record.title ?? 'Test',
      description: '',
      urgent: false,
      important: false,
      quadrant: 'not-urgent-not-important',
      completed: false,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: record.client_updated_at ?? '2026-04-08T00:00:00.000Z',
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    };
  }),
}));

// Mock DB
const mockTasks = new Map<string, Record<string, unknown>>();
const mockDb = {
  tasks: {
    get: vi.fn((id: string) => Promise.resolve(mockTasks.get(id))),
    add: vi.fn((task: Record<string, unknown>) => {
      mockTasks.set(task.id as string, task);
      return Promise.resolve();
    }),
    put: vi.fn((task: Record<string, unknown>) => {
      mockTasks.set(task.id as string, task);
      return Promise.resolve();
    }),
    delete: vi.fn((id: string) => {
      mockTasks.delete(id);
      return Promise.resolve();
    }),
  },
  syncMetadata: {
    get: vi.fn().mockResolvedValue({
      key: 'sync_config',
      enabled: true,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
    }),
    put: vi.fn().mockResolvedValue(undefined),
  },
  syncQueue: {
    toArray: vi.fn().mockResolvedValue([]),
  },
};
vi.mock('@/lib/db', () => ({
  getDb: () => mockDb,
}));

// Mock push/pull
const mockPushResult = { pushedCount: 0, failedCount: 0, lastError: null, authenticated: true };
const mockPullResult = { pulledCount: 0, authenticated: true, maxObservedTimestamp: null };
vi.mock('@/lib/sync/pb-push', () => ({
  pushLocalChanges: vi.fn(() => Promise.resolve({ ...mockPushResult })),
}));
vi.mock('@/lib/sync/pb-pull', () => ({
  pullRemoteChanges: vi.fn(() => Promise.resolve({ ...mockPullResult })),
}));

// Mock retry manager
const mockRetryManager = {
  recordSuccess: vi.fn().mockResolvedValue(undefined),
  recordFailure: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/lib/sync/retry-manager', () => ({
  getRetryManager: () => mockRetryManager,
}));

// Mock sync-history
vi.mock('@/lib/sync-history', () => ({
  recordSyncSuccess: vi.fn().mockResolvedValue(undefined),
  recordSyncError: vi.fn().mockResolvedValue(undefined),
  recordSyncPartial: vi.fn().mockResolvedValue(undefined),
}));

// Mock notifications
vi.mock('@/lib/sync/notifications', () => ({
  notifySyncSuccess: vi.fn(),
  notifySyncError: vi.fn(),
}));

// Mock helpers
vi.mock('@/lib/sync/pb-sync-helpers', () => ({
  getDeviceId: vi.fn().mockResolvedValue('device-123'),
}));

describe('pb-sync-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks.clear();
  });

  describe('applyRemoteChange', () => {
    it('should apply a remote create for new task', async () => {
      const record = { task_id: 'task-1', title: 'New Task', client_updated_at: '2026-04-08T00:00:00.000Z' };

      await applyRemoteChange('create', record as never);

      expect(mockDb.tasks.add).toHaveBeenCalled();
      expect(mockTasks.has('task-1')).toBe(true);
    });

    it('should skip create if task already exists locally', async () => {
      mockTasks.set('task-1', { id: 'task-1', title: 'Existing' });

      const record = { task_id: 'task-1', title: 'New Task', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('create', record as never);

      expect(mockDb.tasks.add).not.toHaveBeenCalled();
    });

    it('should apply a remote update when remote is newer (LWW)', async () => {
      mockTasks.set('task-1', { id: 'task-1', title: 'Old', updatedAt: '2026-04-07T00:00:00.000Z' });

      const record = { task_id: 'task-1', title: 'Updated', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('update', record as never);

      expect(mockDb.tasks.put).toHaveBeenCalled();
    });

    it('should skip update when local is newer', async () => {
      mockTasks.set('task-1', { id: 'task-1', title: 'Local', updatedAt: '2026-04-09T00:00:00.000Z' });

      const record = { task_id: 'task-1', title: 'Older Remote', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('update', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
    });

    it('should skip realtime update when timestamps are equal (consistent LWW with pull/push)', async () => {
      const equalTimestamp = '2026-04-08T00:00:00.000Z';
      mockTasks.set('task-1', { id: 'task-1', title: 'Local', updatedAt: equalTimestamp });

      const record = { task_id: 'task-1', title: 'Remote Same Time', client_updated_at: equalTimestamp };
      await applyRemoteChange('update', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
    });

    it('should apply a remote delete', async () => {
      mockTasks.set('task-1', { id: 'task-1', title: 'To Delete' });

      const record = { task_id: 'task-1' };
      await applyRemoteChange('delete', record as never);

      expect(mockDb.tasks.delete).toHaveBeenCalledWith('task-1');
    });

    it('should_skip_realtime_delete_when_a_local_change_is_pending_for_the_task', async () => {
      // A remote delete must not wipe an unsynced local edit. This mirrors the
      // guard in reconcileDeletedTasks: a queued op means the local change wins
      // (edit-beats-delete) and will be re-pushed, recreating the remote record.
      mockTasks.set('task-1', { id: 'task-1', title: 'Locally edited' });
      mockDb.syncQueue.toArray.mockResolvedValueOnce([
        { id: 'op-1', taskId: 'task-1', operation: 'update', status: 'pending' },
      ]);

      await applyRemoteChange('delete', { task_id: 'task-1' } as never);

      expect(mockDb.tasks.delete).not.toHaveBeenCalled();
      expect(mockTasks.has('task-1')).toBe(true);
    });

    it('should skip invalid records from mapper', async () => {
      const record = { task_id: 'invalid', title: 'Bad Record' };
      await applyRemoteChange('update', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
      expect(mockDb.tasks.add).not.toHaveBeenCalled();
    });
  });

  describe('fullSync', () => {
    it('should return success when push and pull succeed', async () => {
      const result = await fullSync('user');

      expect(result.status).toBe('success');
      expect(result.pushedCount).toBe(0);
      expect(result.pulledCount).toBe(0);
      expect(mockRetryManager.recordSuccess).toHaveBeenCalled();
    });

    it('should return error when not authenticated', async () => {
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      const { pullRemoteChanges } = await import('@/lib/sync/pb-pull');
      vi.mocked(pushLocalChanges).mockResolvedValueOnce({ ...mockPushResult, authenticated: false });
      vi.mocked(pullRemoteChanges).mockResolvedValueOnce({ ...mockPullResult, authenticated: false });

      const result = await fullSync();

      expect(result.status).toBe('error');
      expect(result.error).toContain('not authenticated');
    });

    it('should return partial when push has failures', async () => {
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      vi.mocked(pushLocalChanges).mockResolvedValueOnce({
        pushedCount: 2,
        failedCount: 1,
        lastError: 'Network error',
        authenticated: true,
      });

      const result = await fullSync();

      expect(result.status).toBe('partial');
      expect(result.error).toContain('1 item(s) failed');
    });

    it('records partial sync via recordSyncPartial (not recordSyncSuccess)', async () => {
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      const { recordSyncPartial, recordSyncSuccess } = await import('@/lib/sync-history');
      vi.mocked(pushLocalChanges).mockResolvedValueOnce({
        pushedCount: 2,
        failedCount: 1,
        lastError: 'rate_limited',
        authenticated: true,
      });

      await fullSync('auto');

      expect(recordSyncPartial).toHaveBeenCalledTimes(1);
      expect(recordSyncSuccess).not.toHaveBeenCalled();
      expect(vi.mocked(recordSyncPartial).mock.calls[0][0]).toMatchObject({
        pushedCount: 2,
        failedCount: 1,
        pulledCount: 0,
        errorMessage: 'rate_limited',
        deviceId: 'device-123',
        triggeredBy: 'auto',
      });
    });

    it('should handle sync errors gracefully', async () => {
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      vi.mocked(pushLocalChanges).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await fullSync();

      expect(result.status).toBe('error');
      expect(result.error).toBe('network_error');
      expect(mockRetryManager.recordFailure).toHaveBeenCalled();
    });

    it('reports non-transient errors via the ERROR log branch', async () => {
      // A permanent (validation) error should NOT be treated as transient
      // noise — it takes the ERROR-level branch in reportSyncError. All
      // side-effects (recordFailure, recordSyncError) still fire identically.
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      vi.mocked(pushLocalChanges).mockRejectedValueOnce(
        new Error('422 Unprocessable Entity'),
      );

      const result = await fullSync();

      expect(result.status).toBe('error');
      expect(result.error).toBe('validation_failed');
      expect(mockRetryManager.recordFailure).toHaveBeenCalled();
    });

    it('reports PB ClientResponseError status 0 via the WARN log branch', async () => {
      // PB SDK network fault — Error with `status: 0`. The reportSyncError
      // function downgrades the log level to WARN but the returned result
      // shape and side-effects remain unchanged.
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      const pbNetworkError = Object.assign(new Error('Something went wrong.'), {
        status: 0,
      });
      vi.mocked(pushLocalChanges).mockRejectedValueOnce(pbNetworkError);

      const result = await fullSync();

      expect(result.status).toBe('error');
      expect(result.error).toBe('network_error');
      expect(mockRetryManager.recordFailure).toHaveBeenCalled();
    });

    it('should_sanitize_unexpected_sync_errors_to_stable_codes_so_task_content_never_reaches_history_or_toasts', async () => {
      // PB 4xx validation bodies echo submitted field values. An exception
      // escaping fullSync must be reduced to a stable SyncErrorCode before
      // it is persisted to syncHistory, shown in a toast, or returned —
      // mirroring what the push path already does via sanitizeSyncError().
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      const { recordSyncError } = await import('@/lib/sync-history');
      const { notifySyncError } = await import('@/lib/sync/notifications');
      const secretTitle = 'Confidential: acquire MegaCorp';
      vi.mocked(pushLocalChanges).mockRejectedValueOnce(
        new Error(`422 Unprocessable Entity: title "${secretTitle}" failed to validate`),
      );

      const result = await fullSync('user');

      expect(result.status).toBe('error');
      expect(result.error).toBe('validation_failed');
      expect(vi.mocked(recordSyncError)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(recordSyncError).mock.calls[0][0]).toBe('validation_failed');
      expect(vi.mocked(notifySyncError)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(notifySyncError).mock.calls[0][0]).toBe('validation_failed');
      expect(JSON.stringify(vi.mocked(recordSyncError).mock.calls)).not.toContain(secretTitle);
      expect(JSON.stringify(vi.mocked(notifySyncError).mock.calls)).not.toContain(secretTitle);
    });
  });
});
