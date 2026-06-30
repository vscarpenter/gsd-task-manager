/**
 * Tests for the TaskTimer component (compact + full variants, running state).
 * Consolidated from the former gap-closing.test.tsx and more-function-coverage.test.tsx
 * padding files (finding F2.1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTask } from "@/tests/fixtures";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockHasRunningTimer = vi.fn().mockReturnValue(false);
const mockGetRunningEntry = vi.fn().mockReturnValue(undefined);
const mockFormatTimeSpent = vi.fn((m: number) => `${m}m`);
const mockIsTaskSnoozed = vi.fn().mockReturnValue(false);
const mockGetRemainingSnoozeMinutes = vi.fn().mockReturnValue(0);

vi.mock("@/lib/tasks", () => ({
  hasRunningTimer: (...args: unknown[]) => mockHasRunningTimer(...args),
  getRunningEntry: (...args: unknown[]) => mockGetRunningEntry(...args),
  formatTimeSpent: (...args: unknown[]) => mockFormatTimeSpent(...args),
  isTaskSnoozed: (...args: unknown[]) => mockIsTaskSnoozed(...args),
  getRemainingSnoozeMinutes: (...args: unknown[]) =>
    mockGetRemainingSnoozeMinutes(...args),
}));

const noopHandlers = {
  onStartTimer: vi.fn().mockResolvedValue(undefined),
  onStopTimer: vi.fn().mockResolvedValue(undefined),
};

describe("TaskTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRunningTimer.mockReturnValue(false);
    mockGetRunningEntry.mockReturnValue(undefined);
  });

  it("renders the full variant with a start button and tracked time", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(<TaskTimer task={createMockTask({ timeSpent: 15 })} {...noopHandlers} />);

    expect(screen.getByLabelText(/start timer/i)).toBeInTheDocument();
    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  it("renders the compact variant with a Track label when no time is tracked", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(
      <TaskTimer task={createMockTask({ timeSpent: 0 })} compact {...noopHandlers} />
    );

    expect(screen.getByText("Track")).toBeInTheDocument();
  });

  it("renders the compact variant with the tracked time when timeSpent > 0", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(
      <TaskTimer task={createMockTask({ timeSpent: 30 })} compact {...noopHandlers} />
    );

    expect(screen.getByText("30m")).toBeInTheDocument();
  });

  it("renders a stop button when a timer is running", async () => {
    mockHasRunningTimer.mockReturnValue(true);
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockGetRunningEntry.mockReturnValue({ id: "entry-1", startedAt: tenMinAgo });

    const { TaskTimer } = await import("@/components/task-timer");

    render(
      <TaskTimer
        task={createMockTask({
          timeSpent: 30,
          timeEntries: [{ id: "entry-1", startedAt: tenMinAgo }],
        })}
        {...noopHandlers}
      />
    );

    expect(screen.getByLabelText(/stop timer/i)).toBeInTheDocument();
  });

  it("renders both tracked and estimated time when an estimate is set", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(
      <TaskTimer
        task={createMockTask({ timeSpent: 120, estimatedMinutes: 60 })}
        {...noopHandlers}
      />
    );

    expect(screen.getByText("120m")).toBeInTheDocument();
    expect(screen.getByText("60m")).toBeInTheDocument();
  });

  it("calls onStartTimer when the play button is clicked", async () => {
    const onStartTimer = vi.fn().mockResolvedValue(undefined);
    const { TaskTimer } = await import("@/components/task-timer");
    const user = userEvent.setup();

    render(
      <TaskTimer
        task={createMockTask({ timeSpent: 0 })}
        onStartTimer={onStartTimer}
        onStopTimer={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByLabelText(/start timer/i));
    expect(onStartTimer).toHaveBeenCalledWith("test-task-1");
  });

  it("calls onStopTimer when the pause button is clicked", async () => {
    mockHasRunningTimer.mockReturnValue(true);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockGetRunningEntry.mockReturnValue({ id: "entry-1", startedAt: fiveMinAgo });

    const onStopTimer = vi.fn().mockResolvedValue(undefined);
    const { TaskTimer } = await import("@/components/task-timer");
    const user = userEvent.setup();

    render(
      <TaskTimer
        task={createMockTask({
          timeSpent: 10,
          timeEntries: [{ id: "entry-1", startedAt: fiveMinAgo }],
        })}
        onStartTimer={vi.fn().mockResolvedValue(undefined)}
        onStopTimer={onStopTimer}
      />
    );

    await user.click(screen.getByLabelText(/stop timer/i));
    expect(onStopTimer).toHaveBeenCalledWith("test-task-1");
  });

  describe("elapsed time display", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("derives the running elapsed time from the started-at timestamp", async () => {
      const baseNow = new Date("2026-06-30T12:00:00.000Z").getTime();
      vi.useFakeTimers();
      vi.setSystemTime(baseNow);

      const startedAt = new Date(baseNow - 90 * 1000).toISOString(); // 1:30 ago
      mockHasRunningTimer.mockReturnValue(true);
      mockGetRunningEntry.mockReturnValue({ id: "entry-1", startedAt });

      const { TaskTimer } = await import("@/components/task-timer");

      render(
        <TaskTimer
          task={createMockTask({
            timeSpent: 0,
            timeEntries: [{ id: "entry-1", startedAt }],
          })}
          {...noopHandlers}
        />
      );

      // 90 seconds elapsed renders as mm:ss.
      expect(screen.getByText("01:30")).toBeInTheDocument();
    });

    it("advances the elapsed display as the clock ticks", async () => {
      const baseNow = new Date("2026-06-30T12:00:00.000Z").getTime();
      vi.useFakeTimers();
      vi.setSystemTime(baseNow);

      const startedAt = new Date(baseNow - 5 * 1000).toISOString(); // 0:05 ago
      mockHasRunningTimer.mockReturnValue(true);
      mockGetRunningEntry.mockReturnValue({ id: "entry-1", startedAt });

      const { TaskTimer } = await import("@/components/task-timer");

      render(
        <TaskTimer
          task={createMockTask({
            timeSpent: 0,
            timeEntries: [{ id: "entry-1", startedAt }],
          })}
          {...noopHandlers}
        />
      );

      expect(screen.getByText("00:05")).toBeInTheDocument();

      // Advancing fake timers also advances the fake system clock, so each
      // interval tick reads a later Date.now() and the derived elapsed grows.
      act(() => {
        vi.advanceTimersByTime(3 * 1000);
      });

      expect(screen.getByText("00:08")).toBeInTheDocument();
    });

    it("shows no running elapsed display when the timer is stopped", async () => {
      mockHasRunningTimer.mockReturnValue(false);
      mockGetRunningEntry.mockReturnValue(undefined);

      const { TaskTimer } = await import("@/components/task-timer");

      render(<TaskTimer task={createMockTask({ timeSpent: 0 })} {...noopHandlers} />);

      // The mm:ss running clock should not be present when stopped.
      expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
    });
  });
});
