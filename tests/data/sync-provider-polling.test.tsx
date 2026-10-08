import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSync } from '@/lib/hooks/use-sync';
import { SyncProvider } from '@/lib/sync/sync-provider';
import { isAuthenticated } from '@/lib/sync/pocketbase-client';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getHealthMonitor } from '@/lib/sync/health-monitor';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { getDb } from '@/lib/db';
import type { PBSyncResult } from '@/lib/sync/types';

vi.mock('@/lib/sync/pocketbase-client');
vi.mock('@/lib/sync/sync-coordinator');
vi.mock('@/lib/sync/health-monitor');
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

// The coordinator hands back the same result object on every read, the way the
// real one does between syncs.
const LAST_RESULT: PBSyncResult = { status: 'success' };

const IDLE_STATUS = {
  isRunning: false,
  pendingRequests: 0,
  lastSyncAt: null,
  lastSuccessfulSyncAt: null,
  lastError: null,
  retryCount: 0,
  nextRetryAt: null,
  lastResult: LAST_RESULT,
};

const getStatus = vi.fn();
// Counts renders of a component that reads the sync context. An effect with no
// dependency array runs after every render, so this needs no side effect during
// render. React's Profiler is not an option: it misses re-renders that a context
// change triggers, and this test passed against the unfixed provider with it.
const onConsumerRender = vi.fn();

function SyncConsumer() {
  useSync();
  useEffect(() => {
    onConsumerRender();
  });
  return null;
}

function SyncApp() {
  return (
    <SyncProvider>
      <SyncConsumer />
    </SyncProvider>
  );
}

function setSyncEnabled(enabled: boolean): void {
  vi.mocked(isAuthenticated).mockReturnValue(enabled);
  vi.mocked(getDb).mockReturnValue({
    syncMetadata: {
      get: vi.fn().mockResolvedValue(enabled ? { enabled: true, deviceId: 'device-1' } : null),
    },
  } as unknown as ReturnType<typeof getDb>);
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

// The timer arithmetic of the polls themselves is pinned on the store in
// tests/data/sync/sync-status-store.test.ts. This file keeps the one check that
// needs React: a poll that changes nothing must not re-render a consumer.
describe('SyncProvider polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getStatus.mockReset().mockResolvedValue(IDLE_STATUS);
    vi.mocked(getSyncCoordinator).mockReturnValue({
      getStatus,
      requestSync: vi.fn(),
    } as unknown as ReturnType<typeof getSyncCoordinator>);
    vi.mocked(getHealthMonitor).mockReturnValue({
      check: vi.fn().mockResolvedValue({ healthy: true, issues: [], timestamp: 0 }),
    } as unknown as ReturnType<typeof getHealthMonitor>);
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
    vi.clearAllMocks();
  });

  it('should_not_rerender_consumers_when_a_poll_changes_nothing', async () => {
    setSyncEnabled(true);

    render(<SyncApp />);
    await advance(1000);
    const rendersOnceSettled = onConsumerRender.mock.calls.length;
    // One act() per tick. A single act() would batch every update in the window
    // into one render and hide the per-tick re-render this test is about.
    for (let tick = 0; tick < 10; tick += 1) {
      await advance(500);
    }

    expect(getStatus.mock.calls.length).toBeGreaterThan(10);
    expect(onConsumerRender).toHaveBeenCalledTimes(rendersOnceSettled);
  });
});
