import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncStatusStore, type SyncStatusStore } from '@/lib/sync/sync-status-store';
import { isAuthenticated } from '@/lib/sync/pocketbase-client';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';
import { getBackgroundSyncManager } from '@/lib/sync/background-sync';
import { getAutoSyncConfig } from '@/lib/sync/config';
import { subscribe, unsubscribe } from '@/lib/sync/pb-realtime';
import { getDb } from '@/lib/db';
import type { PBSyncResult } from '@/lib/sync/types';

vi.mock('@/lib/sync/pocketbase-client');
vi.mock('@/lib/sync/sync-coordinator');
vi.mock('@/lib/sync/background-sync', () => ({ getBackgroundSyncManager: vi.fn() }));
vi.mock('@/lib/sync/config', () => ({ getAutoSyncConfig: vi.fn() }));
vi.mock('@/lib/sync/pb-realtime', () => ({
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/db');

// Every logger context shares one spy, tagged with its context, so a test can
// prove a failed poll was logged through SYNC_STATUS and nowhere else.
const { warn, getPendingCount } = vi.hoisted(() => ({ warn: vi.fn(), getPendingCount: vi.fn() }));
vi.mock('@/lib/sync/queue', () => ({ getSyncQueue: () => ({ getPendingCount }) }));
vi.mock('@/lib/logger', () => ({
  createLogger: (context: string) => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: (message: string, metadata?: Record<string, unknown>) => warn(context, message, metadata),
    error: vi.fn(),
  }),
}));

const FIVE_SECONDS_MS = 5000;
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
const backgroundSync = {
  isRunning: vi.fn().mockReturnValue(false),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
};
let store: SyncStatusStore;

function setSyncEnabled(enabled: boolean): void {
  vi.mocked(isAuthenticated).mockReturnValue(enabled);
  vi.mocked(getDb).mockReturnValue({
    syncMetadata: {
      get: vi.fn().mockResolvedValue(enabled ? { enabled: true, deviceId: 'device-1' } : null),
    },
  } as unknown as ReturnType<typeof getDb>);
}

async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
}

