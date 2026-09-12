/**
 * Tests for components/reset-lock-gate.tsx (AC10 to AC16, AC20, and AC22).
 *
 * The lock store runs for real. resetEverything and reloadAfterReset are
 * mocked, so no test resets data or navigates. Task titles come from a task
 * seeded in fake-indexeddb and read through the real useTasks hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDb } from '@/lib/db';
import { useTasks } from '@/lib/use-tasks';
import { endResetLock, startResetLock } from '@/lib/reset-lock';
import { UI_TIMING } from '@/lib/constants/ui';
import { createMockTask } from '@/tests/fixtures';

vi.mock('@/lib/reset-everything', () => ({
  resetEverything: vi.fn(),
  reloadAfterReset: vi.fn(),
}));

import { reloadAfterReset, resetEverything } from '@/lib/reset-everything';
import { ResetLockGate } from '@/components/reset-lock-gate';

const RESET_PENDING_KEY = 'gsd-reset-pending';
const LOCKED_HEADING = "Reset didn't finish";
const TASK_TITLE = 'Private task title';

function TaskTitles() {
  const { all } = useTasks();
  return (
    <ul>
      {all.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}

function setMarker(preserveTheme: boolean): string {
  const marker = JSON.stringify({ preserveTheme });
  localStorage.setItem(RESET_PENDING_KEY, marker);
  return marker;
}

function dispatchMarkerEvent(newValue: string | null): void {
  window.dispatchEvent(new StorageEvent('storage', { key: RESET_PENDING_KEY, newValue }));
}

function renderGate() {
  return render(
    <ResetLockGate>
      <p>Matrix content</p>
    </ResetLockGate>,
  );
}

/** Render the gate around children that count their own renders. */
function renderGateWithWatchedChildren() {
  const renderChildren = vi.fn();
  function WatchedChildren() {
    renderChildren();
    return <p>Matrix content</p>;
  }
  render(
    <ResetLockGate>
      <WatchedChildren />
    </ResetLockGate>,
  );
  return renderChildren;
}

function mockRetryResult(failedSteps: Array<'sync-sign-out' | 'local-data' | 'browser-storage'>, errors: string[]) {
  vi.mocked(resetEverything).mockResolvedValueOnce({
    success: failedSteps.length === 0,
    clearedTables: [],
    clearedLocalStorage: [],
    errors,
    failedSteps,
  });
}

