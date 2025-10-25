/**
 * Tests for RetryManager - exponential backoff functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import { RetryManager, getRetryManager } from '@/lib/sync/retry-manager';
import { getSyncConfig } from '@/lib/sync/config';

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    retryManager = getRetryManager();
    db = getDb();

    // Clear database
    await db.delete();
    await db.open();

    // Initialize sync config
    await db.syncMetadata.add({
      key: 'sync_config',
      enabled: true,
      userId: 'user1',
      deviceId: 'device1',
      deviceName: 'Test Device',
      email: 'test@example.com',
      token: 'test-token',
      tokenExpiresAt: Date.now() + 60 * 60 * 1000,
      lastSyncAt: null,
      vectorClock: {},
      conflictStrategy: 'last_write_wins',
      serverUrl: 'http://localhost:8787',
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('exponential backoff delay calculation', () => {
    it('should return correct delays for consecutive failures', () => {
      expect(retryManager.getNextRetryDelay(1)).toBe(5000); // 5s
      expect(retryManager.getNextRetryDelay(2)).toBe(10000); // 10s
      expect(retryManager.getNextRetryDelay(3)).toBe(30000); // 30s
      expect(retryManager.getNextRetryDelay(4)).toBe(60000); // 60s
      expect(retryManager.getNextRetryDelay(5)).toBe(300000); // 300s
    });

    it('should cap at maximum delay', () => {
      expect(retryManager.getNextRetryDelay(6)).toBe(300000);
      expect(retryManager.getNextRetryDelay(10)).toBe(300000);
    });
  });

  describe('max retry limit enforcement', () => {
    it('should allow retries below max limit', async () => {
      const config = await getSyncConfig();
      expect(config?.consecutiveFailures).toBe(0);
      expect(await retryManager.shouldRetry()).toBe(true);
    });

    it('should block retries at max limit', async () => {
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        await retryManager.recordFailure(new Error('Test error'));
      }

      const shouldRetry = await retryManager.shouldRetry();
      expect(shouldRetry).toBe(false);
    });
  });

  describe('success resets retry counter', () => {
    it('should reset failure count on success', async () => {
      // Record some failures
      await retryManager.recordFailure(new Error('Test error 1'));
      await retryManager.recordFailure(new Error('Test error 2'));

      let config = await getSyncConfig();
      expect(config?.consecutiveFailures).toBe(2);

      // Record success
      await retryManager.recordSuccess();

      config = await getSyncConfig();
      expect(config?.consecutiveFailures).toBe(0);
      expect(config?.lastFailureAt).toBe(null);
      expect(config?.lastFailureReason).toBe(null);
      expect(config?.nextRetryAt).toBe(null);
    });
  });

  describe('canSyncNow', () => {
    it('should allow sync when no retry scheduled', async () => {
      const canSync = await retryManager.canSyncNow();
      expect(canSync).toBe(true);
    });

    it('should block sync when retry time has not passed', async () => {
      // Record a failure (sets nextRetryAt to future)
      await retryManager.recordFailure(new Error('Test error'));

      const canSync = await retryManager.canSyncNow();
      expect(canSync).toBe(false);
    });

    it('should allow sync when retry time has passed', async () => {
      // Manually set nextRetryAt to past
      const config = await getSyncConfig();
      if (config) {
        await db.syncMetadata.put({
          ...config,
          nextRetryAt: Date.now() - 1000, // 1 second ago
        });
      }

      const canSync = await retryManager.canSyncNow();
      expect(canSync).toBe(true);
    });
  });
});
