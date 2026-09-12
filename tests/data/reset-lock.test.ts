/**
 * Tests for lib/reset-lock.ts, the reset-pending marker store that keeps GSD
 * locked while Reset Everything runs or after it fails to delete local data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const RESET_PENDING_KEY = 'gsd-reset-pending';

type ResetLockModule = typeof import('@/lib/reset-lock');

/** Import a fresh copy so in-memory lock state never leaks between tests. */
async function loadResetLock(): Promise<ResetLockModule> {
  vi.resetModules();
  return import('@/lib/reset-lock');
}

function makeLocalStorageThrow(): void {
  const denied = () => {
    throw new Error('SecurityError');
  };
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(denied);
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(denied);
  vi.spyOn(window.localStorage, 'removeItem').mockImplementation(denied);
}

function dispatchMarkerEvent(newValue: string | null): void {
  window.dispatchEvent(new StorageEvent('storage', { key: RESET_PENDING_KEY, newValue }));
}

describe('reset lock store', () => {
  beforeEach(() => {
    localStorage.removeItem(RESET_PENDING_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should_report_unlocked_when_no_marker_exists', async () => {
    const { getResetLockSnapshot } = await loadResetLock();

    expect(getResetLockSnapshot()).toBe('unlocked');
  });

  it('should_report_locked_when_a_marker_exists_at_load', async () => {
    localStorage.setItem(RESET_PENDING_KEY, JSON.stringify({ preserveTheme: false }));

    const { getResetLockSnapshot } = await loadResetLock();

    expect(getResetLockSnapshot()).toBe('locked');
  });

  it('should_default_preserve_theme_to_true_when_the_marker_is_malformed', async () => {
    localStorage.setItem(RESET_PENDING_KEY, '{not json');

    const { getResetLockSnapshot, readPendingPreserveTheme } = await loadResetLock();

    expect(getResetLockSnapshot()).toBe('locked');
    expect(readPendingPreserveTheme()).toBe(true);
  });

  it('should_keep_an_in_memory_lock_when_local_storage_throws', async () => {
    const { getResetLockSnapshot, startResetLock, endResetLock } = await loadResetLock();
    makeLocalStorageThrow();

    startResetLock(false);
    const duringRun = getResetLockSnapshot();
    endResetLock(false);

    expect([duringRun, getResetLockSnapshot()]).toEqual(['running', 'locked']);
  });

  it('should_report_unlocked_when_local_storage_reads_throw', async () => {
    const { getResetLockSnapshot } = await loadResetLock();
    makeLocalStorageThrow();

    expect(getResetLockSnapshot()).toBe('unlocked');
  });

  it('should_notify_subscribers_when_another_tab_sets_the_marker', async () => {
    const { getResetLockSnapshot, subscribeToResetLock } = await loadResetLock();
    const onChange = vi.fn();
    const unsubscribe = subscribeToResetLock(onChange);

    const marker = JSON.stringify({ preserveTheme: true });
    localStorage.setItem(RESET_PENDING_KEY, marker);
    dispatchMarkerEvent(marker);
    unsubscribe();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(getResetLockSnapshot()).toBe('locked');
  });

  it('should_ignore_storage_events_for_other_keys', async () => {
    const { subscribeToResetLock } = await loadResetLock();
    const onChange = vi.fn();
    const unsubscribe = subscribeToResetLock(onChange);

    window.dispatchEvent(new StorageEvent('storage', { key: 'gsd-theme', newValue: 'dark' }));
    unsubscribe();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('should_restore_the_marker_when_another_tab_removed_it_during_a_failed_run', async () => {
    const { startResetLock, endResetLock } = await loadResetLock();

    startResetLock(false);
    localStorage.removeItem(RESET_PENDING_KEY);
    endResetLock(false);

    expect(JSON.parse(localStorage.getItem(RESET_PENDING_KEY) ?? 'null')).toEqual({ preserveTheme: false });
  });
});
