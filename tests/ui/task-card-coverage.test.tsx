import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTask } from "@/tests/fixtures";
import { TaskCard } from "@/components/task-card/index";
import type { TaskRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/tasks", () => ({
  hasRunningTimer: vi.fn(() => false),
  getRunningEntry: vi.fn(() => undefined),
  formatTimeSpent: vi.fn((m: number) => `${m}m`),
  isTaskSnoozed: vi.fn(() => false),
  getRemainingSnoozeMinutes: vi.fn(() => 0),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTaskCard(
  taskOverrides?: Partial<TaskRecord>,
  extraProps?: Record<string, unknown>,
  allTasks?: TaskRecord[]
) {
  const task = createMockTask(taskOverrides);
  const handlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleComplete: vi.fn(),
    onShare: vi.fn(),
    onDuplicate: vi.fn(),
    onSnooze: vi.fn(),
    onStartTimer: vi.fn().mockResolvedValue(undefined),
    onStopTimer: vi.fn().mockResolvedValue(undefined),
  };

  const result = render(
    <TaskCard
      task={task}
      allTasks={allTasks ?? [task]}
      {...handlers}
      {...extraProps}
    />
  );

  return { task, handlers, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TaskCard — additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders selection checkbox when selectionMode is true", () => {
    renderTaskCard({}, { selectionMode: true, isSelected: false, onToggleSelect: vi.fn() });
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders selected checkbox state", () => {
    renderTaskCard({}, { selectionMode: true, isSelected: true, onToggleSelect: vi.fn() });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("calls onToggleSelect when checkbox is toggled", async () => {
    const onToggleSelect = vi.fn();
    const user = userEvent.setup();
    renderTaskCard({}, { selectionMode: true, isSelected: false, onToggleSelect });

    await user.click(screen.getByRole("checkbox"));
    expect(onToggleSelect).toHaveBeenCalled();
  });

  it("renders dependency blocked indicator", () => {
    const blockingTask = createMockTask({
      id: "blocker-1",
      title: "Blocker Task",
      completed: false,
    });
    const dependentTask = createMockTask({
      id: "dependent-1",
      title: "Dependent Task",
      dependencies: ["blocker-1"],
    });

    renderTaskCard(
      { id: "dependent-1", title: "Dependent Task", dependencies: ["blocker-1"] },
      {},
      [dependentTask, blockingTask]
    );

    expect(screen.getByText(/Blocked by/)).toBeInTheDocument();
  });

  it("renders dependency blocking indicator", () => {
    const blockerTask = createMockTask({
      id: "blocker-1",
      title: "Blocker Task",
    });
    const dependentTask = createMockTask({
      id: "dependent-1",
      dependencies: ["blocker-1"],
      completed: false,
    });

    renderTaskCard(
      { id: "blocker-1", title: "Blocker Task" },
      {},
      [blockerTask, dependentTask]
    );

    expect(screen.getByText(/Blocking/)).toBeInTheDocument();
  });

  it("renders all subtasks completed with green styling", () => {
    const { container } = renderTaskCard({
      subtasks: [
        { id: "s1", title: "Sub 1", completed: true },
        { id: "s2", title: "Sub 2", completed: true },
      ],
    });

    expect(screen.getByText("2/2")).toBeInTheDocument();
    // The progress bar should have the emerald class
    const progressBar = container.querySelector(".bg-emerald-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("renders recurrence icon with correct title", () => {
    const { container } = renderTaskCard({ recurrence: "weekly" });
    const recurIcon = container.querySelector('[title="Recurs weekly"]');
    expect(recurIcon).toBeInTheDocument();
  });

  it("shows due-today badge for task due today", () => {
    const today = new Date();
    renderTaskCard({ dueDate: today.toISOString() });
    expect(screen.getByText("Due today")).toBeInTheDocument();
  });

  it("does not show dependency indicators for completed tasks", () => {
    const blockingTask = createMockTask({
      id: "blocker-1",
      title: "Blocker Task",
      completed: false,
    });
    const completedDependent = createMockTask({
      id: "dependent-1",
      title: "Done Task",
      dependencies: ["blocker-1"],
      completed: true,
    });

    renderTaskCard(
      { id: "dependent-1", title: "Done Task", dependencies: ["blocker-1"], completed: true },
      {},
      [completedDependent, blockingTask]
    );

    // Dependency indicator hidden for completed tasks
    expect(screen.queryByText(/Blocked by/)).not.toBeInTheDocument();
  });
});
