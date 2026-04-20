import { renderHook } from '@testing-library/react';

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: () => ({ getPendingCount: async () => 0 }),
}));

vi.mock('@/lib/sync/error-categorizer', () => ({
  isAuthError: () => false,
}));

vi.mock('@/lib/constants/sync', () => ({
  SYNC_CONFIG: {
    PENDING_COUNT_POLL_INTERVAL_MS: 60_000,
    COUNTDOWN_UPDATE_INTERVAL_MS: 60_000,
  },
  SYNC_TOAST_DURATION: { SHORT: 2000, MEDIUM: 4000, LONG: 6000 },
}));

import { useSyncStatus } from '@/components/sync/use-sync-status';

describe('useSyncStatus tooltip — healthy idle', () => {
  const onAuthError = vi.fn();

  it('reads "Synced · Click to sync now" when enabled, idle, and we have a successful sync on record', () => {
    const { result } = renderHook(() =>
      useSyncStatus({
        isEnabled: true,
        status: 'idle',
        error: null,
        nextRetryAt: null,
        onAuthError,
        lastSuccessfulSyncAt: '2026-04-20T00:00:00.000Z',
      })
    );
    expect(result.current.tooltip).toBe('Synced · Click to sync now');
  });

  it('falls back to the generic idle tooltip before the first successful sync', () => {
    const { result } = renderHook(() =>
      useSyncStatus({
        isEnabled: true,
        status: 'idle',
        error: null,
        nextRetryAt: null,
        onAuthError,
        lastSuccessfulSyncAt: null,
      })
    );
    expect(result.current.tooltip).toBe('Sync with cloud');
  });

  it('still reports "Sync not enabled" when sync is disabled even with a stale success timestamp', () => {
    const { result } = renderHook(() =>
      useSyncStatus({
        isEnabled: false,
        status: 'idle',
        error: null,
        nextRetryAt: null,
        onAuthError,
        lastSuccessfulSyncAt: '2026-04-20T00:00:00.000Z',
      })
    );
    expect(result.current.tooltip).toBe('Sync not enabled');
  });
});
