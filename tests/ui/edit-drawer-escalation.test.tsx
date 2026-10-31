import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import { ESCALATION_WINDOW_KEY, writeEscalationWindow } from "@/lib/preferences/escalation-window";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "File the quarterly report",
  description: "",
  urgent: false,
  important: true,
  quadrant: "not-urgent-important",
  completed: false,
  recurrence: "none",
  tags: [],
  subtasks: [],
  dependencies: [],
  notificationEnabled: false,
  notificationSent: false,
  createdAt: "2026-04-20T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
} as TaskRecord;

// "Now" is Monday, April 27, 2026 at noon; tomorrow at 3:30 PM exercises a timed due date.
const NOW = new Date(2026, 3, 27, 12, 0);
const tomorrowAt = (hour: number, minute: number) => new Date(2026, 3, 28, hour, minute).toISOString();

function open(task: Partial<TaskRecord>) {
  render(<EditDrawer open task={{ ...baseTask, ...task }} onClose={vi.fn()} onSubmit={vi.fn()} />);
}

describe("<EditDrawer> escalation hint", () => {
  beforeEach(() => {
    window.localStorage.removeItem(ESCALATION_WINDOW_KEY);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.removeItem(ESCALATION_WINDOW_KEY);
  });

  it("says where Mark urgent would send the task, beside the quadrant picker", () => {
    open({ dueDate: tomorrowAt(15, 30) });
    expect(screen.getByTestId("edit-escalation-hint")).toHaveTextContent(/^Moves to Do First$/);
  });

  it("names Delegate for an Eliminate task", () => {
    open({ important: false, quadrant: "not-urgent-not-important", dueDate: tomorrowAt(0, 0) });
    expect(screen.getByTestId("edit-escalation-hint")).toHaveTextContent(/^Moves to Delegate$/);
  });

  it.each([
    ["an urgent task", { urgent: true, quadrant: "urgent-important" as const, dueDate: tomorrowAt(0, 0) }],
    ["a task with no due date", {}],
    ["a task due outside the window", { dueDate: new Date(2026, 4, 5).toISOString() }],
    ["a completed task", { completed: true, dueDate: tomorrowAt(0, 0) }],
  ])("shows no hint for %s", (_label, overrides) => {
    open(overrides);
    expect(screen.queryByTestId("edit-escalation-hint")).toBeNull();
  });

  it("goes away as soon as an urgent quadrant is chosen", async () => {
    open({ dueDate: tomorrowAt(0, 0) });
    expect(screen.getByTestId("edit-escalation-hint")).toBeInTheDocument();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByTestId("edit-quadrant-q1"));
    expect(screen.queryByTestId("edit-escalation-hint")).toBeNull();
  });

  it("is hidden when the setting is Off", () => {
    act(() => writeEscalationWindow(null));
    open({ dueDate: tomorrowAt(0, 0) });
    expect(screen.queryByTestId("edit-escalation-hint")).toBeNull();
  });
});
