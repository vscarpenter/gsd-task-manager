import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const mockTask: TaskRecord = {
  id: "t1",
  title: "Original title",
  description: "",
  urgent: true,
  important: true,
  quadrant: "urgent-important",
  completed: false,
  tags: ["work"],
  subtasks: [],
  dependencies: [],
  recurrence: "none",
  notificationEnabled: false,
  notificationSent: false,
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
} as TaskRecord;

describe("<EditDrawer>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits updated title and disables save when title is empty", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe("Original title");

    await userEvent.clear(titleInput);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated title" }),
      "t1"
    );
  });

  it("Esc closes the drawer", async () => {
    const onClose = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={onClose} onSubmit={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("quadrant picker switches urgent/important flags", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /^schedule$/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ urgent: false, important: true }),
      "t1"
    );
  });

  it("submits dueDate as a full ISO datetime string, not a date-only string", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /^today$/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [draft] = onSubmit.mock.calls[0] as [{ dueDate?: string }];
    expect(draft.dueDate).toBeDefined();
    // Must be a full ISO datetime (contains 'T'), not a date-only string
    expect(draft.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("pre-selects 'today' preset when task has a full ISO dueDate for today", () => {
    const taskDueToday: TaskRecord = {
      ...mockTask,
      dueDate: "2026-04-27T14:00:00.000Z",
    };
    render(<EditDrawer open task={taskDueToday} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const todayBtn = screen.getByRole("button", { name: /^today$/i });
    expect(todayBtn.getAttribute("aria-pressed")).toBe("true");
  });

  describe("create mode (task is null)", () => {
    it("shows 'New task' header and 'Create task' button", () => {
      render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
      expect(screen.getByRole("heading", { name: /new task/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create task/i })).toBeInTheDocument();
    });

    it("pre-fills title from initialDraft", () => {
      render(
        <EditDrawer
          open
          task={null}
          initialDraft={{ title: "Pre-filled title", urgent: true }}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Pre-filled title");
    });

    it("calls onSubmit without a taskId in create mode", async () => {
      const onSubmit = vi.fn();
      render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={onSubmit} />);
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, "Brand new task");
      await userEvent.click(screen.getByRole("button", { name: /create task/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Brand new task" }),
        undefined
      );
    });

    it("disables Create task button when title is empty", () => {
      render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
      expect(screen.getByRole("button", { name: /create task/i })).toBeDisabled();
    });
  });
});
