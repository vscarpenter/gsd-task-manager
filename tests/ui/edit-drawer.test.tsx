import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));
    user = userEvent.setup();
  });
  afterEach(() => {
    // Defensive: ensure any per-test fake timers are cleared so they don't bleed
    // into userEvent-based tests, which hang under fake timers.
    vi.useRealTimers();
  });

  it("submits updated title and disables save when title is empty", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe("Original title");

    await user.clear(titleInput);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    await user.type(titleInput, "Updated title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated title" }),
      "t1"
    );
  });

  it("Esc closes the drawer", async () => {
    const onClose = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={onClose} onSubmit={vi.fn()} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("quadrant picker switches urgent/important flags", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^schedule$/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ urgent: false, important: true }),
      "t1"
    );
  });

  it("submits dueDate as a full ISO datetime string, not a date-only string", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^today$/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [draft] = onSubmit.mock.calls[0] as [{ dueDate?: string }];
    expect(draft.dueDate).toBeDefined();
    // Must be a full ISO datetime (contains 'T'), not a date-only string
    expect(draft.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("pre-selects 'today' preset when task has a full ISO dueDate for today", () => {
    // Pin the system date so the "today" classification matches the task's dueDate.
    // Scoped to this test only because fake timers break userEvent in the others.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));

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
      await user.type(titleInput, "Brand new task");
      await user.click(screen.getByRole("button", { name: /create task/i }));
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

  describe("custom due date pill (polish v0.9.2 — item 10)", () => {
    it("renders a 'Pick a date…' affordance after the preset chips", () => {
      render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Pick a date…" })).toBeInTheDocument();
    });

    it("submits the custom-picked date as the task's dueDate", async () => {
      const onSubmit = vi.fn();
      render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={onSubmit} />);

      await user.type(screen.getByLabelText(/^title$/i), "Pick test");
      await user.click(screen.getByRole("button", { name: "Pick a date…" }));

      // The native date input is revealed once the pill is clicked.
      const dateInput = screen.getByLabelText(/pick a custom due date/i);
      // userEvent.type doesn't drive type=date reliably in jsdom — fireEvent.change
      // routes the value through React's synthetic event system.
      fireEvent.change(dateInput, { target: { value: "2026-05-12" } });

      await user.click(screen.getByRole("button", { name: /create task/i }));

      const submitted = onSubmit.mock.calls.at(-1)?.[0];
      expect(submitted?.dueDate?.slice(0, 10)).toBe("2026-05-12");
    });
  });
});
