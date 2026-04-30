/**
 * Tests for HealthMonitor - periodic health checks and issue detection
 *
 * Updated for PocketBase migration: token-manager and api-client mocks
 * replaced with pocketbase-client mocks (getPocketBase, isAuthenticated).
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

// Mock PocketBase health check
const mockHealthCheck = vi.fn(async () => ({}));
const mockPocketBase = {
  health: { check: mockHealthCheck },
};

// Mock dependencies
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => mockQueue),
}));

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(() => mockPocketBase),
  isAuthenticated: vi.fn(() => mockIsAuthenticated),
}));

// Import the mocked function so we can change its return value per-test
import { isAuthenticated } from '@/lib/sync/pocketbase-client';

// Create mock instances
const mockQueue = {
  getPending: vi.fn(async () => []),
  getFailed: vi.fn(async () => []),
};

// Default: user is authenticated
let mockIsAuthenticated = true;

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
    mockQueue.getFailed.mockResolvedValue([]);
    mockHealthCheck.mockResolvedValue({});
    mockIsAuthenticated = true;
    // Re-set the mock return value after clearAllMocks
    vi.mocked(isAuthenticated).mockImplementation(() => mockIsAuthenticated);
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

      // Mock unauthenticated user
      mockIsAuthenticated = false;
      vi.mocked(isAuthenticated).mockReturnValue(false);

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

  describe('authentication check', () => {
    it('should detect expired/invalid auth', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock unauthenticated (PocketBase authStore is invalid)
      mockIsAuthenticated = false;
      vi.mocked(isAuthenticated).mockReturnValue(false);

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      const authIssue = report.issues.find(i => i.type === 'token_expired');
      expect(authIssue).toBeDefined();
      expect(authIssue!.severity).toBe('error');
      expect(authIssue!.message).toContain('expired');
      expect(authIssue!.suggestedAction).toContain('Sign in');
    });

    it('should not report issue when authenticated', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Default: mockIsAuthenticated = true
      const report = await monitor.check();

      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });
  });

  describe('server connectivity check', () => {
    it('should detect server unreachable', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      // Mock PocketBase health check failure
      mockHealthCheck.mockRejectedValue(new Error('Network error'));

      const report = await monitor.check();

      expect(report.healthy).toBe(false);
      const connectivityIssue = report.issues.find(i => i.type === 'server_unreachable');
      expect(connectivityIssue).toBeDefined();
      expect(connectivityIssue!.severity).toBe('error');
      expect(connectivityIssue!.message).toContain('Cannot reach PocketBase server');
    });

    it('should pass when server is reachable', async () => {
      await db.syncMetadata.add(createMockSyncConfig());

      mockHealthCheck.mockResolvedValue({});

      const report = await monitor.check();

      // Verify health check was called via PocketBase SDK
      expect(mockHealthCheck).toHaveBeenCalled();
      expect(report.healthy).toBe(true);
    });
  });

  describe('multiple issues detection', () => {
    it('should detect multiple issues in single check', async () => {
      const now = Date.now();
      dateMock = mockDateNow(now);

      await db.syncMetadata.add(createMockSyncConfig());

      // Setup multiple issues: stale queue + expired auth + unreachable server
      const staleOp = createMockSyncQueueItem({
        timestamp: now - 2 * 60 * 60 * 1000,
      });
      mockQueue.getPending.mockResolvedValue([staleOp]);
      mockIsAuthenticated = false;
      vi.mocked(isAuthenticated).mockReturnValue(false);
      mockHealthCheck.mockRejectedValue(new Error('Network error'));

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
