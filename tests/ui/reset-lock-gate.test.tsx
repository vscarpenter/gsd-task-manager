/**
 * Tests for components/reset-lock-gate.tsx (AC10 to AC16).
 *
 * The lock store runs for real. resetEverything and reloadAfterReset are
 * mocked, so no test resets data or navigates. Task titles come from a task
 * seeded in fake-indexeddb and read through the real useTasks hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDb } from '@/lib/db';
import { useTasks } from '@/lib/use-tasks';
import { endResetLock, startResetLock } from '@/lib/reset-lock';
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
});
