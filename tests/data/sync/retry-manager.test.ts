import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryManager } from '@/lib/sync/retry-manager';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock config module
const mockConfig = {
  consecutiveFailures: 0,
  lastFailureAt: null as number | null,
  lastFailureReason: null as string | null,
  nextRetryAt: null as number | null,
  enabled: true,
};

vi.mock('@/lib/sync/config', () => ({
  getSyncConfig: vi.fn(() => Promise.resolve({ ...mockConfig })),
  updateSyncConfig: vi.fn((updates: Record<string, unknown>) => {
    Object.assign(mockConfig, updates);
    return Promise.resolve();
  }),
}));

describe('RetryManager', () => {
  let manager: RetryManager;

  beforeEach(() => {
    manager = new RetryManager();
    mockConfig.consecutiveFailures = 0;
    mockConfig.lastFailureAt = null;
    mockConfig.lastFailureReason = null;
    mockConfig.nextRetryAt = null;
  });

  describe('getNextRetryDelay', () => {
    it('should return 5s for first failure', () => {
      expect(manager.getNextRetryDelay(1)).toBe(5000);
    });

    it('should return 10s for second failure', () => {
      expect(manager.getNextRetryDelay(2)).toBe(10000);
    });

    it('should return 30s for third failure', () => {
      expect(manager.getNextRetryDelay(3)).toBe(30000);
    });

    it('should return 60s for fourth failure', () => {
      expect(manager.getNextRetryDelay(4)).toBe(60000);
    });

    it('should cap at 300s for fifth and subsequent failures', () => {
      expect(manager.getNextRetryDelay(5)).toBe(300000);
      expect(manager.getNextRetryDelay(10)).toBe(300000);
    });

    it('should return first delay for zero failures', () => {
      expect(manager.getNextRetryDelay(0)).toBe(5000);
    });
  });

  describe('recordFailure', () => {
    it('should increment consecutive failures', async () => {
      const { updateSyncConfig } = await import('@/lib/sync/config');
      await manager.recordFailure(new Error('Network error'));

      expect(updateSyncConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveFailures: 1,
          // Persisted reason is a stable code, not the raw message.
          lastFailureReason: 'network_error',
        }),
      );
    });

    it('persists a sanitized error code, never raw PB validation content', async () => {
      // PocketBase 4xx bodies can echo submitted field values (task titles).
      // recordFailure must reduce the error to a stable code before it lands
      // in IndexedDB sync metadata, so task content never leaks.
      const { updateSyncConfig } = await import('@/lib/sync/config');
      const leakedTitle = 'Confidential: acquire MegaCorp';
      await manager.recordFailure(
        new Error(`422 Unprocessable: title "${leakedTitle}" failed to validate`),
      );

      const call = vi.mocked(updateSyncConfig).mock.lastCall![0] as { lastFailureReason: string };
      expect(call.lastFailureReason).toBe('validation_failed');
      expect(JSON.stringify(call)).not.toContain(leakedTitle);
    });

    it('should set nextRetryAt with exponential backoff', async () => {
      const { updateSyncConfig } = await import('@/lib/sync/config');
      const before = Date.now();
      await manager.recordFailure(new Error('test'));

      const call = vi.mocked(updateSyncConfig).mock.lastCall![0] as { nextRetryAt: number };
      expect(call.nextRetryAt).toBeGreaterThanOrEqual(before + 5000);
    });

    it('honors a server Retry-After hint over the exponential schedule', async () => {
      // First failure would normally back off 5s; a 45s Retry-After must win.
      const { updateSyncConfig } = await import('@/lib/sync/config');
      const before = Date.now();
      await manager.recordFailure(new Error('429 too many requests'), { retryAfterMs: 45_000 });

      const call = vi.mocked(updateSyncConfig).mock.lastCall![0] as { nextRetryAt: number };
      expect(call.nextRetryAt).toBeGreaterThanOrEqual(before + 45_000);
      expect(call.nextRetryAt).toBeLessThan(before + 60_000);
    });

    it('clamps an excessive Retry-After hint to the max backoff', async () => {
      // A hostile/bogus header must not freeze sync for hours.
      const { updateSyncConfig } = await import('@/lib/sync/config');
      const before = Date.now();
      await manager.recordFailure(new Error('429'), { retryAfterMs: 9_999_999_999 });

      const call = vi.mocked(updateSyncConfig).mock.lastCall![0] as { nextRetryAt: number };
      expect(call.nextRetryAt).toBeLessThanOrEqual(before + 5 * 60 * 1000 + 50);
    });

    it('falls back to exponential backoff when no Retry-After hint is given', async () => {
      const { updateSyncConfig } = await import('@/lib/sync/config');
      const before = Date.now();
      await manager.recordFailure(new Error('500 server error'), { retryAfterMs: null });

      const call = vi.mocked(updateSyncConfig).mock.lastCall![0] as { nextRetryAt: number };
      expect(call.nextRetryAt).toBeGreaterThanOrEqual(before + 5000);
      expect(call.nextRetryAt).toBeLessThan(before + 10_000);
    });
  });

  describe('recordSuccess', () => {
    it('should reset failure counter when there were failures', async () => {
      mockConfig.consecutiveFailures = 3;
      const { updateSyncConfig } = await import('@/lib/sync/config');

      await manager.recordSuccess();

      expect(updateSyncConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveFailures: 0,
          lastFailureAt: null,
          lastFailureReason: null,
          nextRetryAt: null,
        }),
      );
    });

    it('should not update config when no previous failures', async () => {
      const { updateSyncConfig } = await import('@/lib/sync/config');
      vi.mocked(updateSyncConfig).mockClear();

      await manager.recordSuccess();

      expect(updateSyncConfig).not.toHaveBeenCalled();
    });
  });

  describe('shouldRetry', () => {
    it('should return true when under max retries', async () => {
      mockConfig.consecutiveFailures = 3;
      expect(await manager.shouldRetry()).toBe(true);
    });

    it('should return false when at max retries', async () => {
      mockConfig.consecutiveFailures = 5;
      expect(await manager.shouldRetry()).toBe(false);
    });

    it('should return false when over max retries', async () => {
      mockConfig.consecutiveFailures = 10;
      expect(await manager.shouldRetry()).toBe(false);
    });
  });

  describe('canSyncNow', () => {
    it('should return true when no retry is scheduled', async () => {
      expect(await manager.canSyncNow()).toBe(true);
    });

    it('should return true when retry time has passed', async () => {
      mockConfig.nextRetryAt = Date.now() - 1000;
      expect(await manager.canSyncNow()).toBe(true);
    });

    it('should return false when retry time is in the future', async () => {
      mockConfig.nextRetryAt = Date.now() + 60000;
      expect(await manager.canSyncNow()).toBe(false);
    });
  });

  describe('getRetryCount', () => {
    it('should return current failure count', async () => {
      mockConfig.consecutiveFailures = 3;
      expect(await manager.getRetryCount()).toBe(3);
    });

    it('should return 0 when no failures', async () => {
      expect(await manager.getRetryCount()).toBe(0);
    });
  });
});
