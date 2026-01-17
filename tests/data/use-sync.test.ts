import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSync } from '@/lib/hooks/use-sync';
import { getSyncEngine } from '@/lib/sync/engine';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getHealthMonitor } from '@/lib/sync/health-monitor';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
// Type import used for documentation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SyncResult } from '@/lib/sync/types';

// Mock the sync modules
vi.mock('@/lib/sync/engine');
vi.mock('@/lib/sync/sync-coordinator');
vi.mock('@/lib/sync/health-monitor');
vi.mock('@/lib/sync/background-sync', () => ({
  getBackgroundSyncManager: vi.fn(),
}));
vi.mock('@/lib/sync/config', () => ({
  getAutoSyncConfig: vi.fn(),
}));

describe('useSync', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockEngine: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCoordinator: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHealthMonitor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBackgroundSyncManager: any;

  const flushAsync = async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  beforeEach(() => {
    // Setup mock engine
    mockEngine = {
      isEnabled: vi.fn().mockResolvedValue(false),
      sync: vi.fn().mockResolvedValue({ status: 'success' }),
    };
    vi.mocked(getSyncEngine).mockReturnValue(mockEngine);

    // Setup mock coordinator
    mockCoordinator = {
      requestSync: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: null,
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: null,
      }),
    };
    vi.mocked(getSyncCoordinator).mockReturnValue(mockCoordinator);

    // Setup mock health monitor
    mockHealthMonitor = {
      isActive: vi.fn().mockReturnValue(false),
      start: vi.fn(),
      stop: vi.fn(),
      check: vi.fn().mockResolvedValue({
        healthy: true,
        issues: [],
        timestamp: Date.now(),
      }),
    };
    vi.mocked(getHealthMonitor).mockReturnValue(mockHealthMonitor);

    mockBackgroundSyncManager = {
      isRunning: vi.fn().mockReturnValue(false),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    };
    vi.mocked(getBackgroundSyncManager).mockReturnValue(mockBackgroundSyncManager);

    vi.mocked(getAutoSyncConfig).mockResolvedValue({
      enabled: true,
      intervalMinutes: 2,
      syncOnFocus: true,
      syncOnOnline: true,
      debounceAfterChangeMs: 30000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useSync());

      expect(result.current.isSyncing).toBe(false);
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBe(null);
      expect(result.current.lastResult).toBe(null);
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.pendingRequests).toBe(0);
      expect(result.current.nextRetryAt).toBe(null);
      expect(result.current.retryCount).toBe(0);
    });

    it('should check if sync is enabled on mount', async () => {
      renderHook(() => useSync());

      await flushAsync();

      expect(mockEngine.isEnabled).toHaveBeenCalled();
    });

    it('should start health monitor when sync is enabled', async () => {
      mockEngine.isEnabled.mockResolvedValue(true);

      renderHook(() => useSync());

      await flushAsync();

      expect(mockHealthMonitor.start).toHaveBeenCalled();
    });

    it('should not start health monitor when sync is disabled', async () => {
      mockEngine.isEnabled.mockResolvedValue(false);

      renderHook(() => useSync());

      await flushAsync();

      expect(mockHealthMonitor.start).not.toHaveBeenCalled();
    });
  });

  describe('sync state updates', () => {
    it('should update isEnabled when sync becomes enabled', async () => {
      mockEngine.isEnabled.mockResolvedValue(false);
      const { result } = renderHook(() => useSync());

      await flushAsync();
      expect(result.current.isEnabled).toBe(false);
    });

    it('should poll coordinator status', async () => {
      renderHook(() => useSync());

      await flushAsync();

      expect(mockCoordinator.getStatus).toHaveBeenCalled();
    });

    it('should update UI state from coordinator status', async () => {
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: true,
        pendingRequests: 3,
        lastSyncAt: Date.now(),
        lastError: null,
        retryCount: 2,
        nextRetryAt: Date.now() + 5000,
        lastResult: { status: 'success' },
      });

      const { result } = renderHook(() => useSync());

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
      });

      expect(result.current.pendingRequests).toBe(3);
      expect(result.current.retryCount).toBe(2);
      expect(result.current.nextRetryAt).not.toBe(null);
    });
  });

  describe('manual sync trigger', () => {
    it('should trigger sync when sync() is called', async () => {
      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.sync();
      });

      expect(mockCoordinator.requestSync).toHaveBeenCalledWith('user');
    });

    it('should update status to success after successful sync', async () => {
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: Date.now(),
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: { status: 'success' },
      });

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('success');
      expect(result.current.lastResult?.status).toBe('success');
    });

    it('should clear error after successful sync', async () => {
      const { result } = renderHook(() => useSync());

      // Set error state
      mockCoordinator.requestSync.mockRejectedValueOnce(new Error('Failed'));
      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.error).toBe('Failed');

      // Successful sync clears error
      mockCoordinator.requestSync.mockResolvedValueOnce(undefined);
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: Date.now(),
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: { status: 'success' },
      });

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('error handling', () => {
    it('should handle sync errors from coordinator', async () => {
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: Date.now(),
        lastError: 'Network error',
        retryCount: 1,
        nextRetryAt: null,
        lastResult: { status: 'error', error: 'Network error' },
      });

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
      expect(result.current.lastResult?.status).toBe('error');
    });

    it('should handle sync exceptions', async () => {
      mockCoordinator.requestSync.mockRejectedValue(new Error('Connection failed'));

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Connection failed');
    });

    it('should handle conflict status', async () => {
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: Date.now(),
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: { status: 'conflict', conflicts: [] },
      });

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('conflict');
    });

    it('should recover from error state on successful sync', async () => {
      const { result } = renderHook(() => useSync());

      // First sync fails
      mockCoordinator.requestSync.mockRejectedValueOnce(new Error('Network error'));
      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');

      // Second sync succeeds
      mockCoordinator.requestSync.mockResolvedValueOnce(undefined);
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: Date.now(),
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: { status: 'success' },
      });

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('success');
      expect(result.current.error).toBe(null);
    });
  });

  describe('health monitoring', () => {
    it('should start health monitor when sync is enabled', async () => {
      mockEngine.isEnabled.mockResolvedValue(true);

      renderHook(() => useSync());

      await flushAsync();

      expect(mockHealthMonitor.start).toHaveBeenCalled();
    });

    it('should not start health monitor when sync is disabled', async () => {
      mockEngine.isEnabled.mockResolvedValue(false);

      renderHook(() => useSync());

      await flushAsync();

      expect(mockHealthMonitor.start).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should stop health monitor on unmount', async () => {
      mockEngine.isEnabled.mockResolvedValue(true);
      mockHealthMonitor.isActive.mockReturnValue(true);

      const { unmount } = renderHook(() => useSync());

      await flushAsync();

      unmount();

      expect(mockHealthMonitor.stop).toHaveBeenCalled();
    });

    it('should clear intervals on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useSync());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('state transitions', () => {
    it('should transition from idle to success', async () => {
      mockCoordinator.getStatus.mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: Date.now(),
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: { status: 'success' },
      });

      const { result } = renderHook(() => useSync());

      expect(result.current.status).toBe('idle');

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('success');
    });

    it('should transition from idle to error', async () => {
      mockCoordinator.requestSync.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useSync());

      expect(result.current.status).toBe('idle');

      await act(async () => {
        await result.current.sync();
      });

      expect(result.current.status).toBe('error');
    });
  });

  describe('polling behavior', () => {
    it('should check sync enabled status on mount', async () => {
      renderHook(() => useSync());

      await flushAsync();

      expect(mockEngine.isEnabled).toHaveBeenCalled();
    });

    it('should poll coordinator status on mount', async () => {
      renderHook(() => useSync());

      await flushAsync();

      expect(mockCoordinator.getStatus).toHaveBeenCalled();
    });
  });

  describe('sync function behavior', () => {
    it('should provide a sync function', () => {
      const { result } = renderHook(() => useSync());

      expect(typeof result.current.sync).toBe('function');
    });

    it('should expose all expected properties', () => {
      const { result } = renderHook(() => useSync());

      expect(result.current).toHaveProperty('sync');
      expect(result.current).toHaveProperty('isSyncing');
      expect(result.current).toHaveProperty('lastResult');
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isEnabled');
      expect(result.current).toHaveProperty('pendingRequests');
      expect(result.current).toHaveProperty('nextRetryAt');
      expect(result.current).toHaveProperty('retryCount');
    });
  });
});
