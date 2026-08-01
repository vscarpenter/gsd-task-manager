import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TaskDetailSheet } from "@/components/matrix-simplified/task-detail-sheet";
import type { TaskRecord } from "@/lib/types";

const task: TaskRecord = {
  id: "task-1",
  title: "Protect the planning block",
  description: "Review https://example.com/plan before Friday.",
  urgent: false,
  important: true,
  quadrant: "not-urgent-important",
  dueDate: "2026-08-07T17:00:00.000Z",
  completed: false,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
  recurrence: "weekly",
  tags: ["planning", "personal"],
  subtasks: [
    { id: "sub-1", title: "Choose the outcome", completed: true },
    { id: "sub-2", title: "Reserve the time", completed: false },
  ],
  dependencies: ["dependency-1", "missing-dependency"],
  notificationEnabled: false,
  notificationSent: false,
};

const dependency: TaskRecord = {
  ...task,
  id: "dependency-1",
  title: "Confirm the weekly priorities",
  description: "",
  dueDate: undefined,
  recurrence: "none",
  tags: [],
  subtasks: [],
  dependencies: [],
};

describe("TaskDetailSheet", () => {
  it("renders the available task context as a read-only dialog", () => {
    render(
      <TaskDetailSheet
        open
        task={task}
        allTasks={[task, dependency]}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: task.title })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Important, not urgent")).toBeInTheDocument();
    expect(screen.getByText(/Review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com/plan" })).toHaveAttribute(
      "href",
      "https://example.com/plan"
    );
    expect(screen.getByText(/Aug 7, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("planning")).toBeInTheDocument();
    expect(screen.getByText("personal")).toBeInTheDocument();
    expect(screen.getByText("Choose the outcome")).toBeInTheDocument();
    expect(screen.getByText("Reserve the time")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 complete")).toBeInTheDocument();
    expect(screen.getByText("Confirm the weekly priorities")).toBeInTheDocument();
    expect(screen.getByText("Unavailable task")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("offers explicit close and edit actions without mutating the task", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEdit = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open task</button>
          <TaskDetailSheet
            open={open}
            task={task}
            allTasks={[task]}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            onEdit={(selectedTask) => onEdit(selectedTask, document.activeElement)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open task" });
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: "Edit task" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(task, trigger));
    expect(task.title).toBe("Protect the planning block");
  });

  it("uses a safe-area-aware mobile bottom sheet and a desktop side sheet", () => {
    render(
      <TaskDetailSheet
        open
        task={task}
        allTasks={[task]}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: task.title });
    expect(dialog).toHaveClass("bottom-0", "rounded-t-2xl", "md:right-0", "md:top-0", "md:h-[100dvh]");
    expect(screen.getByTestId("task-detail-actions").className).toContain("safe-area-inset-bottom");
    expect(dialog.querySelector("header")?.className).toContain("safe-area-inset-right");
    expect(dialog.querySelector("header")?.className).toContain("safe-area-inset-top");
    expect(dialog.querySelector(".overflow-y-auto")?.className).toContain("safe-area-inset-left");
    expect(screen.getByTestId("task-detail-actions").className).toContain("safe-area-inset-right");
  });

  it("contains focus while open and restores it after Escape closes the sheet", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open details</button>
          <TaskDetailSheet
            open={open}
            task={task}
            allTasks={[task]}
            onClose={() => setOpen(false)}
            onEdit={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open details" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: task.title });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    screen.getByRole("button", { name: "Edit task" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close task details" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("falls back to main content when the inspected task and trigger disappear", async () => {
    const user = userEvent.setup();

    function Harness({ selectedTask }: { selectedTask: TaskRecord | null }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <main id="main-content" tabIndex={-1}>Workspace</main>
          {selectedTask ? (
            <button type="button" onClick={() => setOpen(true)}>Open live details</button>
          ) : null}
          <TaskDetailSheet
            open={open}
            task={selectedTask}
            allTasks={selectedTask ? [selectedTask] : []}
            onClose={() => setOpen(false)}
            onEdit={vi.fn()}
          />
        </>
      );
    }

    const { rerender } = render(<Harness selectedTask={task} />);
    await user.click(screen.getByRole("button", { name: "Open live details" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: task.title })).toBeVisible());

    rerender(<Harness selectedTask={null} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
  });

  it("does not render a dialog without a selected task", () => {
    render(
      <TaskDetailSheet
        open
        task={null}
        allTasks={[]}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
