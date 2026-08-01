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
  // SnoozeDropdown renders these; it mounts whenever a task has a dueDate.
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
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

  it("colors the spine per quadrant (q2 schedule = steel)", () => {
    renderCard({ urgent: false, important: true });
    expect(screen.getByTestId("task-card-spine").style.backgroundColor).toBe("var(--q2)");
  });

  // Tidewater shrinks the spine from a 3px full-height square rule to a 2px
  // pill inset 10px top and bottom. Full-height read as a border the card
  // owned; inset reads as a mark placed on it, which is what a quadrant is.
  it("draws the spine as a 2px pill inset from the card's top and bottom", () => {
    renderCard();
    const spine = screen.getByTestId("task-card-spine");
    expect(spine.className).toContain("w-[2px]");
    expect(spine.className).toContain("rounded-full");
    expect(spine.className).toContain("top-[10px]");
    expect(spine.className).toContain("bottom-[10px]");
  });

  // The grip used to hold a permanent 28px column, indenting every title on the
  // board for an affordance almost never used. It now floats over the card's
  // left edge, so titles start flush — dnd-kit's listeners are unchanged.
  it("keeps titles flush left by floating the drag grip out of the layout flow", () => {
    renderCard();
    const grip = screen.getByRole("button", { name: /drag to move task/i });
    expect(grip.className).toContain("absolute");
    expect(grip.className).toContain("opacity-0");
    expect(grip.className).toContain("group-hover:opacity-100");
    expect(grip.className).toContain("group-focus-within:opacity-100");
    // Only visibility is gated. Hit-testing must stay on, or Playwright's
    // actionability check (and anything else that asserts before pointing)
    // can never reach the handle — see tests/e2e/drag-and-drop.spec.ts.
    expect(grip.className).not.toContain("pointer-events-none");
  });

  it("fills the completion disc with the quadrant accent (not success green) when complete", () => {
    // q3 completed
    renderCard({ urgent: true, important: false, completed: true });
    const disc = screen.getByTestId("complete-task");
    expect(disc.style.backgroundColor).toBe("var(--q3)");
    // Must NOT use the old green success treatment on the disc itself
    expect(disc.className).not.toContain("bg-status-success");
  });

  // Reverses the earlier "tag chips carry the quadrant pigment" rule. Tags are
  // orthogonal to the matrix — "home" and "infra" say nothing about urgency —
  // so tinting them implied a meaning they do not carry, and restated the
  // quadrant a fifth time after the pane wash, header, rule, and spine. The
  // spine and completion disc (asserted above) remain the card's pigment.
  it("renders tag chips neutral, leaving pigment to mean quadrant only", () => {
    renderCard({ urgent: false, important: true, tags: ["work"] });
    const chip = screen.getByTestId("task-tag");
    expect(chip.style.color).toBe("");
    expect(chip.style.backgroundColor).toBe("");
    expect(chip.className).toContain("bg-background-muted");
  });

  // The overdue badge is absolutely positioned over the card's top-right. Without
  // reserved space the title rendered *underneath* it (measured 39px of overlap
  // at 1440px), so a long overdue title was partly unreadable. jsdom has no
  // layout, so assert the reservation rather than the geometry.
  it("reserves room for the overdue badge so the title truncates instead of colliding", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    renderCard({ dueDate: yesterday, completed: false });
    const title = screen.getByRole("heading", { level: 3 });
    expect(title.parentElement?.className).toContain("pr-24");
    expect(title.className).toContain("truncate");
  });

  it("does not reserve badge space when the task is not overdue", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    renderCard({ dueDate: tomorrow, completed: false });
    const title = screen.getByRole("heading", { level: 3 });
    expect(title.parentElement?.className).not.toContain("pr-24");
  });

  it("dims a blocked (incomplete) card to 0.62 opacity", () => {
    const blocker = createMockTask({ id: "b1", title: "Blocker", completed: false });
    const dependent = createMockTask({ id: "d1", dependencies: ["b1"], completed: false });
    renderCard({ id: "d1", dependencies: ["b1"], completed: false }, [dependent, blocker]);
    expect(screen.getByTestId("task-card").className).toContain("opacity-[0.62]");
  });
});

// ---------------------------------------------------------------------------
// Quadrant header identity dot (Tidewater)
// ---------------------------------------------------------------------------

describe("QuadrantPane header — quadrant identity dot", () => {
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

  // Tidewater reduces quadrant identity in the header to a single 7px dot —
  // the 18px pigment glyph and the 3px pane top-bar are both retired, so the
  // dot is the only place the pigment appears in the pane chrome.
  it("marks the quadrant with a dot in its own pigment", () => {
    renderPane("q1");
    const dot = screen.getByTestId("quadrant-icon");
    expect(dot).toBeInTheDocument();
    expect(dot.style.backgroundColor).toBe("var(--q1)");
    expect(dot.className).toContain("rounded-full");
  });

  it("colors the header dot per quadrant (q3 delegate = brass)", () => {
    renderPane("q3");
    expect(screen.getByTestId("quadrant-icon").style.backgroundColor).toBe("var(--q3)");
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
