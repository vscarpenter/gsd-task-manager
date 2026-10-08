import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';

// A poll that fails must log through SYNC_STATUS and keep the value it last
// published. Before this guard, the rejection escaped the effect and reached
// the window as an unhandled rejection, which the global listener turned into
// the generic "An unexpected error occurred" toast.
const { warn, createLogger, useSync, getPendingCount, getStatus } = vi.hoisted(() => {
  const warn = vi.fn();
  const createLogger = vi.fn((context: string) => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: (message: string, metadata?: Record<string, unknown>) => warn(context, message, metadata),
    error: vi.fn(),
  }));
  return {
    warn,
    createLogger,
    useSync: vi.fn(),
    getPendingCount: vi.fn(),
    getStatus: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({ createLogger }));
vi.mock('@/lib/hooks/use-sync', () => ({ useSync }));
vi.mock('@/lib/sync/queue', () => ({ getSyncQueue: () => ({ getPendingCount }) }));
vi.mock('@/lib/sync/sync-coordinator', () => ({ getSyncCoordinator: () => ({ getStatus }) }));

import { useSyncStatus as useHeaderSyncStatus } from '@/lib/hooks/use-sync-status';
import { useSyncStatus as useButtonSyncStatus } from '@/components/sync/use-sync-status';

const LAST_SYNC_AT = '2026-10-08T12:00:00.000Z';
const READ_FAILURE = new Error('IndexedDB is closed');

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function expectLoggedFailure(poll: string): void {
  expect(warn).toHaveBeenCalledWith(
    'SYNC_STATUS',
    'Sync status poll failed',
    expect.objectContaining({ poll, errorMessage: READ_FAILURE.message }),
  );
}

describe('sync status hook polls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    warn.mockClear();
    useSync.mockReturnValue({ isEnabled: true, nextRetryAt: null, retryCount: 0 });
    getPendingCount.mockReset().mockResolvedValue(2);
    getStatus.mockReset().mockResolvedValue({ lastSuccessfulSyncAt: LAST_SYNC_AT });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lib/hooks/use-sync-status', () => {
    it('should_log_a_failed_last_sync_read_and_keep_the_last_value', async () => {
      const { result } = renderHook(() => useHeaderSyncStatus());
      await advance(0);
      expect(result.current.lastSyncTime).toBe(LAST_SYNC_AT);

      getStatus.mockRejectedValueOnce(READ_FAILURE);
      await advance(SYNC_CONFIG.SYNC_STATUS_POLL_MS);

      expectLoggedFailure('lastSync');
      expect(result.current.lastSyncTime).toBe(LAST_SYNC_AT);

      const readsAfterFailure = getStatus.mock.calls.length;
      await advance(SYNC_CONFIG.SYNC_STATUS_POLL_MS);
      expect(getStatus.mock.calls.length).toBe(readsAfterFailure + 1);
    });

    it('should_log_a_failed_pending_count_read_and_keep_the_last_value', async () => {
      const { result } = renderHook(() => useHeaderSyncStatus());
      await advance(0);
      expect(result.current.pendingCount).toBe(2);

      getPendingCount.mockRejectedValueOnce(READ_FAILURE);
      await advance(SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS);

      expectLoggedFailure('pendingCount');
      expect(result.current.pendingCount).toBe(2);

      const readsAfterFailure = getPendingCount.mock.calls.length;
      await advance(SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS);
      expect(getPendingCount.mock.calls.length).toBe(readsAfterFailure + 1);
    });
  });

  describe('components/sync/use-sync-status', () => {
    it('should_log_a_failed_pending_count_read_and_keep_the_last_value', async () => {
      const { result } = renderHook(() =>
        useButtonSyncStatus({
          isEnabled: true,
          status: 'idle',
          error: null,
          nextRetryAt: null,
          onAuthError: vi.fn(),
        }),
      );
      await advance(0);
      expect(result.current.pendingCount).toBe(2);

      getPendingCount.mockRejectedValueOnce(READ_FAILURE);
      await advance(SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS);

      expectLoggedFailure('pendingCount');
      expect(result.current.pendingCount).toBe(2);

      const readsAfterFailure = getPendingCount.mock.calls.length;
      await advance(SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS);
      expect(getPendingCount.mock.calls.length).toBe(readsAfterFailure + 1);
    });
  });
});
