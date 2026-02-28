/**
 * Tests for SyncCoordinator - sync request queuing and deduplication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { SyncCoordinator } from '@/lib/sync/sync-coordinator';
import type { PBSyncResult } from '@/lib/sync/types';

// Mock the PocketBase sync engine
const mockFullSync = vi.fn<(priority: 'user' | 'auto') => Promise<PBSyncResult>>();

vi.mock('@/lib/sync/pb-sync-engine', () => ({
  fullSync: (...args: unknown[]) => mockFullSync(args[0] as 'user' | 'auto'),
}));

// Mock the retry manager
const mockRetryManager = {
  getRetryCount: vi.fn(async () => 0),
  recordSuccess: vi.fn(async () => {}),
  recordFailure: vi.fn(async () => {}),
  shouldRetry: vi.fn(async () => true),
  canSyncNow: vi.fn(async () => true),
  getNextRetryDelay: vi.fn(() => 5000),
};

vi.mock('@/lib/sync/retry-manager', () => ({
  getRetryManager: () => mockRetryManager,
  RetryManager: vi.fn(() => mockRetryManager),
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

    // Initialize sync config with PBSyncConfig fields
    await db.syncMetadata.add({
      key: 'sync_config',
      enabled: true,
      userId: 'user1',
      deviceId: 'device1',
      deviceName: 'Test Device',
      email: 'test@example.com',
      provider: 'google',
      lastSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
    });

    // Clear any pending requests
    coordinator.cancelPending();

    // Reset mocks
    mockFullSync.mockClear();
    mockFullSync.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { status: 'success', pushedCount: 0, pulledCount: 0 };
    });
    mockRetryManager.getRetryCount.mockClear();
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

      // Verify fullSync was called twice
      expect(mockFullSync).toHaveBeenCalledTimes(2);
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
      const calls = mockFullSync.mock.calls;
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

      // Verify fullSync was called twice
      expect(mockFullSync).toHaveBeenCalledTimes(2);

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

      // Verify fullSync was called for each (deduplicated to 2: auto + user)
      expect(mockFullSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('priority handling (user vs auto)', () => {
    it('should pass correct priority to fullSync', async () => {
      await coordinator.requestSync('user');

      expect(mockFullSync).toHaveBeenCalledWith('user');
    });

    it('should pass auto priority by default', async () => {
      await coordinator.requestSync('auto');

      expect(mockFullSync).toHaveBeenCalledWith('auto');
    });

    it('should prioritize user requests over auto in queue', async () => {
      // Start auto sync
      const firstSync = coordinator.requestSync('auto');

      // Queue auto and user requests
      coordinator.requestSync('auto');
      coordinator.requestSync('user');

      await firstSync;

      // The queued sync should be user priority (auto was deduplicated)
      const calls = mockFullSync.mock.calls;
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

    it('should include error in status when sync fails', async () => {
      mockFullSync.mockRejectedValueOnce(new Error('Network failure'));

      await coordinator.requestSync('auto');

      const status = await coordinator.getStatus();

      expect(status.lastResult?.status).toBe('error');
      expect(status.lastError).toBe('Network failure');
    });
  });
});
