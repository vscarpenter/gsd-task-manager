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
  getPocketBaseTaskId: vi.fn((record) =>
    typeof record.task_id === 'string' ? record.task_id : null
  ),
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
const mockArchivedTasks = new Map<string, Record<string, unknown>>();
const mockDeletedTasks = new Map<string, Record<string, unknown>>();
const mockDb = {
  transaction: vi.fn(async (
    _mode: string,
    _tables: unknown[],
    callback: () => Promise<void>
  ) => callback()),
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
  archivedTasks: {
    get: vi.fn((id: string) => Promise.resolve(mockArchivedTasks.get(id))),
    delete: vi.fn((id: string) => {
      mockArchivedTasks.delete(id);
      return Promise.resolve();
    }),
  },
  deletedTasks: {
    get: vi.fn((id: string) => Promise.resolve(mockDeletedTasks.get(id))),
    put: vi.fn((task: Record<string, unknown>) => {
      mockDeletedTasks.set(task.id as string, task);
      return Promise.resolve();
    }),
    delete: vi.fn((id: string) => {
      mockDeletedTasks.delete(id);
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
    bulkDelete: vi.fn().mockResolvedValue(undefined),
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
vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>('@/lib/sync/pb-sync-helpers');
  return {
    ...actual,
    getDeviceId: vi.fn().mockResolvedValue('device-123'),
  };
});

// Mock auth — fullSync attempts a silent token refresh before push/pull.
const mockEnsureValidAuth = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/sync/pb-auth', () => ({
  ensureValidAuth: () => mockEnsureValidAuth(),
}));

