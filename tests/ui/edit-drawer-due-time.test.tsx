import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "Send the invoice",
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

// "Now" is Monday, April 27, 2026 at noon.
const NOW = new Date(2026, 3, 27, 12, 0);
const localIso = (month: number, day: number, hour = 0, minute = 0): string =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

describe("<EditDrawer> due time of day", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    user = userEvent.setup();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function open(task: Partial<TaskRecord>) {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={{ ...baseTask, ...task }} onClose={vi.fn()} onSubmit={onSubmit} />);
    return onSubmit;
  }

  async function savedDueDate(onSubmit: ReturnType<typeof vi.fn>): Promise<string | undefined> {
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    return (onSubmit.mock.calls[0] as [{ dueDate?: string }])[0].dueDate;
  }

  it("shows no time controls without a due date", () => {
    open({});
    expect(screen.queryByRole("switch", { name: /all day/i })).toBeNull();
  });

  it("shows All day on for a midnight due date, with no time input", () => {
    open({ dueDate: localIso(4, 30) });
    expect(screen.getByRole("switch", { name: /all day/i })).toBeChecked();
    expect(screen.queryByLabelText(/due time/i)).toBeNull();
  });

  it("shows the time and All day off for a due date with a time", () => {
    open({ dueDate: localIso(4, 30, 15, 30) });
    expect(screen.getByRole("switch", { name: /all day/i })).not.toBeChecked();
    expect(screen.getByLabelText(/due time/i)).toHaveValue("15:30");
  });

  it("turning All day off then picking a time saves that time on the same day", async () => {
    const onSubmit = open({ dueDate: localIso(4, 30) });
    await user.click(screen.getByRole("switch", { name: /all day/i }));
    fireEvent.change(screen.getByLabelText(/due time/i), { target: { value: "09:15" } });
    expect(await savedDueDate(onSubmit)).toBe(localIso(4, 30, 9, 15));
  });

  it("turning All day on clears the time", async () => {
    const onSubmit = open({ dueDate: localIso(4, 30, 15, 30) });
    await user.click(screen.getByRole("switch", { name: /all day/i }));
    expect(await savedDueDate(onSubmit)).toBe(localIso(4, 30));
  });

  it("keeps the time when a preset moves the day", async () => {
    const onSubmit = open({ dueDate: localIso(4, 30, 15, 30) });
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(await savedDueDate(onSubmit)).toBe(localIso(5, 4, 15, 30));
  });

  it("a preset on a task with no time stays all day", async () => {
    const onSubmit = open({});
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(await savedDueDate(onSubmit)).toBe(localIso(4, 27));
  });

  it("clearing the due date drops the time controls and the date", async () => {
    const onSubmit = open({ dueDate: localIso(4, 30, 15, 30) });
    await user.click(screen.getByRole("button", { name: "None" }));
    expect(screen.queryByRole("switch", { name: /all day/i })).toBeNull();
    expect(await savedDueDate(onSubmit)).toBeUndefined();
  });
});
