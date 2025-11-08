/**
 * Tests for HealthMonitor - periodic health checks and issue detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { HealthMonitor, getHealthMonitor } from '@/lib/sync/health-monitor';
import {
  createMockSyncConfig,
  createMockSyncQueueItem,
  mockDateNow,
  mockConsole,
} from '../fixtures';

// Mock dependencies
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => mockQueue),
}));

vi.mock('@/lib/sync/token-manager', () => ({
  getTokenManager: vi.fn(() => mockTokenManager),
}));

vi.mock('@/lib/sync/api-client', () => ({
  getApiClient: vi.fn(() => mockApiClient),
}));

// Create mock instances
const mockQueue = {
  getPending: vi.fn(async () => []),
};

const mockTokenManager = {
  getTimeUntilExpiry: vi.fn(async () => 60 * 60 * 1000), // 1 hour
  needsRefresh: vi.fn(async () => false),
  ensureValidToken: vi.fn(async () => true),
};

const mockApiClient = {
  setToken: vi.fn(),
  getStatus: vi.fn(async () => ({ status: 'ok' })),
};

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;
  let db: ReturnType<typeof getDb>;
  let consoleMock: ReturnType<typeof mockConsole>;
  let dateMock: ReturnType<typeof mockDateNow> | null = null;

  beforeEach(async () => {
    // Create a new monitor instance for each test
    monitor = new HealthMonitor();
    db = getDb();
    consoleMock = mockConsole();

    // Clear database
    await db.delete();
    await db.open();

    // Reset all mocks
    vi.clearAllMocks();
    mockQueue.getPending.mockResolvedValue([]);
    mockTokenManager.getTimeUntilExpiry.mockResolvedValue(60 * 60 * 1000);
    mockTokenManager.needsRefresh.mockResolvedValue(false);
    mockTokenManager.ensureValidToken.mockResolvedValue(true);
    mockApiClient.getStatus.mockResolvedValue({ status: 'ok' });
  });

  afterEach(async () => {
    // Stop monitor if running
    monitor.stop();
    
    // Restore console
    consoleMock.restore();
    
    // Restore date mock if used
    if (dateMock) {
      dateMock.restore();
      dateMock = null;
    }
    
    await db.delete();
  });

  describe('start and stop', () => {
    it('should start health monitor and run initial check', async () => {
      // Setup sync config
      await db.syncMetadata.add(createMockSyncConfig());

      monitor.start();

      expect(monitor.isActive()).toBe(true);

      // Wait for initial check to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify initial check was performed
      expect(mockQueue.getPending).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      monitor.start();
      const firstActive = monitor.isActive();
      
      monitor.start(); // Try to start again
      const secondActive = monitor.isActive();

      expect(firstActive).toBe(true);
      expect(secondActive).toBe(true);
    });

    it('should stop health monitor and clear interval', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      monitor.start();
      expect(monitor.isActive()).toBe(true);

      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });

    it('should not error when stopping if not running', () => {
      expect(monitor.isActive()).toBe(false);
      
      expect(() => monitor.stop()).not.toThrow();
      
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('check - health status calculation', () => {
    it('should return healthy status when no issues found', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('should return unhealthy status when issues found', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock expired token
      mockTokenManager.getTimeUntilExpiry.mockResolvedValue(-1000);

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should skip check when sync not enabled', async () => {
      await db.syncMetadata.add(createMockSyncConfig({ enabled: false }));

      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
      
      // Verify checks were not performed
      expect(mockQueue.getPending).not.toHaveBeenCalled();
    });

    it('should skip check when sync config not found', async () => {
      // No sync config in database

      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('should handle check errors gracefully', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock error in queue check
      mockQueue.getPending.mockRejectedValue(new Error('Database error'));

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].type).toBe('server_unreachable');
      expect(report.issues[0].severity).toBe('error');
    });
  });

  describe('stale operations detection', () => {
    it('should detect stale queue operations older than 1 hour', async () => {
      const now = Date.now();
      dateMock = mockDateNow(now);

      await db.syncMetadata.add(createMockSyncConfig());

      // Create stale operation (2 hours old)
      const staleOp = createMockSyncQueueItem({
        timestamp: now - 2 * 60 * 60 * 1000,
      });

      mockQueue.getPending.mockResolvedValue([staleOp]);

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].type).toBe('stale_queue');
      expect(report.issues[0].severity).toBe('warning');
      expect(report.issues[0].message).toContain('1 pending operations');
    });

    it('should not flag recent operations as stale', async () => {
      const now = Date.now();
      dateMock = mockDateNow(now);

      await db.syncMetadata.add(createMockSyncConfig());

      // Create recent operation (30 minutes old)
      const recentOp = createMockSyncQueueItem({
        timestamp: now - 30 * 60 * 1000,
      });

      mockQueue.getPending.mockResolvedValue([recentOp]);

      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('should count multiple stale operations', async () => {
      const now = Date.now();
      dateMock = mockDateNow(now);

      await db.syncMetadata.add(createMockSyncConfig());

      // Create multiple stale operations
      const staleOps = [
        createMockSyncQueueItem({ id: 'op-1', timestamp: now - 2 * 60 * 60 * 1000 }),
        createMockSyncQueueItem({ id: 'op-2', timestamp: now - 3 * 60 * 60 * 1000 }),
        createMockSyncQueueItem({ id: 'op-3', timestamp: now - 1.5 * 60 * 60 * 1000 }),
      ];

      mockQueue.getPending.mockResolvedValue(staleOps);

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues[0].message).toContain('3 pending operations');
    });

    it('should return null issue when no pending operations', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      mockQueue.getPending.mockResolvedValue([]);

      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });
  });

  describe('token expiration detection', () => {
    it('should detect expired token', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock expired token (negative time until expiry)
      mockTokenManager.getTimeUntilExpiry.mockResolvedValue(-1000);

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].type).toBe('token_expired');
      expect(report.issues[0].severity).toBe('error');
      expect(report.issues[0].message).toContain('expired');
    });

    it('should attempt automatic token refresh when needed', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock token needs refresh
      mockTokenManager.needsRefresh.mockResolvedValue(true);
      mockTokenManager.ensureValidToken.mockResolvedValue(true);

      const report = await monitor.check();

      expect(mockTokenManager.ensureValidToken).toHaveBeenCalled();
      expect(report.healthy).toBe(true);
    });

    it('should report warning when token refresh fails', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock token needs refresh but refresh fails
      mockTokenManager.needsRefresh.mockResolvedValue(true);
      mockTokenManager.ensureValidToken.mockResolvedValue(false);

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].type).toBe('token_expired');
      expect(report.issues[0].severity).toBe('warning');
      expect(report.issues[0].message).toContain('expiring soon');
    });

    it('should not report issue when token is valid', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock valid token (1 hour until expiry)
      mockTokenManager.getTimeUntilExpiry.mockResolvedValue(60 * 60 * 1000);
      mockTokenManager.needsRefresh.mockResolvedValue(false);

      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });
  });

  describe('server connectivity check', () => {
    it('should detect server unreachable', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock API error
      mockApiClient.getStatus.mockRejectedValue(new Error('Network error'));

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].type).toBe('server_unreachable');
      expect(report.issues[0].severity).toBe('error');
      expect(report.issues[0].message).toContain('Network error');
    });

    it('should pass when server is reachable', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      mockApiClient.getStatus.mockResolvedValue({ status: 'ok' });

      const report = await monitor.check();

      expect(mockApiClient.setToken).toHaveBeenCalled();
      expect(mockApiClient.getStatus).toHaveBeenCalled();
      expect(report.healthy).toBe(true);
    });

    it('should set token before checking connectivity', async () => {
      const config = createMockSyncConfig({ token: 'test-token-123' });
      await db.syncMetadata.add(config);

      await monitor.check();

      expect(mockApiClient.setToken).toHaveBeenCalledWith('test-token-123');
    });
  });

  describe('multiple issues detection', () => {
    it('should detect multiple issues in single check', async () => {
      const now = Date.now();
      dateMock = mockDateNow(now);

      await db.syncMetadata.add(createMockSyncConfig());

      // Setup multiple issues
      const staleOp = createMockSyncQueueItem({
        timestamp: now - 2 * 60 * 60 * 1000,
      });
      mockQueue.getPending.mockResolvedValue([staleOp]);
      mockTokenManager.getTimeUntilExpiry.mockResolvedValue(-1000);
      mockApiClient.getStatus.mockRejectedValue(new Error('Network error'));

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      expect(report.issues.length).toBeGreaterThanOrEqual(2);
      
      const issueTypes = report.issues.map(i => i.type);
      expect(issueTypes).toContain('stale_queue');
      expect(issueTypes).toContain('token_expired');
    });
  });

  describe('periodic health checks', () => {
    it('should schedule periodic checks when started', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      monitor.start();

      // Verify monitor is active
      expect(monitor.isActive()).toBe(true);

      // Wait for initial check to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify initial check was performed
      expect(mockQueue.getPending).toHaveBeenCalled();
    });

    it('should clear interval when stopped', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      monitor.start();
      expect(monitor.isActive()).toBe(true);

      const callsBeforeStop = mockQueue.getPending.mock.calls.length;
      
      monitor.stop();
      expect(monitor.isActive()).toBe(false);

      // Wait a bit to ensure no more calls are made
      await new Promise(resolve => setTimeout(resolve, 100));

      const callsAfterStop = mockQueue.getPending.mock.calls.length;

      // Should not have made additional calls after stop (or at most 1 if timing)
      expect(callsAfterStop - callsBeforeStop).toBeLessThanOrEqual(1);
    });
  });

  describe('getHealthMonitor singleton', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getHealthMonitor();
      const instance2 = getHealthMonitor();

      expect(instance1).toBe(instance2);
    });
  });
});
