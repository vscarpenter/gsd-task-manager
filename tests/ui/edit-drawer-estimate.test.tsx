import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "Draft the proposal",
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

describe("<EditDrawer> estimate", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("submits the entered estimate", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    // The Review page reports Total Estimated and Estimation Accuracy; without
    // this field there was no way to give either a number.
    await user.type(screen.getByLabelText(/estimate/i), "90");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedMinutes: 90 }),
      "t1"
    );
  });

  it("seeds from the task being edited", () => {
    render(
      <EditDrawer
        open
        task={{ ...baseTask, estimatedMinutes: 45 }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/estimate/i)).toHaveValue(45);
  });

  it("submits no estimate when the field is left blank", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedMinutes: undefined }),
      "t1"
    );
  });

  it("clears an estimate when the field is emptied", async () => {
    const onSubmit = vi.fn();
    render(
      <EditDrawer
        open
        task={{ ...baseTask, estimatedMinutes: 45 }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.clear(screen.getByLabelText(/estimate/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedMinutes: undefined }),
      "t1"
    );
  });
});
