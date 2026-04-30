import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthMonitor } from '@/lib/sync/health-monitor';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock queue
const mockQueue = {
  getPending: vi.fn().mockResolvedValue([]),
  pruneExhaustedRetries: vi.fn().mockResolvedValue(0),
};
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: () => mockQueue,
}));

// Mock PocketBase client
const mockPb = {
  health: { check: vi.fn().mockResolvedValue({ code: 200 }) },
};
const mockIsAuthenticated = vi.fn().mockReturnValue(true);
vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: () => mockPb,
  isAuthenticated: () => mockIsAuthenticated(),
}));

// Mock database
const mockDb = {
  syncMetadata: {
    get: vi.fn().mockResolvedValue({ enabled: true }),
  },
};
vi.mock('@/lib/db', () => ({
  getDb: () => mockDb,
}));

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new HealthMonitor();
    mockDb.syncMetadata.get.mockResolvedValue({ enabled: true });
    mockIsAuthenticated.mockReturnValue(true);
    mockQueue.getPending.mockResolvedValue([]);
    mockPb.health.check.mockResolvedValue({ code: 200 });
  });

  describe('start/stop', () => {
    it('should start and become active', () => {
      monitor.start();
      expect(monitor.isActive()).toBe(true);
      monitor.stop();
    });

    it('should stop and become inactive', () => {
      monitor.start();
      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });

    it('should be idempotent on start', () => {
      monitor.start();
      monitor.start(); // Should not throw
      expect(monitor.isActive()).toBe(true);
      monitor.stop();
    });

    it('should be idempotent on stop', () => {
      monitor.stop(); // Should not throw even if not started
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('check', () => {
    it('should report healthy when sync is disabled', async () => {
      mockDb.syncMetadata.get.mockResolvedValue({ enabled: false });
      const report = await monitor.check();
      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('should report healthy when all checks pass', async () => {
      const report = await monitor.check();
      expect(report.healthy).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('should detect stale queue operations', async () => {
      const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      mockQueue.getPending.mockResolvedValue([
        { id: 1, taskId: 'task-1', operation: 'update', timestamp: staleTimestamp },
      ]);

      const report = await monitor.check();
      expect(report.healthy).toBe(false);
      const staleIssue = report.issues.find(i => i.type === 'stale_queue');
      expect(staleIssue).toBeDefined();
      expect(staleIssue!.severity).toBe('warning');
    });

    it('should not flag recent queue operations as stale', async () => {
      mockQueue.getPending.mockResolvedValue([
        { id: 1, taskId: 'task-1', operation: 'update', timestamp: Date.now() },
      ]);

      const report = await monitor.check();
      const staleIssue = report.issues.find(i => i.type === 'stale_queue');
      expect(staleIssue).toBeUndefined();
    });

    it('should detect expired auth token', async () => {
      mockIsAuthenticated.mockReturnValue(false);

      const report = await monitor.check();
      expect(report.healthy).toBe(false);
      const authIssue = report.issues.find(i => i.type === 'token_expired');
      expect(authIssue).toBeDefined();
      expect(authIssue!.severity).toBe('error');
    });

    it('should detect unreachable server', async () => {
      mockPb.health.check.mockRejectedValue(new Error('Connection refused'));

      const report = await monitor.check();
      expect(report.healthy).toBe(false);
      const connectIssue = report.issues.find(i => i.type === 'server_unreachable');
      expect(connectIssue).toBeDefined();
    });

    it('should detect multiple issues simultaneously', async () => {
      mockIsAuthenticated.mockReturnValue(false);
      mockPb.health.check.mockRejectedValue(new Error('Connection refused'));

      const report = await monitor.check();
      expect(report.healthy).toBe(false);
      expect(report.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('should include timestamp in report', async () => {
      const before = Date.now();
      const report = await monitor.check();
      expect(report.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should handle check errors gracefully', async () => {
      mockDb.syncMetadata.get.mockRejectedValue(new Error('DB error'));

      const report = await monitor.check();
      expect(report.healthy).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].type).toBe('server_unreachable');
    });
  });
});
