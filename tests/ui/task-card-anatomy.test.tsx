import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockTask } from "@/tests/fixtures";
import { TaskCard } from "@/components/task-card/index";
import { QuadrantPane } from "@/components/matrix-simplified/quadrant-pane";
import { quadrantForTask } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks (mirror task-card-states.test.tsx)
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
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("@/lib/tasks", () => ({
  hasRunningTimer: vi.fn(() => false),
  getRunningEntry: vi.fn(() => undefined),
  formatTimeSpent: vi.fn((m: number) => `${m}m`),
  isTaskSnoozed: vi.fn(() => false),
  getRemainingSnoozeMinutes: vi.fn(() => 0),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

function renderCard(taskOverrides?: Partial<TaskRecord>, allTasks?: TaskRecord[]) {
  const task = createMockTask(taskOverrides);
  const result = render(
    <TaskCard
      task={task}
      allTasks={allTasks ?? [task]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onToggleComplete={vi.fn()}
      onShare={vi.fn()}
      onDuplicate={vi.fn()}
      onSnooze={vi.fn()}
      onStartTimer={vi.fn().mockResolvedValue(undefined)}
      onStopTimer={vi.fn().mockResolvedValue(undefined)}
    />
  );
  return { task, ...result };
}

// ---------------------------------------------------------------------------
// Card anatomy (reference §06)
// ---------------------------------------------------------------------------

describe("TaskCard anatomy — four-pigment language", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a quadrant accent spine colored by the task's quadrant", () => {
    // q3 = urgent, not important → ochre (--q3)
    renderCard({ urgent: true, important: false });
    const spine = screen.getByTestId("task-card-spine");
    expect(spine.style.backgroundColor).toBe("var(--q3)");
  });

  it("colors the spine per quadrant (q2 schedule = tide)", () => {
    renderCard({ urgent: false, important: true });
    expect(screen.getByTestId("task-card-spine").style.backgroundColor).toBe("var(--q2)");
  });

  it("fills the completion disc with the quadrant accent (not success green) when complete", () => {
    // q3 completed
    renderCard({ urgent: true, important: false, completed: true });
    const disc = screen.getByTestId("complete-task");
    expect(disc.style.backgroundColor).toBe("var(--q3)");
    // Must NOT use the old green success treatment on the disc itself
    expect(disc.className).not.toContain("bg-status-success");
  });

  it("renders tag chips in the quadrant wash + accent, not neutral gray", () => {
    // q2 schedule with a tag
    renderCard({ urgent: false, important: true, tags: ["work"] });
    const chip = screen.getByTestId("task-tag");
    expect(chip.style.color).toBe("var(--q2)");
    expect(chip.style.backgroundColor).toBe("var(--q2-wash)");
    expect(chip.className).not.toContain("bg-background-muted");
  });

  it("dims a blocked (incomplete) card to 0.62 opacity", () => {
    const blocker = createMockTask({ id: "b1", title: "Blocker", completed: false });
    const dependent = createMockTask({ id: "d1", dependencies: ["b1"], completed: false });
    renderCard({ id: "d1", dependencies: ["b1"], completed: false }, [dependent, blocker]);
    expect(screen.getByTestId("task-card").className).toContain("opacity-[0.62]");
  });
});

// ---------------------------------------------------------------------------
// Quadrant header icon column (reference §06)
// ---------------------------------------------------------------------------

describe("QuadrantPane header — fixed icon column", () => {
  function renderPane(rdKey: "q1" | "q2" | "q3" | "q4") {
    const meta = rdKey === "q1"
      ? quadrantForTask(true, true)
      : rdKey === "q2"
      ? quadrantForTask(false, true)
      : rdKey === "q3"
      ? quadrantForTask(true, false)
      : quadrantForTask(false, false);
    return render(
      <QuadrantPane
        meta={meta}
        position="tl"
        tasks={[]}
        allTasks={[]}
        onEdit={vi.fn()}
        onToggleComplete={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onAddInQuadrant={vi.fn()}
      />
    );
  }

  it("renders a fixed icon column in the quadrant header", () => {
    renderPane("q1");
    expect(screen.getByTestId("quadrant-icon")).toBeInTheDocument();
  });

  it("shows an empty-state mark tile when the quadrant is empty", () => {
    renderPane("q1");
    expect(screen.getByTestId("quadrant-empty-mark")).toBeInTheDocument();
  });

  it("offers an add action in actionable empty quadrants (q1)", () => {
    renderPane("q1");
    expect(screen.getByText(/Add to Do First/)).toBeInTheDocument();
  });

  it("omits the add action in the Eliminate quadrant (nothing useful to do)", () => {
    renderPane("q4");
    expect(screen.queryByText(/Add to Eliminate/)).not.toBeInTheDocument();
  });
});