describe('ResetLockGate', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // The store is a module singleton, so release any lock a previous test left behind.
    endResetLock(true);
    localStorage.removeItem(RESET_PENDING_KEY);
    await getDb().tasks.clear();
    await getDb().tasks.put(createMockTask({ id: 'task-private', title: TASK_TITLE }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should_render_children_when_no_reset_is_pending', async () => {
    render(
      <ResetLockGate>
        <TaskTitles />
      </ResetLockGate>,
    );

    expect(await screen.findByText(TASK_TITLE)).toBeInTheDocument();
  });

  it('should_show_the_lock_screen_and_hide_task_titles_when_a_reset_is_pending', async () => {
    setMarker(true);
    const renderTitles = vi.fn();
    function WatchedTaskTitles() {
      renderTitles();
      return <TaskTitles />;
    }

    render(
      <ResetLockGate>
        <WatchedTaskTitles />
      </ResetLockGate>,
    );

    expect(await screen.findByRole('heading', { name: LOCKED_HEADING })).toBeInTheDocument();
    expect(renderTitles).not.toHaveBeenCalled();
    expect(screen.queryByText(TASK_TITLE)).not.toBeInTheDocument();
  });

  it('should_show_progress_without_buttons_while_a_reset_runs', () => {
    renderGate();

    act(() => startResetLock(true));

    expect(screen.getByText('Deleting your data…')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('should_retry_with_the_stored_theme_choice_and_reload_on_success', async () => {
    setMarker(false);
    mockRetryResult([], []);
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(resetEverything).toHaveBeenCalledWith({ preserveTheme: false });
    await waitFor(() => expect(reloadAfterReset).toHaveBeenCalledTimes(1));
  });

  it('should_stay_locked_and_announce_the_error_when_retry_fails', async () => {
    setMarker(true);
    mockRetryResult(['local-data'], ['IndexedDB: tasks clear failed', 'IndexedDB delete: another open tab is blocking it']);
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('another open tab is blocking it'));
    expect(screen.getByRole('heading', { name: LOCKED_HEADING })).toBeInTheDocument();
    expect(reloadAfterReset).not.toHaveBeenCalled();
  });

  it('should_stay_locked_and_announce_the_error_when_retry_throws', async () => {
    setMarker(true);
    vi.mocked(resetEverything).mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('IndexedDB unavailable'));
    expect(screen.getByRole('heading', { name: LOCKED_HEADING })).toBeInTheDocument();
  });

  it('should_offer_no_control_except_try_again', () => {
    setMarker(true);
    const { container } = renderGate();

    const controls = container.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');

    expect([...controls].map((control) => control.textContent)).toEqual(['Try again']);
  });

  it('should_lock_when_another_tab_sets_the_marker', () => {
    renderGate();

    act(() => dispatchMarkerEvent(setMarker(true)));

    expect(screen.getByRole('heading', { name: LOCKED_HEADING })).toBeInTheDocument();
    expect(screen.queryByText('Matrix content')).not.toBeInTheDocument();
  });

  it('should_reload_when_another_tab_removes_the_marker', () => {
    setMarker(true);
    renderGate();

    act(() => {
      localStorage.removeItem(RESET_PENDING_KEY);
      dispatchMarkerEvent(null);
    });

    expect(reloadAfterReset).toHaveBeenCalledTimes(1);
  });

  it('should_keep_the_lock_screen_and_reload_after_the_delay_when_a_local_reset_unlocks', () => {
    vi.useFakeTimers();
    const renderChildren = renderGateWithWatchedChildren();
    act(() => startResetLock(true));
    const rendersBeforeUnlock = renderChildren.mock.calls.length;

    act(() => endResetLock(true));
    act(() => {
      vi.advanceTimersByTime(UI_TIMING.RESET_RELOAD_DELAY_MS - 1);
    });
    const reloadsBeforeDelay = vi.mocked(reloadAfterReset).mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(renderChildren).toHaveBeenCalledTimes(rendersBeforeUnlock);
    expect(screen.getByText('Deleting your data…')).toBeInTheDocument();
    expect([reloadsBeforeDelay, vi.mocked(reloadAfterReset).mock.calls.length]).toEqual([0, 1]);
  });

  it('should_reload_without_remounting_the_app_when_another_tab_unlocks', () => {
    vi.useFakeTimers();
    setMarker(true);
    const renderChildren = renderGateWithWatchedChildren();

    act(() => {
      localStorage.removeItem(RESET_PENDING_KEY);
      dispatchMarkerEvent(null);
    });
    act(() => {
      vi.advanceTimersByTime(UI_TIMING.RESET_RELOAD_DELAY_MS);
    });

    expect(renderChildren).not.toHaveBeenCalled();
    expect(reloadAfterReset).toHaveBeenCalledTimes(1);
  });

  it('should_reload_when_the_store_unlocks_before_the_gate_hears_the_storage_event', () => {
    // In a browser the store's storage listener runs first, and React re-renders at the
    // microtask checkpoint after it. That removes the gate's own listener before the
    // browser calls it. Ending the lock through the store alone reproduces that order.
    setMarker(true);
    const renderChildren = renderGateWithWatchedChildren();

    act(() => endResetLock(true));

    expect(renderChildren).not.toHaveBeenCalled();
    expect(reloadAfterReset).toHaveBeenCalledTimes(1);
  });

  it('should_reload_a_tab_whose_own_reset_failed_when_another_tab_removes_the_marker', () => {
    renderGate();
    act(() => startResetLock(true));
    act(() => endResetLock(false));

    act(() => {
      localStorage.removeItem(RESET_PENDING_KEY);
      dispatchMarkerEvent(null);
    });

    expect(screen.getByRole('heading', { name: LOCKED_HEADING })).toBeInTheDocument();
    expect(reloadAfterReset).toHaveBeenCalledTimes(1);
  });

  it('should_name_the_lock_screen_by_its_visible_message', () => {
    renderGate();

    act(() => startResetLock(true));
    expect(screen.getByRole('main', { name: 'Deleting your data…' })).toBeInTheDocument();

    act(() => endResetLock(false));
    expect(screen.getByRole('main', { name: LOCKED_HEADING })).toBeInTheDocument();
  });

  it('should_move_focus_to_the_locked_message_when_a_reset_fails_here', () => {
    renderGate();
    act(() => startResetLock(true));
    // A closing dialog returns focus to its unmounted trigger, which leaves focus on the body.
    (document.activeElement as HTMLElement | null)?.blur();

    act(() => endResetLock(false));

    expect(document.activeElement).toBe(screen.getByRole('main', { name: LOCKED_HEADING }));
  });

  it('should_replace_try_again_with_progress_as_soon_as_a_retry_starts', async () => {
    setMarker(true);
    vi.mocked(resetEverything).mockImplementationOnce(() => {
      startResetLock(true);
      return new Promise<never>(() => {});
    });
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Deleting your data…')).toBeInTheDocument();
  });
});
