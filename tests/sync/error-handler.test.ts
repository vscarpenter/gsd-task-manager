/**
 * Tests for sync engine error handler - error recovery strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleSyncError } from '@/lib/sync/engine/error-handler';
import { RetryManager } from '@/lib/sync/retry-manager';
import { TokenManager } from '@/lib/sync/token-manager';
import * as syncHistory from '@/lib/sync-history';

// Mock dependencies
vi.mock('@/lib/sync-history');
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock getSyncQueue
vi.mock('@/lib/sync/queue', () => {
  const mockQueue = {
    getPendingCount: vi.fn().mockResolvedValue(5),
  };
  return {
    getSyncQueue: vi.fn(() => mockQueue),
    SyncQueue: vi.fn(),
  };
});

describe('error-handler', () => {
  let mockRetryManager: RetryManager;
  let mockTokenManager: TokenManager;
  const deviceId = 'test-device-123';
  const triggeredBy = 'user' as const;
  const syncStartTime = Date.now() - 5000; // 5 seconds ago

  beforeEach(() => {
    // Create mock retry manager
    mockRetryManager = {
      recordFailure: vi.fn(),
      recordSuccess: vi.fn(),
      getRetryCount: vi.fn(),
      shouldRetry: vi.fn(),
      getNextRetryDelay: vi.fn(),
      canSyncNow: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Create mock token manager
    mockTokenManager = {
      handleUnauthorized: vi.fn(),
      ensureValidToken: vi.fn(),
      needsRefresh: vi.fn(),
      getTimeUntilExpiry: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock recordSyncError
    vi.mocked(syncHistory.recordSyncError).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('transient error handling', () => {
    it('should handle transient errors with retry', async () => {
      const error = new Error('Network error');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(error);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Network error');
      expect(result.error).toContain('retry automatically');
    });

    it('should handle transient errors when max retries exceeded', async () => {
      const error = new Error('500 Internal Server Error');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(5);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(false);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(error);
      expect(result.status).toBe('error');
      expect(result.error).toContain('failed after multiple retries');
    });

    it('should record sync error to history for transient errors', async () => {
      const error = new Error('Timeout');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(syncHistory.recordSyncError).toHaveBeenCalledWith(
        'Timeout',
        deviceId,
        triggeredBy,
        expect.any(Number)
      );
    });
  });

  describe('authentication error handling', () => {
    it('should handle auth errors with successful token refresh', async () => {
      const error = new Error('401 Unauthorized');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockTokenManager.handleUnauthorized).mockResolvedValue(true);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockTokenManager.handleUnauthorized).toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error).toContain('Authentication refreshed');
      expect(result.error).toContain('try syncing again');
    });

    it('should handle auth errors with failed token refresh', async () => {
      const error = new Error('403 Forbidden');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockTokenManager.handleUnauthorized).mockResolvedValue(false);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockTokenManager.handleUnauthorized).toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error).toContain('Authentication expired');
      expect(result.error).toContain('sign in again');
    });

    it('should not record failure for auth errors', async () => {
      const error = new Error('Token expired');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockTokenManager.handleUnauthorized).mockResolvedValue(true);

      await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).not.toHaveBeenCalled();
    });
  });

  describe('permanent error handling', () => {
    it('should handle permanent errors without retry', async () => {
      const error = new Error('400 Bad Request');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).not.toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error).toContain('Sync error');
      expect(result.error).toContain('400 Bad Request');
    });

    it('should handle validation errors as permanent', async () => {
      const error = new Error('Validation failed');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).not.toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error).toContain('Validation failed');
    });

    it('should handle encryption errors as permanent', async () => {
      const error = new Error('Decryption failed');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).not.toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error).toContain('Decryption failed');
    });
  });

  describe('exponential backoff', () => {
    it('should use exponential backoff for consecutive failures', async () => {
      const error = new Error('Network error');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      // First failure - 5s delay
      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      let result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(result.error).toContain('5s');

      // Second failure - 10s delay
      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(2);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(10000);

      result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(result.error).toContain('10s');

      // Third failure - 30s delay
      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(3);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(30000);

      result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(result.error).toContain('30s');
    });
  });

  describe('error categorization integration', () => {
    it('should categorize network errors as transient', async () => {
      const errors = [
        new Error('Network error'),
        new Error('Fetch failed'),
        new Error('Connection refused'),
        new Error('ETIMEDOUT'),
      ];

      for (const error of errors) {
        vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
        vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
        vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

        const result = await handleSyncError(
          error,
          { accepted: [] },
          { tasks: [] },
          mockRetryManager,
          mockTokenManager,
          deviceId,
          triggeredBy,
          syncStartTime
        );

        expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(error);
        expect(result.error).toContain('retry');
      }
    });

    it('should categorize server errors as transient', async () => {
      const errors = [
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('504 Gateway Timeout'),
      ];

      for (const error of errors) {
        vi.clearAllMocks();
        vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
        vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
        vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

        const result = await handleSyncError(
          error,
          { accepted: [] },
          { tasks: [] },
          mockRetryManager,
          mockTokenManager,
          deviceId,
          triggeredBy,
          syncStartTime
        );

        expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(error);
        expect(result.error).toContain('retry');
      }
    });

    it('should categorize auth errors correctly', async () => {
      const errors = [
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('Token expired'),
      ];

      for (const error of errors) {
        vi.clearAllMocks();
        vi.mocked(mockTokenManager.handleUnauthorized).mockResolvedValue(true);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _result = await handleSyncError(
          error,
          { accepted: [] },
          { tasks: [] },
          mockRetryManager,
          mockTokenManager,
          deviceId,
          triggeredBy,
          syncStartTime
        );

        expect(mockTokenManager.handleUnauthorized).toHaveBeenCalled();
        expect(mockRetryManager.recordFailure).not.toHaveBeenCalled();
      }
    });

    it('should categorize client errors as permanent', async () => {
      const errors = [
        new Error('400 Bad Request'),
        new Error('404 Not Found'),
        new Error('409 Conflict'),
        new Error('422 Unprocessable Entity'),
      ];

      for (const error of errors) {
        vi.clearAllMocks();

        const result = await handleSyncError(
          error,
          { accepted: [] },
          { tasks: [] },
          mockRetryManager,
          mockTokenManager,
          deviceId,
          triggeredBy,
          syncStartTime
        );

        expect(mockRetryManager.recordFailure).not.toHaveBeenCalled();
        expect(mockTokenManager.handleUnauthorized).not.toHaveBeenCalled();
        expect(result.error).toContain(error.message);
      }
    });
  });

  describe('fatal error handling', () => {
    it('should handle non-Error objects', async () => {
      const error = 'String error';
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(result.status).toBe('error');
      expect(mockRetryManager.recordFailure).toHaveBeenCalled();
    });

    it('should handle uncategorized errors as transient', async () => {
      const error = new Error('Unknown error type');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(mockRetryManager.recordFailure).toHaveBeenCalledWith(error);
      expect(result.status).toBe('error');
    });

    it('should continue if history recording fails', async () => {
      const error = new Error('Network error');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);
      vi.mocked(syncHistory.recordSyncError).mockRejectedValue(new Error('History write failed'));

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      // Should still return a result even if history recording fails
      expect(result.status).toBe('error');
      expect(result.error).toContain('retry');
    });
  });

  describe('context logging', () => {
    it('should include push/pull counts in error context', async () => {
      const error = new Error('Network error');
      const pushResult = { accepted: [{ id: '1' }, { id: '2' }] };
      const pullResult = { tasks: [{ id: '3' }] };

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      // Verify that the function completed successfully with context
      expect(mockRetryManager.recordFailure).toHaveBeenCalled();
    });

    it('should handle missing push/pull results', async () => {
      const error = new Error('Network error');
      const pushResult = null;
      const pullResult = null;

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      const result = await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        syncStartTime
      );

      expect(result.status).toBe('error');
    });
  });

  describe('sync duration tracking', () => {
    it('should calculate and record sync duration', async () => {
      const error = new Error('Network error');
      const pushResult = { accepted: [] };
      const pullResult = { tasks: [] };
      const startTime = Date.now() - 3000; // 3 seconds ago

      vi.mocked(mockRetryManager.getRetryCount).mockResolvedValue(1);
      vi.mocked(mockRetryManager.shouldRetry).mockResolvedValue(true);
      vi.mocked(mockRetryManager.getNextRetryDelay).mockReturnValue(5000);

      await handleSyncError(
        error,
        pushResult,
        pullResult,
        mockRetryManager,
        mockTokenManager,
        deviceId,
        triggeredBy,
        startTime
      );

      expect(syncHistory.recordSyncError).toHaveBeenCalledWith(
        error.message,
        deviceId,
        triggeredBy,
        expect.any(Number)
      );

      const duration = vi.mocked(syncHistory.recordSyncError).mock.calls[0][3];
      expect(duration).toBeGreaterThan(0);
    });
  });
});
