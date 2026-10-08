import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_CONFIG } from '@/lib/constants/sync';

// Both useSyncStatus hooks used to poll the queue's pending count on their own
// timers, and the header hook polled the last sync time as well. The store now
// owns those reads, so the hooks take their values from the sync context and
// make no read of their own.
const { useSync, getPendingCount, getStatus } = vi.hoisted(() => ({
  useSync: vi.fn(),
  getPendingCount: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock('@/lib/hooks/use-sync', () => ({ useSync }));
vi.mock('@/lib/sync/queue', () => ({ getSyncQueue: () => ({ getPendingCount }) }));
vi.mock('@/lib/sync/sync-coordinator', () => ({ getSyncCoordinator: () => ({ getStatus }) }));

import { useSyncStatus as useHeaderSyncStatus } from '@/lib/hooks/use-sync-status';
import { useSyncStatus as useButtonSyncStatus } from '@/components/sync/use-sync-status';
import { useRetryCountdown } from '@/lib/hooks/use-retry-countdown';

const LAST_SYNC_AT = '2026-10-08T12:00:00.000Z';
const NOW = new Date('2026-10-08T12:00:30.000Z').getTime();

function syncContext(overrides: Record<string, unknown> = {}) {
  return {
    isEnabled: true,
    nextRetryAt: null,
    retryCount: 0,
    pendingCount: 3,
    lastSuccessfulSyncAt: LAST_SYNC_AT,
    ...overrides,
  };
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('sync status hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useSync.mockReturnValue(syncContext());
    // Distinct from the context values, so a hook that still reads for itself
    // shows up as a wrong number rather than a lucky match.
    getPendingCount.mockReset().mockResolvedValue(99);
    getStatus.mockReset().mockResolvedValue({ lastSuccessfulSyncAt: '2000-01-01T00:00:00.000Z' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lib/hooks/use-sync-status', () => {
    it('should_take_the_pending_count_and_last_sync_time_from_the_sync_context', async () => {
      const { result } = renderHook(() => useHeaderSyncStatus());
      await advance(SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS * 2);

      expect(result.current.pendingCount).toBe(3);
      expect(result.current.lastSyncTime).toBe(LAST_SYNC_AT);
      expect(getPendingCount).not.toHaveBeenCalled();
      expect(getStatus).not.toHaveBeenCalled();
    });

    it('should_report_no_last_sync_time_while_sync_is_disabled', async () => {
      useSync.mockReturnValue(syncContext({ isEnabled: false, pendingCount: 0 }));

      const { result } = renderHook(() => useHeaderSyncStatus());
      await advance(0);

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.lastSyncTime).toBeNull();
      expect(result.current.pendingCount).toBe(0);
    });

    it('should_count_down_to_the_next_retry_each_second', async () => {
      useSync.mockReturnValue(syncContext({ nextRetryAt: NOW + 3000, retryCount: 1 }));

      const { result } = renderHook(() => useHeaderSyncStatus());
      await advance(0);
      expect(result.current.retryCountdown).toBe(3);

      await advance(SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS);
      expect(result.current.retryCountdown).toBe(2);

      await advance(SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS * 2);
      expect(result.current.retryCountdown).toBeNull();
    });
  });

  describe('components/sync/use-sync-status', () => {
    it('should_take_the_pending_count_from_its_options_and_read_nothing_itself', async () => {
      const { result } = renderHook(() =>
        useButtonSyncStatus({
          isEnabled: true,
          status: 'idle',
          error: null,
          nextRetryAt: null,
          pendingCount: 3,
          onAuthError: vi.fn(),
        }),
      );
      await advance(SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS * 2);

      expect(result.current.pendingCount).toBe(3);
      expect(result.current.tooltip).toBe('3 pending operations');
      expect(getPendingCount).not.toHaveBeenCalled();
    });

    it('should_count_down_to_the_next_retry_each_second', async () => {
      const { result } = renderHook(() =>
        useButtonSyncStatus({
          isEnabled: true,
          status: 'idle',
          error: null,
          nextRetryAt: NOW + 2000,
          pendingCount: 0,
          onAuthError: vi.fn(),
        }),
      );
      await advance(0);
      expect(result.current.retryCountdown).toBe(2);
      expect(result.current.iconType).toBe('clock');

      await advance(SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS * 2);
      expect(result.current.retryCountdown).toBeNull();
      expect(result.current.iconType).toBe('cloud-idle');
    });
  });

  describe('lib/hooks/use-retry-countdown', () => {
    it('should_return_null_without_a_future_retry_time', async () => {
      const { result, rerender } = renderHook(
        ({ nextRetryAt }: { nextRetryAt: number | null }) => useRetryCountdown(nextRetryAt),
        { initialProps: { nextRetryAt: null } },
      );
      expect(result.current).toBeNull();

      rerender({ nextRetryAt: NOW - 1 });
      await advance(0);
      expect(result.current).toBeNull();
    });

    it('should_round_the_seconds_remaining_up_and_tick_once_a_second', async () => {
      const { result } = renderHook(() => useRetryCountdown(NOW + 2500));
      await advance(0);
      expect(result.current).toBe(3);

      await advance(SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS);
      expect(result.current).toBe(2);

      await advance(SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS);
      expect(result.current).toBe(1);

      await advance(SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS);
      expect(result.current).toBeNull();
    });
  });
});
