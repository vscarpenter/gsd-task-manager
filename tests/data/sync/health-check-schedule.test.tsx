import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncProvider } from '@/lib/sync/sync-provider';
import { HealthMonitor } from '@/lib/sync/health-monitor';
import { isAuthenticated } from '@/lib/sync/pocketbase-client';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { getDb } from '@/lib/db';
import { SYNC_CONFIG } from '@/lib/constants/sync';

vi.mock('@/lib/sync/pocketbase-client');
vi.mock('@/lib/sync/sync-coordinator');
vi.mock('@/lib/sync/background-sync', () => ({ getBackgroundSyncManager: vi.fn() }));
vi.mock('@/lib/sync/config', () => ({ getAutoSyncConfig: vi.fn() }));
vi.mock('@/lib/sync/pb-realtime', () => ({
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/db');
vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: () => ({ getPendingCount: vi.fn().mockResolvedValue(0) }),
}));

// The health monitor stays real here. Only check() is stubbed, so the test
// counts who schedules a check, not what a check reads.
const HEALTHY = { healthy: true, issues: [], timestamp: 0 };

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('health check schedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue({
      syncMetadata: {
        get: vi.fn().mockResolvedValue({ enabled: true, deviceId: 'device-1' }),
      },
    } as unknown as ReturnType<typeof getDb>);
    vi.mocked(getSyncCoordinator).mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        isRunning: false,
        pendingRequests: 0,
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        lastError: null,
        retryCount: 0,
        nextRetryAt: null,
        lastResult: null,
      }),
      requestSync: vi.fn(),
    } as unknown as ReturnType<typeof getSyncCoordinator>);
    vi.mocked(getBackgroundSyncManager).mockReturnValue({
      isRunning: vi.fn().mockReturnValue(false),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    } as unknown as ReturnType<typeof getBackgroundSyncManager>);
    vi.mocked(getAutoSyncConfig).mockResolvedValue({
      enabled: true,
      intervalMinutes: 2,
      syncOnFocus: true,
      syncOnOnline: true,
      debounceAfterChangeMs: 30000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // The provider and the sync button used to run their own checks, the
  // provider's at 1 s and the button's at 10 s after enable. The store runs the
  // one schedule now, so with the provider mounted exactly these checks run.
  it('should_run_health_checks_only_on_the_stores_schedule_while_sync_is_enabled', async () => {
    const check = vi.spyOn(HealthMonitor.prototype, 'check').mockResolvedValue(HEALTHY);

    render(<SyncProvider><div /></SyncProvider>);
    // Let the enabled check publish isEnabled before the clock moves, so the
    // store arms its health timers at t = 0 and the arithmetic below holds.
    await advance(0);
    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS - 1);
    expect(check).toHaveBeenCalledTimes(0);

    await advance(1);
    expect(check).toHaveBeenCalledTimes(1);

    await advance(SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS - SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);
    expect(check).toHaveBeenCalledTimes(2);

    await advance(SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('should_run_no_health_check_while_sync_is_disabled', async () => {
    const check = vi.spyOn(HealthMonitor.prototype, 'check').mockResolvedValue(HEALTHY);
    vi.mocked(isAuthenticated).mockReturnValue(false);

    render(<SyncProvider><div /></SyncProvider>);
    await advance(0);
    await advance(SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS + SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    expect(check).toHaveBeenCalledTimes(0);
  });
});
