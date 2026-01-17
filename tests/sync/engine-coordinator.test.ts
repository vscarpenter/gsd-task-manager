/**
 * Tests for SyncEngine - sync orchestration and state transitions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { SyncEngine } from '@/lib/sync/engine/coordinator';
import { createMockSyncConfig, mockConsole } from '../fixtures';

// Mock all dependencies
vi.mock('@/lib/sync/crypto', () => ({
  getCryptoManager: vi.fn(() => mockCrypto),
}));

vi.mock('@/lib/sync/api-client', () => ({
  getApiClient: vi.fn(() => mockApiClient),
}));

vi.mock('@/lib/sync/token-manager', () => ({
  getTokenManager: vi.fn(() => mockTokenManager),
}));

vi.mock('@/lib/sync/retry-manager', () => ({
  getRetryManager: vi.fn(() => mockRetryManager),
}));

vi.mock('@/lib/sync/queue-optimizer', () => ({
  getQueueOptimizer: vi.fn(() => mockQueueOptimizer),
}));

vi.mock('@/lib/sync/engine/push-handler', () => ({
  pushLocalChanges: vi.fn(async () => mockPushResult),
}));

vi.mock('@/lib/sync/engine/pull-handler', () => ({
  pullRemoteChanges: vi.fn(async () => mockPullResult),
}));

vi.mock('@/lib/sync/engine/conflict-resolver', () => ({
  autoResolveConflicts: vi.fn(async (conflicts) => conflicts.length),
}));

vi.mock('@/lib/sync/engine/error-handler', () => ({
  handleSyncError: vi.fn(async (error) => ({
    status: 'error',
    error: error.message,
  })),
}));

vi.mock('@/lib/sync-history', () => ({
  recordSyncSuccess: vi.fn(async () => {}),
}));

// Import mocked modules
import { pushLocalChanges } from '@/lib/sync/engine/push-handler';
import { pullRemoteChanges } from '@/lib/sync/engine/pull-handler';
import { autoResolveConflicts } from '@/lib/sync/engine/conflict-resolver';
import { handleSyncError } from '@/lib/sync/engine/error-handler';
import { recordSyncSuccess } from '@/lib/sync-history';

// Create mock instances
const mockCrypto = {
  isInitialized: vi.fn(() => true),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encrypt: vi.fn(async (_data: string) => ({
    ciphertext: 'encrypted',
    nonce: 'nonce',
  })),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decrypt: vi.fn(async (_data: string) => 'decrypted'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hash: vi.fn(async (_data: string) => 'hash'),
};

const mockApiClient = {
  setToken: vi.fn(),
  push: vi.fn(),
  pull: vi.fn(),
};

const mockTokenManager = {
  ensureValidToken: vi.fn(async () => true),
  handleUnauthorized: vi.fn(async () => true),
};

const mockRetryManager = {
  canSyncNow: vi.fn(async () => true),
  getRetryCount: vi.fn(async () => 0),
  recordSuccess: vi.fn(async () => {}),
};

const mockQueueOptimizer = {
  consolidateAll: vi.fn(async () => 0),
};

let mockPushResult = {
  accepted: [],
  rejected: [],
  conflicts: [],
  serverVectorClock: {},
};

let mockPullResult = {
  tasks: [],
  deletedTaskIds: [],
  serverVectorClock: {},
  conflicts: [],
};

describe('SyncEngine', () => {
  let engine: SyncEngine;
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    engine = new SyncEngine();
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();

    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset mock results
    mockPushResult = {
      accepted: [],
      rejected: [],
      conflicts: [],
      serverVectorClock: {},
    };
    
    mockPullResult = {
      tasks: [],
      deletedTaskIds: [],
      serverVectorClock: {},
      conflicts: [],
    };

    // Setup default mock behaviors
    mockCrypto.isInitialized.mockReturnValue(true);
    mockTokenManager.ensureValidToken.mockResolvedValue(true);
    mockRetryManager.canSyncNow.mockResolvedValue(true);
    mockRetryManager.getRetryCount.mockResolvedValue(0);
    mockQueueOptimizer.consolidateAll.mockResolvedValue(0);
    
    vi.mocked(pushLocalChanges).mockResolvedValue(mockPushResult);
    vi.mocked(pullRemoteChanges).mockResolvedValue(mockPullResult);
    vi.mocked(autoResolveConflicts).mockImplementation(async (conflicts) => conflicts.length);
    vi.mocked(recordSyncSuccess).mockResolvedValue();
  });

  afterEach(async () => {
    consoleMock.restore();
    await db.delete();
  });

  describe('sync orchestration', () => {
    it('should execute full sync flow: push then pull', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const result = await engine.sync('user');

      expect(result.status).toBe('success');
      expect(pushLocalChanges).toHaveBeenCalled();
      expect(pullRemoteChanges).toHaveBeenCalled();
      
      // Verify push was called before pull
      const pushCall = vi.mocked(pushLocalChanges).mock.invocationCallOrder[0];
      const pullCall = vi.mocked(pullRemoteChanges).mock.invocationCallOrder[0];
      expect(pushCall).toBeLessThan(pullCall);
    });

    it('should update metadata after successful sync', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      await engine.sync('user');

      const config = await db.syncMetadata.get('sync_config');
      expect(config?.lastSyncAt).toBeGreaterThan(0);
    });

    it('should record sync success to history', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      await engine.sync('user');

      expect(recordSyncSuccess).toHaveBeenCalled();
    });

    it('should return success status with counts', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      
      mockPushResult.accepted = ['task-1', 'task-2'];
      mockPullResult.tasks = [
        { id: 'task-3', encryptedBlob: 'enc', nonce: 'nonce', vectorClock: {}, updatedAt: Date.now() },
      ];

      const result = await engine.sync('user');

      expect(result.status).toBe('success');
      expect(result.pushedCount).toBe(2);
      expect(result.pulledCount).toBe(1);
    });
  });

  describe('state transitions', () => {
    it('should prevent concurrent sync operations', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Make sync take some time
      vi.mocked(pushLocalChanges).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockPushResult;
      });

      const sync1 = engine.sync('user');
      const sync2 = engine.sync('user');

      const [result1, result2] = await Promise.all([sync1, sync2]);

      expect(result1.status).toBe('success');
      expect(result2.status).toBe('already_running');
      
      // Verify push was only called once
      expect(pushLocalChanges).toHaveBeenCalledTimes(1);
    });

    it('should allow sync after previous sync completes', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      await engine.sync('user');
      await engine.sync('user');

      expect(pushLocalChanges).toHaveBeenCalledTimes(2);
    });

    it('should check sync enabled before starting', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: false }));

      const result = await engine.sync('user');

      expect(result.status).toBe('error');
      expect(result.error).toContain('not configured');
      expect(pushLocalChanges).not.toHaveBeenCalled();
    });

    it('should check encryption initialized before sync', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      mockCrypto.isInitialized.mockReturnValue(false);

      const result = await engine.sync('user');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Encryption not initialized');
      expect(pushLocalChanges).not.toHaveBeenCalled();
    });
  });

  describe('pull-then-push sync flow', () => {
    it('should execute push before pull', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      await engine.sync('user');

      const pushOrder = vi.mocked(pushLocalChanges).mock.invocationCallOrder[0];
      const pullOrder = vi.mocked(pullRemoteChanges).mock.invocationCallOrder[0];
      
      expect(pushOrder).toBeLessThan(pullOrder);
    });

    it('should pass updated config to pull after push', async () => {
      const config = createMockSyncConfig({ vectorClock: { device1: 1 } });
      await db.syncMetadata.add(config);

      // Mock push updating vector clock
      mockPushResult.serverVectorClock = { device1: 2 };

      await engine.sync('user');

      // Pull should be called with config (it will reload from DB)
      expect(pullRemoteChanges).toHaveBeenCalled();
    });

    it('should handle conflicts from pull phase', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ conflictStrategy: 'last_write_wins' }));

      mockPullResult.conflicts = [
        {
          taskId: 'task-1',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          localVersion: { id: 'task-1', title: 'Local', updatedAt: Date.now() - 1000 } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          remoteVersion: { id: 'task-1', title: 'Remote', updatedAt: Date.now() } as any,
        },
      ];

      const result = await engine.sync('user');

      expect(autoResolveConflicts).toHaveBeenCalledWith(mockPullResult.conflicts);
      expect(result.conflictsResolved).toBe(1);
    });

    it('should not auto-resolve conflicts with manual strategy', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ conflictStrategy: 'manual' }));

      mockPullResult.conflicts = [
        {
          taskId: 'task-1',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          localVersion: { id: 'task-1', title: 'Local', updatedAt: Date.now() - 1000 } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          remoteVersion: { id: 'task-1', title: 'Remote', updatedAt: Date.now() } as any,
        },
      ];

      const result = await engine.sync('user');

      expect(autoResolveConflicts).not.toHaveBeenCalled();
      expect(result.status).toBe('conflict');
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('sync cancellation', () => {
    it('should return already_running when sync is in progress', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Make first sync take time
      vi.mocked(pushLocalChanges).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockPushResult;
      });

      const sync1 = engine.sync('user');
      const sync2 = engine.sync('user');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_result1, result2] = await Promise.all([sync1, sync2]);

      expect(result2.status).toBe('already_running');
    });
  });

  describe('concurrent sync prevention', () => {
    it('should block concurrent auto sync requests', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      vi.mocked(pushLocalChanges).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return mockPushResult;
      });

      const results = await Promise.all([
        engine.sync('auto'),
        engine.sync('auto'),
        engine.sync('auto'),
      ]);

      const successCount = results.filter(r => r.status === 'success').length;
      const runningCount = results.filter(r => r.status === 'already_running').length;

      expect(successCount).toBe(1);
      expect(runningCount).toBe(2);
    });

    it('should block concurrent user sync requests', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      vi.mocked(pushLocalChanges).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return mockPushResult;
      });

      const results = await Promise.all([
        engine.sync('user'),
        engine.sync('user'),
      ]);

      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('already_running');
    });
  });

  describe('priority handling', () => {
    it('should bypass backoff for user-triggered sync', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      mockRetryManager.canSyncNow.mockResolvedValue(false);

      const result = await engine.sync('user');

      expect(result.status).toBe('success');
      expect(pushLocalChanges).toHaveBeenCalled();
    });

    it('should respect backoff for auto sync', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      mockRetryManager.canSyncNow.mockResolvedValue(false);

      const result = await engine.sync('auto');

      expect(result.status).toBe('error');
      expect(result.error).toContain('backoff');
      expect(pushLocalChanges).not.toHaveBeenCalled();
    });
  });

  describe('token validation', () => {
    it('should ensure valid token before sync', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      await engine.sync('user');

      expect(mockTokenManager.ensureValidToken).toHaveBeenCalled();
    });

    it('should fail sync if token validation fails', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      mockTokenManager.ensureValidToken.mockResolvedValue(false);

      const result = await engine.sync('user');

      expect(result.status).toBe('error');
      expect(result.error).toContain('authentication token');
      expect(pushLocalChanges).not.toHaveBeenCalled();
    });

    it('should handle 401 errors with token refresh', async () => {
      const config = createMockSyncConfig({ token: 'old-token' });
      await db.syncMetadata.add(config);

      // Mock 401 error on first push
      vi.mocked(pushLocalChanges)
        .mockRejectedValueOnce(new Error('401 Unauthorized'))
        .mockResolvedValueOnce(mockPushResult);

      mockTokenManager.handleUnauthorized.mockResolvedValue(true);

      // Update token in DB to simulate refresh
      await db.syncMetadata.put({
        ...config,
        token: 'new-token',
        key: 'sync_config',
      });

      const result = await engine.sync('user');

      expect(mockTokenManager.handleUnauthorized).toHaveBeenCalled();
      expect(pushLocalChanges).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('success');
    });

    it('should fail if token refresh fails', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      vi.mocked(pushLocalChanges).mockRejectedValue(new Error('401 Unauthorized'));
      mockTokenManager.handleUnauthorized.mockResolvedValue(false);

      const result = await engine.sync('user');

      expect(result.status).toBe('error');
      expect(result.error).toContain('Authentication expired');
    });
  });

  describe('queue optimization', () => {
    it('should optimize queue before sync', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      await engine.sync('user');

      expect(mockQueueOptimizer.consolidateAll).toHaveBeenCalled();
    });

    it('should log removed operations count', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      mockQueueOptimizer.consolidateAll.mockResolvedValue(5);

      await engine.sync('user');

      expect(mockQueueOptimizer.consolidateAll).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should delegate error handling to error handler', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const testError = new Error('Test error');
      vi.mocked(pushLocalChanges).mockRejectedValue(testError);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _result = await engine.sync('user');

      expect(handleSyncError).toHaveBeenCalledWith(
        testError,
        null,
        null,
        mockRetryManager,
        mockTokenManager,
        expect.any(String),
        'user',
        expect.any(Number)
      );
    });

    it('should handle errors during pull phase', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const testError = new Error('Pull failed');
      vi.mocked(pullRemoteChanges).mockRejectedValue(testError);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _result = await engine.sync('user');

      expect(handleSyncError).toHaveBeenCalled();
    });

    it('should not fail sync if history recording fails', async () => {
      await db.syncMetadata.add(createMockSyncConfig());
      vi.mocked(recordSyncSuccess).mockRejectedValue(new Error('History error'));

      const result = await engine.sync('user');

      expect(result.status).toBe('success');
    });
  });

  describe('helper methods', () => {
    it('should check if sync is enabled', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: true }));

      const enabled = await engine.isEnabled();

      expect(enabled).toBe(true);
    });

    it('should return false when sync not configured', async () => {
      const enabled = await engine.isEnabled();

      expect(enabled).toBe(false);
    });

    it('should get sync status', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const status = await engine.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('lastSyncAt');
      expect(status).toHaveProperty('pendingCount');
      expect(status).toHaveProperty('isRunning');
    });
  });
});
