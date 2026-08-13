import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "Weekly review",
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
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
} as TaskRecord;

describe("<EditDrawer> recurrence", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the recurrence options the schema supports", () => {
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={vi.fn()} />);

    // The engine already spawns the next instance on completion; only the way
    // to turn it on was missing.
    expect(screen.getByRole("group", { name: /repeat/i })).toBeInTheDocument();
    for (const label of ["Never", "Daily", "Weekly", "Monthly"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("submits the chosen recurrence", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ recurrence: "weekly" }),
      "t1"
    );
  });

  it("seeds from the task being edited", () => {
    render(
      <EditDrawer
        open
        task={{ ...baseTask, recurrence: "monthly" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("defaults a new task to no recurrence", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "One-off task");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ recurrence: "none" }),
      undefined
    );
  });
});
