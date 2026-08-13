import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "Ship the release",
  description: "",
  urgent: true,
  important: true,
  quadrant: "urgent-important",
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

describe("<EditDrawer> subtasks", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("adds a subtask and submits it", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/add a subtask/i), "Write the changelog{Enter}");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        subtasks: [expect.objectContaining({ title: "Write the changelog", completed: false })],
      }),
      "t1"
    );
  });

  it("shows existing subtasks with their completion state", () => {
    render(
      <EditDrawer
        open
        task={{
          ...baseTask,
          subtasks: [
            { id: "s1", title: "Already done", completed: true },
            { id: "s2", title: "Still open", completed: false },
          ],
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox", { name: /already done/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /still open/i })).not.toBeChecked();
  });

  it("toggles a subtask's completion", async () => {
    const onSubmit = vi.fn();
    render(
      <EditDrawer
        open
        task={{ ...baseTask, subtasks: [{ id: "s1", title: "Tick me", completed: false }] }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("checkbox", { name: /tick me/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        subtasks: [expect.objectContaining({ id: "s1", completed: true })],
      }),
      "t1"
    );
  });

  it("removes a subtask", async () => {
    const onSubmit = vi.fn();
    render(
      <EditDrawer
        open
        task={{ ...baseTask, subtasks: [{ id: "s1", title: "Drop me", completed: false }] }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: /remove subtask drop me/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ subtasks: [] }),
      "t1"
    );
  });

  it("ignores an empty subtask", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/add a subtask/i), "   {Enter}");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ subtasks: [] }),
      "t1"
    );
  });
});
