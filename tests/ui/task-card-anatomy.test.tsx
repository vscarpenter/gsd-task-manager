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

  // The quadrant mark gets enough weight to hold its own beside
  // the pane header while keeping it inset from the card's structural border.
  it("draws the spine as a 3px pill inset from the card's top and bottom", () => {
    renderCard();
    const spine = screen.getByTestId("task-card-spine");
    expect(spine.className).toContain("w-[3px]");
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

  it("keeps a blocked card opaque so its text remains contrast-safe", () => {
    const blocker = createMockTask({ id: "b1", title: "Blocker", completed: false });
    const dependent = createMockTask({ id: "d1", dependencies: ["b1"], completed: false });
    renderCard({ id: "d1", dependencies: ["b1"], completed: false }, [dependent, blocker]);
    expect(screen.getByTestId("task-card")).toHaveClass("opacity-100");
    expect(screen.getByTestId("task-card")).not.toHaveClass("opacity-[0.62]");
  });
});

// ---------------------------------------------------------------------------
// Quadrant header identity
// ---------------------------------------------------------------------------

describe("QuadrantPane header — quadrant identity", () => {
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

  it("uses the quadrant wash as the pane ground", () => {
    renderPane("q1");
    expect(screen.getByTestId("quadrant-q1").style.backgroundColor).toBe("var(--q1-wash)");
  });

  it("renders a tinted header with a 3px pigment rule", () => {
    renderPane("q1");
    const header = screen.getByTestId("quadrant-header");
    expect(header.style.backgroundColor).toBe("var(--q1-header)");
    expect(header.style.borderTopColor).toBe("var(--q1)");
    expect(header.className).toContain("border-t-[3px]");
  });

  it("uses a Lucide glyph and ink-safe title in the quadrant ink", () => {
    renderPane("q1");
    const icon = screen.getByTestId("quadrant-icon");
    const title = screen.getByTestId("quadrant-title");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.style.color).toBe("var(--q1-ink)");
    expect(icon.className.baseVal).toContain("h-[18px]");
    expect(title.style.color).toBe("var(--q1-ink)");
    expect(screen.getByTestId("quadrant-hint").style.color).toBe("var(--q1-ink)");
  });

  it("exposes a semantic, programmatically focusable quadrant target", () => {
    renderPane("q2");
    const pane = screen.getByTestId("quadrant-q2");

    expect(screen.getByRole("heading", { level: 2, name: "Schedule" })).toBeInTheDocument();
    expect(pane).toHaveAttribute("id", "matrix-quadrant-q2");
    expect(pane).toHaveAttribute("tabindex", "-1");
  });

  it("colors every header surface from its own quadrant contract", () => {
    renderPane("q3");
    expect(screen.getByTestId("quadrant-q3").style.backgroundColor).toBe("var(--q3-wash)");
    expect(screen.getByTestId("quadrant-header").style.backgroundColor).toBe("var(--q3-header)");
    expect(screen.getByTestId("quadrant-icon").style.color).toBe("var(--q3-ink)");
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
