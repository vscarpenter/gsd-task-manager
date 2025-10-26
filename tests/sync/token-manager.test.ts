/**
 * Tests for TokenManager - automatic token refresh functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { TokenManager, getTokenManager } from '@/lib/sync/token-manager';
import { getApiClient } from '@/lib/sync/api-client';
import type { SyncConfig } from '@/lib/sync/types';

// Mock the API client
vi.mock('@/lib/sync/api-client', () => {
  const mockApiClient = {
    setToken: vi.fn(),
    refreshToken: vi.fn(),
  };

  return {
    getApiClient: vi.fn(() => mockApiClient),
  };
});

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let db: ReturnType<typeof getDb>;
  let mockApi: any;

  beforeEach(async () => {
    tokenManager = getTokenManager();
    db = getDb();
    mockApi = getApiClient();

    // Clear database
    await db.syncMetadata.clear();
    await db.tasks.clear();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.syncMetadata.clear();
    await db.tasks.clear();
  });

  describe('needsRefresh()', () => {
    it('should return false when sync is not configured', async () => {
      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(false);
    });

    it('should return false when sync is disabled', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: false,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(false);
    });

    it('should return false when token expires in more than 5 minutes', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(false);
    });

    it('should return true when token expires within 5 minutes', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(true);
    });

    it('should return true when token is already expired', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: Date.now() - 1000, // Expired 1 second ago
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(true);
    });
  });

  describe('ensureValidToken()', () => {
    it('should throw error when sync is not configured', async () => {
      await expect(tokenManager.ensureValidToken()).rejects.toThrow('Sync not configured');
    });

    it('should throw error when no token is available', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: null,
        tokenExpiresAt: null,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      await expect(tokenManager.ensureValidToken()).rejects.toThrow('No authentication token available');
    });

    it('should return true without refresh when token is valid', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'valid-token',
        tokenExpiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const result = await tokenManager.ensureValidToken();
      
      expect(result).toBe(true);
      expect(mockApi.refreshToken).not.toHaveBeenCalled();
    });

    it('should refresh token when it expires within 5 minutes', async () => {
      const newToken = 'refreshed-token';
      const newExpiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now

      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      mockApi.refreshToken.mockResolvedValue({
        token: newToken,
        expiresAt: newExpiresAt,
      });

      const result = await tokenManager.ensureValidToken();
      
      expect(result).toBe(true);
      expect(mockApi.setToken).toHaveBeenCalledWith('old-token');
      expect(mockApi.refreshToken).toHaveBeenCalled();
      expect(mockApi.setToken).toHaveBeenCalledWith(newToken);

      // Verify token was updated in database
      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      expect(config.token).toBe(newToken);
      expect(config.tokenExpiresAt).toBe(newExpiresAt);
    });

    it('should return false when token refresh fails', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      mockApi.refreshToken.mockRejectedValue(new Error('Refresh failed'));

      const result = await tokenManager.ensureValidToken();
      
      expect(result).toBe(false);
      expect(mockApi.refreshToken).toHaveBeenCalled();
    });
  });

  describe('handleUnauthorized()', () => {
    it('should return false when sync is not configured', async () => {
      const result = await tokenManager.handleUnauthorized();
      expect(result).toBe(false);
    });

    it('should attempt token refresh on 401 error', async () => {
      const newToken = 'refreshed-token-after-401';
      const newExpiresAt = Date.now() + 60 * 60 * 1000;

      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'expired-token',
        tokenExpiresAt: Date.now() - 1000, // Already expired
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      mockApi.refreshToken.mockResolvedValue({
        token: newToken,
        expiresAt: newExpiresAt,
      });

      const result = await tokenManager.handleUnauthorized();
      
      expect(result).toBe(true);
      expect(mockApi.refreshToken).toHaveBeenCalled();

      // Verify token was updated
      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      expect(config.token).toBe(newToken);
      expect(config.tokenExpiresAt).toBe(newExpiresAt);
    });

    it('should return false when refresh fails after 401', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'expired-token',
        tokenExpiresAt: Date.now() - 1000,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      mockApi.refreshToken.mockRejectedValue(new Error('Token refresh failed'));

      const result = await tokenManager.handleUnauthorized();
      
      expect(result).toBe(false);
    });
  });

  describe('getTimeUntilExpiry()', () => {
    it('should return -1 when no token expiration is set', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: null,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const timeUntilExpiry = await tokenManager.getTimeUntilExpiry();
      expect(timeUntilExpiry).toBe(-1);
    });

    it('should return positive value when token has not expired', async () => {
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: expiresAt,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const timeUntilExpiry = await tokenManager.getTimeUntilExpiry();
      
      // Should be approximately 10 minutes (allow 1 second tolerance)
      expect(timeUntilExpiry).toBeGreaterThan(9 * 60 * 1000);
      expect(timeUntilExpiry).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it('should return negative value when token has expired', async () => {
      const expiresAt = Date.now() - 5 * 60 * 1000; // Expired 5 minutes ago

      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'test-token',
        tokenExpiresAt: expiresAt,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      const timeUntilExpiry = await tokenManager.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBeLessThan(0);
    });
  });

  describe('Integration: Token Lifecycle', () => {
    it('should handle complete token refresh cycle', async () => {
      // Initial setup with token expiring soon
      const initialToken = 'initial-token';
      const initialExpiresAt = Date.now() + 3 * 60 * 1000; // 3 minutes

      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: initialToken,
        tokenExpiresAt: initialExpiresAt,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // Check if refresh is needed
      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(true);

      // Perform refresh
      const newToken = 'refreshed-token';
      const newExpiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      mockApi.refreshToken.mockResolvedValue({
        token: newToken,
        expiresAt: newExpiresAt,
      });

      const refreshed = await tokenManager.ensureValidToken();
      expect(refreshed).toBe(true);

      // Verify token was updated
      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      expect(config.token).toBe(newToken);
      expect(config.tokenExpiresAt).toBe(newExpiresAt);

      // Verify no longer needs refresh
      const stillNeedsRefresh = await tokenManager.needsRefresh();
      expect(stillNeedsRefresh).toBe(false);
    });
  });

  describe('Issue #2: Token Expiration Normalization Integration', () => {
    it('should normalize token expiration from seconds when refreshing token', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes (needs refresh)
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // Mock refreshToken to return expiresAt in seconds (typical JWT format)
      const expiresAtSeconds = 1735689600; // Jan 1, 2025 00:00:00 UTC in seconds
      mockApi.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: expiresAtSeconds,
      });

      const result = await tokenManager.ensureValidToken();
      expect(result).toBe(true);

      // Verify stored value was normalized to milliseconds
      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      expect(config.tokenExpiresAt).toBe(expiresAtSeconds * 1000);
      expect(config.tokenExpiresAt).toBe(1735689600000);
    });

    it('should handle token expiration already in milliseconds when refreshing', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes (needs refresh)
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // Mock refreshToken to return expiresAt already in milliseconds
      const expiresAtMs = 1735689600000; // Jan 1, 2025 00:00:00 UTC in milliseconds
      mockApi.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: expiresAtMs,
      });

      const result = await tokenManager.ensureValidToken();
      expect(result).toBe(true);

      // Verify stored value remained unchanged (already in milliseconds)
      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      expect(config.tokenExpiresAt).toBe(expiresAtMs);
      expect(config.tokenExpiresAt).toBe(1735689600000);
    });

    it('should normalize token expiration on 401 error recovery', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'expired-token',
        tokenExpiresAt: Date.now() - 1000, // Already expired
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // Mock refresh with token in seconds
      const expiresAtSeconds = 1735689600;
      mockApi.refreshToken.mockResolvedValue({
        token: 'refreshed-token-after-401',
        expiresAt: expiresAtSeconds,
      });

      const result = await tokenManager.handleUnauthorized();
      expect(result).toBe(true);

      // Verify normalization occurred
      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      expect(config.tokenExpiresAt).toBe(expiresAtSeconds * 1000);
    });

    it('should handle threshold boundary value (seconds) correctly', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 1 * 60 * 1000,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // Just below 10 billion threshold (should be treated as seconds)
      const expiresAtSeconds = 9_999_999_999;
      mockApi.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: expiresAtSeconds,
      });

      await tokenManager.ensureValidToken();

      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      // Should be multiplied by 1000
      expect(config.tokenExpiresAt).toBe(expiresAtSeconds * 1000);
    });

    it('should handle threshold boundary value (milliseconds) correctly', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 1 * 60 * 1000,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // At threshold (should be treated as milliseconds)
      const expiresAtMs = 10_000_000_000;
      mockApi.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: expiresAtMs,
      });

      await tokenManager.ensureValidToken();

      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      // Should NOT be multiplied
      expect(config.tokenExpiresAt).toBe(expiresAtMs);
    });

    it('should handle realistic JWT token expiration (1 hour from now in seconds)', async () => {
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: 'user1',
        deviceId: 'device1',
        deviceName: 'Test Device',
        email: 'test@example.com',
        token: 'old-token',
        tokenExpiresAt: Date.now() + 1 * 60 * 1000,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'http://localhost:8787',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      // Typical JWT: current time + 1 hour (in seconds)
      const nowSeconds = Math.floor(Date.now() / 1000);
      const oneHourLaterSeconds = nowSeconds + 3600;

      mockApi.refreshToken.mockResolvedValue({
        token: 'new-jwt-token',
        expiresAt: oneHourLaterSeconds,
      });

      await tokenManager.ensureValidToken();

      const config = await db.syncMetadata.get('sync_config') as SyncConfig;
      // Should be normalized to milliseconds
      expect(config.tokenExpiresAt).toBe(oneHourLaterSeconds * 1000);

      // Verify it's approximately 1 hour from now
      const timeUntilExpiry = config.tokenExpiresAt - Date.now();
      expect(timeUntilExpiry).toBeGreaterThan(55 * 60 * 1000); // At least 55 minutes
      expect(timeUntilExpiry).toBeLessThanOrEqual(60 * 60 * 1000); // At most 60 minutes
    });
  });
});