describe('sync status store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getStatus.mockReset().mockResolvedValue(IDLE_STATUS);
    getPendingCount.mockReset().mockResolvedValue(2);
    vi.mocked(getSyncCoordinator).mockReturnValue({
      getStatus,
      requestSync: vi.fn(),
    } as unknown as ReturnType<typeof getSyncCoordinator>);
    backgroundSync.isRunning.mockReturnValue(false);
    vi.mocked(getBackgroundSyncManager).mockReturnValue(
      backgroundSync as unknown as ReturnType<typeof getBackgroundSyncManager>,
    );
    vi.mocked(getAutoSyncConfig).mockResolvedValue({
      enabled: true,
      intervalMinutes: 2,
      syncOnFocus: true,
      syncOnOnline: true,
      debounceAfterChangeMs: 30000,
    });
    store = createSyncStatusStore();
  });

  afterEach(() => {
    store.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should_read_coordinator_status_once_while_sync_is_disabled', async () => {
    setSyncEnabled(false);

    store.start();
    await advance(FIVE_SECONDS_MS);

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(getAutoSyncConfig).toHaveBeenCalledTimes(1);
  });

  it('should_poll_coordinator_status_every_500_ms_while_sync_is_enabled', async () => {
    setSyncEnabled(true);

    store.start();
    await advance(1000);
    const callsAfterOneSecond = getStatus.mock.calls.length;
    await advance(2000);

    expect(getStatus.mock.calls.length - callsAfterOneSecond).toBe(4);
  });

  it('should_stop_polling_once_sync_is_disabled_again', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(1000);
    const callsAfterOneSecond = getStatus.mock.calls.length;

    setSyncEnabled(false);
    // The enabled check runs every 2 s, so this covers the switch-off.
    await advance(3000);
    const callsAfterSwitchOff = getStatus.mock.calls.length;
    await advance(FIVE_SECONDS_MS);

    expect(callsAfterSwitchOff).toBeGreaterThan(callsAfterOneSecond);
    expect(getStatus).toHaveBeenCalledTimes(callsAfterSwitchOff);
  });

  // The sync button is disabled while isSyncing is true, and it is the only way
  // back to the sign-in dialog. A sync still in flight at sign-out must not
  // leave that flag stuck on.
  it('should_keep_polling_after_sign_out_until_an_in_flight_sync_settles', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(1000);

    getStatus.mockResolvedValue({ ...IDLE_STATUS, isRunning: true });
    setSyncEnabled(false);
    await advance(3000);
    expect(store.getSnapshot().isEnabled).toBe(false);
    expect(store.getSnapshot().isSyncing).toBe(true);

    getStatus.mockResolvedValue(IDLE_STATUS);
    await advance(1000);
    expect(store.getSnapshot().isSyncing).toBe(false);

    const callsOnceSettled = getStatus.mock.calls.length;
    await advance(FIVE_SECONDS_MS);
    expect(getStatus).toHaveBeenCalledTimes(callsOnceSettled);
  });

  it('should_keep_polling_after_sign_out_while_requests_are_still_pending', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(1000);

    getStatus.mockResolvedValue({ ...IDLE_STATUS, pendingRequests: 1 });
    setSyncEnabled(false);
    await advance(3000);
    expect(store.getSnapshot().isEnabled).toBe(false);
    expect(store.getSnapshot().pendingRequests).toBe(1);
    const callsWhilePending = getStatus.mock.calls.length;
    await advance(2000);
    expect(getStatus.mock.calls.length - callsWhilePending).toBe(4);

    getStatus.mockResolvedValue(IDLE_STATUS);
    await advance(1000);
    const callsOnceDrained = getStatus.mock.calls.length;
    await advance(FIVE_SECONDS_MS);
    expect(getStatus).toHaveBeenCalledTimes(callsOnceDrained);
  });

  // React StrictMode mounts, unmounts, and mounts the provider again in
  // development, so stop() must leave nothing armed and the second start()
  // must arm exactly one set of timers.
  it('should_arm_one_set_of_timers_across_start_stop_start', async () => {
    setSyncEnabled(true);
    store.start();
    store.stop();
    store.start();
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    await advance(1000);
    const readsAfterOneSecond = getStatus.mock.calls.length;
    const checksAfterOneSecond = vi.mocked(getDb).mock.calls.length;
    const pendingReadsAfterOneSecond = getPendingCount.mock.calls.length;
    await advance(2000);

    expect(getStatus.mock.calls.length - readsAfterOneSecond).toBe(4);
    expect(vi.mocked(getDb).mock.calls.length - checksAfterOneSecond).toBe(1);
    expect(getPendingCount.mock.calls.length - pendingReadsAfterOneSecond).toBe(1);
  });

  it('should_ignore_a_second_start_while_started', async () => {
    setSyncEnabled(true);
    store.start();
    store.start();
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getDb)).toHaveBeenCalledTimes(1);

    await advance(1000);
    const readsAfterOneSecond = getStatus.mock.calls.length;
    await advance(2000);
    expect(getStatus.mock.calls.length - readsAfterOneSecond).toBe(4);
  });

  // A read that lands after stop() updates the snapshot but must arm nothing,
  // the way a dispatch to an unmounted reducer was dropped before. The next
  // start() then polls for the sync it finds still running.
  it('should_arm_nothing_for_a_read_that_lands_after_stop_and_poll_for_it_on_restart', async () => {
    setSyncEnabled(false);
    let release: (status: typeof IDLE_STATUS) => void = () => {};
    getStatus.mockReturnValueOnce(new Promise<typeof IDLE_STATUS>((resolve) => {
      release = resolve;
    }));
    store.start();
    await advance(0);
    store.stop();

    release({ ...IDLE_STATUS, isRunning: true });
    await advance(0);
    expect(store.getSnapshot().isSyncing).toBe(true);
    const readsAfterStop = getStatus.mock.calls.length;
    await advance(FIVE_SECONDS_MS);
    expect(getStatus).toHaveBeenCalledTimes(readsAfterStop);

    getStatus.mockResolvedValue({ ...IDLE_STATUS, isRunning: true });
    store.start();
    await advance(2000);
    expect(getStatus.mock.calls.length - readsAfterStop).toBe(1 + 4);
  });

  // useSyncExternalStore re-renders a consumer whenever getSnapshot returns a
  // new reference, so a poll that changes nothing must hand back the same one
  // and wake no listener.
  it('should_keep_the_snapshot_reference_and_notify_nobody_when_a_poll_changes_nothing', async () => {
    setSyncEnabled(true);
    const listener = vi.fn();
    store.subscribe(listener);

    store.start();
    await advance(1000);
    const snapshotOnceSettled = store.getSnapshot();
    const notificationsOnceSettled = listener.mock.calls.length;
    await advance(FIVE_SECONDS_MS);

    expect(getStatus.mock.calls.length).toBeGreaterThan(10);
    expect(store.getSnapshot()).toBe(snapshotOnceSettled);
    expect(listener).toHaveBeenCalledTimes(notificationsOnceSettled);
  });

  it('should_notify_each_listener_once_when_a_poll_changes_the_snapshot', async () => {
    setSyncEnabled(true);
    const listener = vi.fn();
    store.subscribe(listener);

    store.start();
    await advance(1000);
    const notificationsOnceSettled = listener.mock.calls.length;
    getStatus.mockResolvedValue({ ...IDLE_STATUS, pendingRequests: 1 });
    await advance(500);

    expect(store.getSnapshot().pendingRequests).toBe(1);
    expect(listener).toHaveBeenCalledTimes(notificationsOnceSettled + 1);
  });

  it('should_stop_notifying_a_listener_after_it_unsubscribes', async () => {
    setSyncEnabled(true);
    const listener = vi.fn();
    const unsubscribeListener = store.subscribe(listener);

    store.start();
    await advance(1000);
    unsubscribeListener();
    const notificationsAtUnsubscribe = listener.mock.calls.length;
    getStatus.mockResolvedValue({ ...IDLE_STATUS, pendingRequests: 1 });
    await advance(500);

    expect(store.getSnapshot().pendingRequests).toBe(1);
    expect(listener).toHaveBeenCalledTimes(notificationsAtUnsubscribe);
  });

  // A status read that fails must be logged and must not escape the timer.
  // Before the guard, the rejection reached the window unhandled, and the
  // global listener showed the generic "An unexpected error occurred" toast.
  it('should_log_a_failed_coordinator_status_read_through_SYNC_STATUS_and_keep_polling', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(1000);

    getStatus.mockRejectedValueOnce(new Error('IndexedDB is closed'));
    await advance(500);

    expect(warn).toHaveBeenCalledWith(
      'SYNC_STATUS',
      'Sync status poll failed',
      expect.objectContaining({ poll: 'coordinator', errorMessage: 'IndexedDB is closed' }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const readsAfterFailure = getStatus.mock.calls.length;
    await advance(1000);
    expect(getStatus.mock.calls.length).toBe(readsAfterFailure + 2);
  });

  it('should_log_a_failed_enabled_check_through_SYNC_STATUS_and_keep_the_last_value', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(1000);
    expect(store.getSnapshot().isEnabled).toBe(true);

    vi.mocked(getDb).mockReturnValueOnce({
      syncMetadata: { get: vi.fn().mockRejectedValue(new Error('IndexedDB is closed')) },
    } as unknown as ReturnType<typeof getDb>);
    // The enabled check runs every 2 s, so this covers one failed read.
    await advance(2000);

    expect(warn).toHaveBeenCalledWith(
      'SYNC_STATUS',
      'Sync status poll failed',
      expect.objectContaining({ poll: 'enabled', errorMessage: 'IndexedDB is closed' }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().isEnabled).toBe(true);
    const checksAfterFailure = vi.mocked(getDb).mock.calls.length;
    await advance(2000);
    expect(vi.mocked(getDb).mock.calls.length).toBe(checksAfterFailure + 1);
  });

  it('should_start_the_sync_services_while_enabled_and_stop_them_with_every_timer_on_stop', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(1000);
    expect(subscribe).toHaveBeenCalledWith('device-1');
    expect(backgroundSync.start).toHaveBeenCalledTimes(1);
    backgroundSync.isRunning.mockReturnValue(true);

    store.stop();
    const readsAtStop = getStatus.mock.calls.length;
    const checksAtStop = vi.mocked(getDb).mock.calls.length;
    const pendingReadsAtStop = getPendingCount.mock.calls.length;
    await advance(FIVE_SECONDS_MS);

    expect(backgroundSync.stop).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalled();
    expect(getStatus).toHaveBeenCalledTimes(readsAtStop);
    expect(vi.mocked(getDb)).toHaveBeenCalledTimes(checksAtStop);
    expect(getPendingCount).toHaveBeenCalledTimes(pendingReadsAtStop);
  });

  // The queue's pending count used to be polled by both useSyncStatus hooks,
  // each on its own 2 s timer. The store reads it once, on the same cadence,
  // only while sync is on.
  it('should_poll_the_pending_count_every_2_s_while_enabled_and_hold_0_once_disabled', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(0);
    expect(getPendingCount).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().pendingCount).toBe(2);

    await advance(4000);
    expect(getPendingCount).toHaveBeenCalledTimes(3);

    getPendingCount.mockResolvedValue(5);
    setSyncEnabled(false);
    // The enabled check runs every 2 s, so this covers the switch-off.
    await advance(2000);
    expect(store.getSnapshot().isEnabled).toBe(false);
    expect(store.getSnapshot().pendingCount).toBe(0);
    const readsAtSwitchOff = getPendingCount.mock.calls.length;
    await advance(FIVE_SECONDS_MS);
    expect(getPendingCount).toHaveBeenCalledTimes(readsAtSwitchOff);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('should_drop_a_pending_count_read_that_lands_after_sync_switched_off', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(0);
    expect(store.getSnapshot().pendingCount).toBe(2);

    let release: (count: number) => void = () => {};
    getPendingCount.mockReturnValueOnce(new Promise<number>((resolve) => {
      release = resolve;
    }));
    // The 2 s tick starts a read that stays open across the switch-off.
    await advance(2000);
    setSyncEnabled(false);
    await advance(2000);
    expect(store.getSnapshot().isEnabled).toBe(false);
    expect(store.getSnapshot().pendingCount).toBe(0);

    release(7);
    await advance(0);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('should_never_read_the_pending_count_while_sync_is_disabled', async () => {
    setSyncEnabled(false);
    store.start();
    await advance(FIVE_SECONDS_MS);

    expect(getPendingCount).not.toHaveBeenCalled();
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('should_log_a_failed_pending_count_read_through_SYNC_STATUS_and_keep_the_last_value', async () => {
    setSyncEnabled(true);
    store.start();
    await advance(0);
    expect(store.getSnapshot().pendingCount).toBe(2);

    getPendingCount.mockRejectedValueOnce(new Error('IndexedDB is closed'));
    await advance(2000);

    expect(warn).toHaveBeenCalledWith(
      'SYNC_STATUS',
      'Sync status poll failed',
      expect.objectContaining({ poll: 'pendingCount', errorMessage: 'IndexedDB is closed' }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().pendingCount).toBe(2);
    const readsAfterFailure = getPendingCount.mock.calls.length;
    await advance(2000);
    expect(getPendingCount.mock.calls.length).toBe(readsAfterFailure + 1);
  });
});
