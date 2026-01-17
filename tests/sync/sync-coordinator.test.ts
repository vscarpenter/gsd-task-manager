/**
 * Tests for SyncCoordinator - sync request queuing and deduplication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { SyncCoordinator } from '@/lib/sync/sync-coordinator';

// Create a mock sync engine
const mockSyncFn = vi.fn();
const mockEngine = {
  sync: mockSyncFn,
  isEnabled: vi.fn(async () => true),
  getStatus: vi.fn(async () => ({
    enabled: true,
    lastSyncAt: null,
    pendingCount: 0,
    isRunning: false,
  })),
};

// Mock the sync engine module
vi.mock('@/lib/sync/engine', () => ({
  getSyncEngine: () => mockEngine,
}));

describe('SyncCoordinator', () => {
  let coordinator: SyncCoordinator;
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    // Create a new coordinator instance for each test
    coordinator = new SyncCoordinator();
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

    // Clear any pending requests
    coordinator.cancelPending();
    
    // Reset mock
    mockSyncFn.mockClear();
    mockSyncFn.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { status: 'success' };
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('queuing sync when already running', () => {
    it('should queue sync request when sync is already running', async () => {
      // Start first sync (will take 100ms)
      const firstSync = coordinator.requestSync('auto');
      
      // Immediately check that sync is running
      expect(coordinator.isSyncing()).toBe(true);
      
      // Request second sync while first is running
      const secondSync = coordinator.requestSync('auto');
      
      // Check status shows pending request
      const status = await coordinator.getStatus();
      expect(status.pendingRequests).toBeGreaterThan(0);
      
      // Wait for both to complete
      await Promise.all([firstSync, secondSync]);
      
      // Verify sync engine was called twice
      expect(mockSyncFn).toHaveBeenCalledTimes(2);
    });

    it('should not be syncing after all requests complete', async () => {
      const sync1 = coordinator.requestSync('auto');
      const sync2 = coordinator.requestSync('auto');
      
      await Promise.all([sync1, sync2]);
      
      expect(coordinator.isSyncing()).toBe(false);
      
      const status = await coordinator.getStatus();
      expect(status.pendingRequests).toBe(0);
    });
  });

  describe('deduplicating multiple pending requests', () => {
    it('should deduplicate multiple auto priority requests', async () => {
      // Start first sync
      const firstSync = coordinator.requestSync('auto');
      
      // Queue multiple auto requests
      coordinator.requestSync('auto');
      coordinator.requestSync('auto');
      coordinator.requestSync('auto');
      
      const status = await coordinator.getStatus();
      // Should only have 1 pending request (deduplicated)
      expect(status.pendingRequests).toBe(1);
      
      await firstSync;
    });

    it('should keep user priority over auto priority', async () => {
      // Start first sync
      const firstSync = coordinator.requestSync('auto');
      
      // Queue auto and user requests
      coordinator.requestSync('auto');
      coordinator.requestSync('user');
      coordinator.requestSync('auto');
      
      const status = await coordinator.getStatus();
      // Should only have 1 pending request (user priority)
      expect(status.pendingRequests).toBe(1);
      
      await firstSync;
      
      // Verify the queued sync was executed with user priority
      const calls = mockSyncFn.mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(calls.some((call: any[]) => call[0] === 'user')).toBe(true);
    });
  });

  describe('executing queued sync after completion', () => {
    it('should execute queued sync after current sync completes', async () => {
      // Start first sync
      const firstSync = coordinator.requestSync('auto');
      
      // Queue second sync
      const secondSync = coordinator.requestSync('auto');
      
      // Wait for both to complete
      await Promise.all([firstSync, secondSync]);
      
      // Verify sync was called twice
      expect(mockSyncFn).toHaveBeenCalledTimes(2);
      
      // Verify no pending requests remain
      const status = await coordinator.getStatus();
      expect(status.pendingRequests).toBe(0);
    });

    it('should process multiple queued syncs in order', async () => {
      // Start first sync
      const firstSync = coordinator.requestSync('auto');
      
      // Queue multiple syncs
      const secondSync = coordinator.requestSync('auto');
      const thirdSync = coordinator.requestSync('user');
      
      // Wait for all to complete
      await Promise.all([firstSync, secondSync, thirdSync]);
      
      // Verify sync was called for each (deduplicated to 2: auto + user)
      expect(mockSyncFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('priority handling (user vs auto)', () => {
    it('should pass correct priority to sync engine', async () => {
      await coordinator.requestSync('user');
      
      expect(mockSyncFn).toHaveBeenCalledWith('user');
    });

    it('should pass auto priority by default', async () => {
      await coordinator.requestSync('auto');
      
      expect(mockSyncFn).toHaveBeenCalledWith('auto');
    });

    it('should prioritize user requests over auto in queue', async () => {
      // Start auto sync
      const firstSync = coordinator.requestSync('auto');
      
      // Queue auto and user requests
      coordinator.requestSync('auto');
      coordinator.requestSync('user');
      
      await firstSync;
      
      // The queued sync should be user priority (auto was deduplicated)
      const calls = mockSyncFn.mock.calls;
      const queuedCall = calls[calls.length - 1];
      expect(queuedCall[0]).toBe('user');
    });
  });

  describe('cancelPending', () => {
    it('should clear all pending requests', async () => {
      // Start first sync
      const firstSync = coordinator.requestSync('auto');
      
      // Queue multiple requests
      coordinator.requestSync('auto');
      coordinator.requestSync('user');
      
      let status = await coordinator.getStatus();
      expect(status.pendingRequests).toBeGreaterThan(0);
      
      // Cancel pending
      coordinator.cancelPending();
      
      status = await coordinator.getStatus();
      expect(status.pendingRequests).toBe(0);
      
      await firstSync;
    });
  });

  describe('getStatus', () => {
    it('should return correct status when idle', async () => {
      const status = await coordinator.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.pendingRequests).toBe(0);
    });

    it('should return correct status when syncing', async () => {
      const syncPromise = coordinator.requestSync('auto');
      
      const status = await coordinator.getStatus();
      
      expect(status.isRunning).toBe(true);
      
      await syncPromise;
    });

    it('should include last result in status', async () => {
      await coordinator.requestSync('auto');
      
      const status = await coordinator.getStatus();
      
      expect(status.lastResult).toBeDefined();
      expect(status.lastResult?.status).toBe('success');
    });
  });
});