describe('pb-sync-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks.clear();
    mockArchivedTasks.clear();
    mockDeletedTasks.clear();
    mockEnsureValidAuth.mockResolvedValue(true);
  });

  describe('applyRemoteChange', () => {
    it('should apply a remote create for new task', async () => {
      const record = { task_id: 'task-1', title: 'New Task', client_updated_at: '2026-04-08T00:00:00.000Z' };

      await applyRemoteChange('create', record as never);

      expect(mockDb.tasks.put).toHaveBeenCalled();
      expect(mockTasks.has('task-1')).toBe(true);
    });

    it('should skip create if task already exists locally', async () => {
      mockTasks.set('task-1', { id: 'task-1', title: 'Existing' });

      const record = { task_id: 'task-1', title: 'New Task', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('create', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
    });

    it('should not resurrect an archived task on a remote create that predates the archive', async () => {
      mockArchivedTasks.set('task-1', { id: 'task-1', archivedAt: '2026-04-09T00:00:00.000Z' });

      const record = { task_id: 'task-1', title: 'New Task', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('create', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
      expect(mockTasks.has('task-1')).toBe(false);
    });

    it('should not resurrect an archived task on a remote update that predates the archive', async () => {
      mockArchivedTasks.set('task-1', { id: 'task-1', archivedAt: '2026-04-09T00:00:00.000Z' });

      const record = { task_id: 'task-1', title: 'Updated', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('update', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
      expect(mockTasks.has('task-1')).toBe(false);
    });

    it('should restore an archived task when the remote edit post-dates the archive', async () => {
      // edit-beats-delete under LWW: pb-push abandons the stale delete, so the
      // realtime path must let the newer remote edit win over the archive.
      mockArchivedTasks.set('task-1', { id: 'task-1', archivedAt: '2026-04-07T00:00:00.000Z' });

      const record = { task_id: 'task-1', title: 'Edited Elsewhere', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('update', record as never);

      expect(mockTasks.has('task-1')).toBe(true);
      expect(mockArchivedTasks.has('task-1')).toBe(false);
      expect(mockDb.transaction).toHaveBeenCalledWith(
        'rw',
        [mockDb.tasks, mockDb.archivedTasks, mockDb.deletedTasks],
        expect.any(Function)
      );
    });

    it('does not resurrect a deleted task when the remote update predates deletion', async () => {
      mockDeletedTasks.set('task-1', { id: 'task-1', deletedAt: '2026-04-09T00:00:00.000Z' });

      await applyRemoteChange('update', {
        task_id: 'task-1', title: 'Stale remote', client_updated_at: '2026-04-08T00:00:00.000Z',
      } as never);

      expect(mockTasks.has('task-1')).toBe(false);
      expect(mockDeletedTasks.has('task-1')).toBe(true);
    });

    it('restores a deleted task when the remote update post-dates deletion', async () => {
      mockDeletedTasks.set('task-1', { id: 'task-1', deletedAt: '2026-04-07T00:00:00.000Z' });

      await applyRemoteChange('update', {
        task_id: 'task-1', title: 'Newer remote', client_updated_at: '2026-04-08T00:00:00.000Z',
      } as never);

      expect(mockTasks.has('task-1')).toBe(true);
      expect(mockDeletedTasks.has('task-1')).toBe(false);
    });

    it('should un-archive on a remote create that post-dates the archive', async () => {
      mockArchivedTasks.set('task-1', { id: 'task-1', archivedAt: '2026-04-07T00:00:00.000Z' });

      const record = { task_id: 'task-1', title: 'Recreated', client_updated_at: '2026-04-08T00:00:00.000Z' };
      await applyRemoteChange('create', record as never);

      expect(mockTasks.has('task-1')).toBe(true);
      expect(mockArchivedTasks.has('task-1')).toBe(false);
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
      // Protected in place, not trashed — the push will recreate it remotely.
      expect(mockDb.deletedTasks.put).not.toHaveBeenCalled();
    });

    // The realtime mirror of the pull-path rule: a retry-exhausted row cannot
    // be pushed, so it may not shield the task. The unsynced content goes to
    // Trash and the dead row is dropped in the same transaction.
    it('abandons a local task to trash when its queued operation has failed', async () => {
      mockTasks.set('task-1', { id: 'task-1', title: 'Stale local copy' });
      mockDb.syncQueue.toArray.mockResolvedValueOnce([
        { id: 'op-1', taskId: 'task-1', operation: 'update', status: 'failed' },
      ]);

      await applyRemoteChange('delete', { task_id: 'task-1' } as never);

      expect(mockDb.tasks.delete).toHaveBeenCalledWith('task-1');
      expect(mockDeletedTasks.get('task-1')).toMatchObject({ id: 'task-1' });
      expect(mockDb.syncQueue.bulkDelete).toHaveBeenCalledWith(['op-1']);
    });

    it('should skip invalid records from mapper', async () => {
      const record = { task_id: 'invalid', title: 'Bad Record' };
      await applyRemoteChange('update', record as never);

      expect(mockDb.tasks.put).not.toHaveBeenCalled();
      expect(mockArchivedTasks.has('invalid')).toBe(false);
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

    it('attempts a silent token refresh before pushing', async () => {
      await fullSync('auto');

      expect(mockEnsureValidAuth).toHaveBeenCalledTimes(1);
    });

    it('threads a push Retry-After hint into the retry manager on partial failure', async () => {
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      vi.mocked(pushLocalChanges).mockResolvedValueOnce({
        pushedCount: 0,
        failedCount: 1,
        lastError: 'rate_limited',
        authenticated: true,
        retryAfterMs: 30_000,
      });

      await fullSync('auto');

      expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(
        expect.any(Error),
        { retryAfterMs: 30_000 },
      );
    });

    it('honors a Retry-After carried on a thrown 429 error', async () => {
      const { pushLocalChanges } = await import('@/lib/sync/pb-push');
      const rateLimited = Object.assign(new Error('429 too many requests'), {
        status: 429,
        response: { retryAfterMs: 12_000 },
      });
      vi.mocked(pushLocalChanges).mockRejectedValueOnce(rateLimited);

      const result = await fullSync('auto');

      expect(result.status).toBe('error');
      expect(result.error).toBe('rate_limited');
      expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(
        rateLimited,
        { retryAfterMs: 12_000 },
      );
    });
  });
});
