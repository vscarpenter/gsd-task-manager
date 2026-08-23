import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { introDateLabel } from "@/components/matrix-simplified/intro-copy";
import type { TaskRecord } from "@/lib/types";
import type { SmartView } from "@/lib/filters";

const tasksFixture = vi.hoisted(() => ({ current: [] as TaskRecord[], loading: false }));
const smartViewsFixture = vi.hoisted(() => ({
  enabled: false,
  current: [] as SmartView[],
}));
const handleSuccessSpy = vi.hoisted(() => vi.fn());
const logErrorSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({
    all: tasksFixture.current,
    byQuadrant: {
      "urgent-important": [],
      "not-urgent-important": [],
      "urgent-not-important": [],
      "not-urgent-not-important": [],
    },
    isLoading: tasksFixture.loading,
  }),
}));

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: overrides.id ?? `task-${Math.random().toString(36).slice(2)}`,
    title: "Test task",
    description: "",
    urgent: false,
    important: false,
    quadrant: "not-urgent-not-important",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
    ...overrides,
  };
}

vi.mock("@/lib/tasks", () => ({
  createTask: vi.fn().mockResolvedValue(undefined),
  // Returns { task, recurringInstance } so callers can undo the whole
  // completion, including the instance a recurring task spawns.
  toggleCompleted: vi.fn().mockResolvedValue({ task: null, recurringInstance: null }),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  restoreTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/smart-views", () => ({
  APP_PREFERENCES_EVENT: "gsd:app-preferences",
  getAppPreferences: vi.fn().mockImplementation(() =>
    Promise.resolve({
      id: "preferences",
      pinnedSmartViewIds: [],
      maxPinnedViews: 5,
      smartViewsEnabled: smartViewsFixture.enabled,
    })
  ),
  getSmartViews: vi.fn().mockImplementation(() => Promise.resolve(smartViewsFixture.current)),
  getSmartView: vi.fn().mockImplementation((id: string) =>
    Promise.resolve(smartViewsFixture.current.find((view) => view.id === id))
  ),
}));

vi.mock("@/lib/confetti", () => ({
  celebrateCompletion: vi.fn(),
}));

vi.mock("@/lib/use-auto-archive", () => ({
  useAutoArchive: vi.fn(),
}));

vi.mock("@/lib/use-notification-checker", () => ({
  useNotificationChecker: vi.fn(),
}));

vi.mock("@/components/matrix-simplified/sync-status-display", () => ({
  SyncStatusDisplay: () => null,
}));

vi.mock("@/lib/hooks/use-sync-status", () => ({
  useSyncStatus: () => ({ status: "idle", lastSyncedAt: null }),
}));

// useToast requires ToastProvider — mock the entire module to avoid context error
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn(), hideToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// useErrorHandlerWithUndo uses useToast internally
vi.mock("@/lib/use-error-handler", () => ({
  useErrorHandlerWithUndo: () => ({ handleError: vi.fn(), handleSuccess: handleSuccessSpy }),
}));

vi.mock("@/lib/error-logger", () => ({
  logError: logErrorSpy,
  ErrorActions: {
    CREATE_TASK: "create_task",
    UPDATE_TASK: "update_task",
    DELETE_TASK: "delete_task",
    TOGGLE_TASK: "toggle_task_completion",
  },
}));

// useDragAndDrop sets up DnD sensors — stub it out to avoid pointer-sensor issues in jsdom
vi.mock("@/lib/use-drag-and-drop", () => ({
  useDragAndDrop: () => ({
    sensors: [],
    activeId: null,
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}));

// AppShell uses IconRail → useViewTransition → useRouter which requires Next.js app router context.
// Mock the shell so tests focus on the MatrixSimplified logic, not layout chrome.
vi.mock("@/components/matrix-simplified/app-shell", () => ({
  AppShell: ({
    title,
    titleAsLabel,
    caption,
    searchQuery,
    onSearchChange,
    children,
  }: {
    title: string;
    titleAsLabel?: boolean;
    caption?: React.ReactNode;
    searchQuery?: string;
    onSearchChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      {titleAsLabel ? <p data-testid="topbar-title">{title}</p> : <h1>{title}</h1>}
      {/* The header counts live here. Dropping them from the stub hid whether
          they describe the filtered board or the whole database. */}
      {caption ? <div data-testid="topbar-caption">{caption}</div> : null}
      {onSearchChange ? (
        <input
          aria-label="Shell search"
          value={searchQuery ?? ""}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
      {children}
    </div>
  ),
}));

import { MatrixSimplified } from "@/components/matrix-simplified";
import { createTask, toggleCompleted, updateTask, deleteTask, restoreTask } from "@/lib/tasks";
import { celebrateCompletion } from "@/lib/confetti";

/**
 * Completed tasks now live behind a per-quadrant "N done" disclosure, so tests
 * that assert on them have to open it first — the same click a user makes.
 */
async function revealCompleted() {
  const toggles = screen.queryAllByRole("button", { name: /\d+ done/i });
  for (const toggle of toggles) {
    await userEvent.click(toggle);
  }
}

describe("<MatrixSimplified>", () => {
  beforeEach(() => {
    tasksFixture.current = [];
    tasksFixture.loading = false;
    smartViewsFixture.enabled = false;
    smartViewsFixture.current = [];
    localStorage.removeItem("gsd:show-completed");
    window.history.replaceState({}, "", "/");
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
    vi.mocked(createTask).mockReset().mockResolvedValue(undefined);
    vi.mocked(celebrateCompletion).mockClear();
    vi.mocked(toggleCompleted).mockReset().mockResolvedValue({ task: null, recurringInstance: null });
    vi.mocked(updateTask).mockReset().mockResolvedValue(undefined);
    vi.mocked(deleteTask).mockReset().mockResolvedValue(undefined);
    vi.mocked(restoreTask).mockReset().mockResolvedValue(undefined);
    handleSuccessSpy.mockClear();
    logErrorSpy.mockClear();
  });

  // The empty states make a specific claim ("Nothing on fire.") that must not be
  // shown before IndexedDB has been read — a user with urgent tasks would see the
  // app assert the opposite of the truth for the duration of the load.
  describe("loading state", () => {
    it("renders the skeleton, not the empty-state grid, while tasks are loading", () => {
      tasksFixture.loading = true;
      render(<MatrixSimplified />);
      expect(screen.getByTestId("matrix-grid-skeleton")).toBeInTheDocument();
      expect(screen.queryByTestId("matrix-grid")).not.toBeInTheDocument();
      expect(screen.queryByTestId("quadrant-empty-mark")).not.toBeInTheDocument();
    });

    it("exposes the skeleton to assistive tech as a busy status", () => {
      tasksFixture.loading = true;
      render(<MatrixSimplified />);
      const sk = screen.getByTestId("matrix-grid-skeleton");
      expect(sk).toHaveAttribute("role", "status");
      expect(sk).toHaveAttribute("aria-busy", "true");
    });

    it("swaps to the real grid once loading resolves", () => {
      tasksFixture.loading = false;
      render(<MatrixSimplified />);
      expect(screen.getByTestId("matrix-grid")).toBeInTheDocument();
      expect(screen.queryByTestId("matrix-grid-skeleton")).not.toBeInTheDocument();
    });
  });

  // Columns are decided by the grid's own available width, not by a viewport
  // breakpoint (2026-08-14 design audit). A breakpoint cannot see the icon
  // rail: at 768px the rail takes ~180px, so md:grid-cols-2 produced 245px
  // panes with every title truncated to ~15 characters. Capped at two columns
  // because auto-fit found three on a wide desktop, and 3+1 destroys the
  // argument as thoroughly as 1x4.
  //
  // jsdom has no layout, so this only pins the mechanism. Real geometry and
  // the 340px pane floor are measured in tests/e2e/layout-overlap.spec.ts.
  it("sizes its columns by container width rather than viewport breakpoints", () => {
    render(<MatrixSimplified />);
    const grid = screen.getByTestId("matrix-grid");

    // The axis-label frame now sits between the grid and its container scope.
    expect(grid.closest(".\\@container")).not.toBeNull();
    expect(grid).toHaveClass("@min-[696px]:grid-cols-2", "@min-[696px]:grid-rows-2");
    expect(grid.className).not.toMatch(/\b(md|lg):grid-cols-2\b/);
  });

  // Tidewater un-merges the desktop grid: the four panes float on the page with
  // a constant 16px gutter instead of sharing one bordered container. The gutter
  // must not collapse at lg — that collapse is what re-merged them.
  it("floats the four panes on a constant 16px gutter with no merged container", () => {
    render(<MatrixSimplified />);
    const grid = screen.getByTestId("matrix-grid");

    expect(grid).toHaveClass("gap-4");
    expect(grid.className).not.toMatch(
      /lg:(gap-0|overflow-hidden|rounded-xl|border|bg-card|shadow-sm)/
    );
  });

  describe("completion celebration", () => {
    it("fires confetti when a task is marked complete", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [makeTask({ id: "a", title: "Active alpha", completed: false })];
      render(<MatrixSimplified />);

      await user.click(screen.getByRole("button", { name: /mark as complete/i }));

      await waitFor(() => expect(toggleCompleted).toHaveBeenCalledWith("a", true));
      expect(celebrateCompletion).toHaveBeenCalledTimes(1);
    });

    it("does not fire confetti when a task is uncompleted", async () => {
      const user = userEvent.setup();
      localStorage.setItem("gsd:show-completed", "true");
      tasksFixture.current = [makeTask({ id: "b", title: "Done bravo", completed: true })];
      render(<MatrixSimplified />);
      await revealCompleted();

      await user.click(screen.getByRole("button", { name: /mark as incomplete/i }));

      await waitFor(() => expect(toggleCompleted).toHaveBeenCalledWith("b", false));
      expect(celebrateCompletion).not.toHaveBeenCalled();
    });
  });

  describe("completion undo", () => {
    it("offers an undo when a task is completed", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [makeTask({ id: "a", title: "Active alpha", completed: false })];
      render(<MatrixSimplified />);

      await user.click(screen.getByRole("button", { name: /mark as complete/i }));

      // Completion is the most frequent action and its checkbox sits inches
      // from delete, which has had an Undo since forever.
      await waitFor(() =>
        expect(handleSuccessSpy).toHaveBeenCalledWith(
          "Task completed",
          expect.any(Function)
        )
      );
    });

    it("un-completes the task when the undo runs", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [makeTask({ id: "a", title: "Active alpha", completed: false })];
      render(<MatrixSimplified />);

      await user.click(screen.getByRole("button", { name: /mark as complete/i }));
      await waitFor(() => expect(handleSuccessSpy).toHaveBeenCalled());

      vi.mocked(toggleCompleted).mockClear();
      await handleSuccessSpy.mock.calls[0][1]();

      expect(toggleCompleted).toHaveBeenCalledWith("a", false);
    });

    it("removes the spawned next instance when undoing a recurring completion", async () => {
      const user = userEvent.setup();
      vi.mocked(toggleCompleted).mockResolvedValueOnce({
        task: makeTask({ id: "r", completed: true }),
        recurringInstance: makeTask({ id: "r-next", completed: false }),
      });
      tasksFixture.current = [makeTask({ id: "r", title: "Recurring task", completed: false })];
      render(<MatrixSimplified />);

      await user.click(screen.getByRole("button", { name: /mark as complete/i }));
      await waitFor(() => expect(handleSuccessSpy).toHaveBeenCalled());

      await handleSuccessSpy.mock.calls[0][1]();

      // Undoing only the completion would leave the next instance orphaned.
      expect(deleteTask).toHaveBeenCalledWith("r-next");
    });

    it("does not offer an undo when un-completing", async () => {
      const user = userEvent.setup();
      localStorage.setItem("gsd:show-completed", "true");
      tasksFixture.current = [makeTask({ id: "b", title: "Done bravo", completed: true })];
      render(<MatrixSimplified />);
      await revealCompleted();

      await user.click(screen.getByRole("button", { name: /mark as incomplete/i }));

      await waitFor(() => expect(toggleCompleted).toHaveBeenCalledWith("b", false));
      expect(handleSuccessSpy).not.toHaveBeenCalled();
    });
  });

  it("submitting capture bar calls createTask with parsed payload", async () => {
    render(<MatrixSimplified />);
    await userEvent.type(
      screen.getByLabelText("Capture a task"),
      "ship release !! #ops{Enter}"
    );
    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "ship release",
          urgent: true,
          important: true,
          tags: ["ops"],
        })
      )
    );
  });

  it("logs capture failures with a non-content action context", async () => {
    const failure = new Error("capture write failed");
    vi.mocked(createTask).mockRejectedValueOnce(failure);
    render(<MatrixSimplified />);

    await userEvent.type(screen.getByLabelText("Capture a task"), "private title{Enter}");

    await waitFor(() =>
      expect(logErrorSpy).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ action: "create_task" })
      )
    );
    expect(logErrorSpy.mock.calls[0][1]).not.toHaveProperty("metadata");
  });

  it("logs completion failures with the task id and toggle action", async () => {
    const failure = new Error("toggle failed");
    vi.mocked(toggleCompleted).mockRejectedValueOnce(failure);
    tasksFixture.current = [makeTask({ id: "toggle-error", title: "Toggle error" })];
    render(<MatrixSimplified />);

    await userEvent.click(screen.getByRole("button", { name: /mark as complete/i }));

    await waitFor(() =>
      expect(logErrorSpy).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ action: "toggle_task_completion", taskId: "toggle-error" })
      )
    );
  });

  it("renders 'GSD Matrix' title", () => {
    render(<MatrixSimplified />);
    expect(screen.getByTestId("topbar-title")).toHaveTextContent("GSD Matrix");
    expect(screen.getByRole("heading", { level: 1, name: /today.s matrix/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("shows today's date as the page heading once hydrated", () => {
    render(<MatrixSimplified />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      introDateLabel(new Date())
    );
  });

  it("keeps the static-export server snapshot hydration-safe", () => {
    const html = renderToString(<MatrixSimplified />);
    const snapshot = document.createElement("div");
    snapshot.innerHTML = html;
    const showSchedule = Array.from(snapshot.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Protect Q2")
    );

    expect(html).toContain("GSD Matrix");
    expect(html).toContain("Today’s matrix —");
    expect(html).not.toContain(introDateLabel(new Date()));
    expect(html).toContain("Capture a task");
    expect(showSchedule).toBeDisabled();
    expect(showSchedule).toHaveAttribute("autocomplete", "off");
  });

  it("reads the board state in the intro briefing", () => {
    tasksFixture.current = [
      makeTask({ id: "od1", urgent: true, important: true, dueDate: "2000-01-01" }),
      makeTask({ id: "od2", urgent: true, important: true, dueDate: "2000-01-02" }),
      makeTask({ id: "q4" }),
    ];
    render(<MatrixSimplified />);

    expect(screen.getByText("Both overdue tasks sit in Do First.")).toBeInTheDocument();
  });

  it("does not publish a board reading while tasks are loading", () => {
    tasksFixture.loading = true;
    render(<MatrixSimplified />);

    expect(screen.queryByText(/the board is clear/i)).not.toBeInTheDocument();
  });

  it("reports active Schedule work from the full task set", () => {
    tasksFixture.current = [
      makeTask({ id: "q2-a", urgent: false, important: true, completed: false }),
      makeTask({ id: "q2-b", urgent: false, important: true, completed: false }),
      makeTask({ id: "q2-done", urgent: false, important: true, completed: true }),
      makeTask({ id: "q1", urgent: true, important: true, completed: false }),
    ];

    render(<MatrixSimplified />);

    expect(screen.getByRole("button", { name: /protect q2/i })).toHaveTextContent(
      "Protect Q2 · 2 to schedule"
    );
  });

  it("does not publish a false Q2 count while tasks are loading", () => {
    tasksFixture.loading = true;
    render(<MatrixSimplified />);

    const scheduleButton = screen.getByRole("button", { name: /protect q2/i });
    expect(scheduleButton).toHaveTextContent("Protect Q2");
    expect(scheduleButton).not.toHaveTextContent(/to schedule|clear/);
    expect(scheduleButton).toBeDisabled();
  });

  it("keeps the Q2 planning count stable when search filters the matrix", async () => {
    tasksFixture.current = [
      makeTask({ id: "q2", title: "Write the strategy", urgent: false, important: true }),
      makeTask({ id: "q1", title: "Fix production", urgent: true, important: true }),
    ];
    render(<MatrixSimplified />);

    await userEvent.type(screen.getByLabelText("Shell search"), "production");

    expect(screen.getByRole("button", { name: /protect q2/i })).toHaveTextContent(
      "Protect Q2 · 1 to schedule"
    );
    expect(screen.queryByText("Write the strategy")).not.toBeInTheDocument();
  });

  it("shows and unmistakably focuses Schedule from the Q2 planning cue", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<MatrixSimplified />);

    await userEvent.click(screen.getByRole("button", { name: /protect q2/i }));

    expect(screen.getByTestId("quadrant-q2")).toHaveFocus();
    expect(screen.getByTestId("quadrant-q2")).toHaveClass(
      "shadow-[var(--shadow-card)]",
      "focus:ring-4",
      "focus:ring-accent",
      "focus:ring-offset-4"
    );
    expect(screen.getByTestId("quadrant-q2").style.boxShadow).toBe("");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
  });

  it("docks Quick Capture above mobile navigation and restores top-stickiness on desktop", () => {
    render(<MatrixSimplified />);
    expect(screen.getByTestId("mobile-capture-dock")).toHaveClass(
      "fixed",
      "md:sticky",
      "pl-[max(0.75rem,env(safe-area-inset-left))]",
      "pr-[max(0.75rem,env(safe-area-inset-right))]"
    );
  });

  it("renders four quadrant panes (regions)", () => {
    render(<MatrixSimplified />);
    expect(screen.getByRole("region", { name: /do first quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /schedule quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /delegate quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /eliminate quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Do First" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Schedule" })).toBeInTheDocument();
  });

  it("opens the create drawer when the shell new-task event fires", async () => {
    render(<MatrixSimplified />);

    act(() => {
      window.dispatchEvent(new CustomEvent("gsd:new-task"));
    });

    expect(await screen.findByRole("heading", { name: /new task/i })).toBeInTheDocument();
  });

  describe("share capture URL confirmation", () => {
    const captureUrl =
      "/?keep=1#action=capture&title=Review%20roadmap&url=https%3A%2F%2Fexample.com%2Froadmap&tags=planning,work";

    it("previews the capture and cancelling leaves persistence untouched", async () => {
      const user = userEvent.setup();
      window.history.replaceState({}, "", captureUrl);

      render(<MatrixSimplified />);

      expect(await screen.findByRole("heading", { name: /new task/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^title$/i)).toHaveValue("Review roadmap");
      expect(screen.getByLabelText(/description/i)).toHaveValue("https://example.com/roadmap");
      expect(createTask).not.toHaveBeenCalled();
      expect(window.location.search).toBe("?keep=1");
      expect(window.location.hash).toBe("");

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByRole("heading", { name: /new task/i })).not.toBeInTheDocument();
      expect(createTask).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Capture a task")).toHaveFocus();
    });

    it("creates exactly one task after explicit confirmation", async () => {
      const user = userEvent.setup();
      window.history.replaceState({}, "", captureUrl);

      render(<MatrixSimplified />);

      expect(await screen.findByRole("heading", { name: /new task/i })).toBeInTheDocument();
      expect(createTask).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /create task/i }));

      await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.queryByRole("heading", { name: /new task/i })).not.toBeInTheDocument()
      );
      expect(screen.getByLabelText("Capture a task")).toHaveFocus();
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Review roadmap",
          description: "https://example.com/roadmap",
          urgent: false,
          important: false,
          tags: ["planning", "work"],
        })
      );
    });
  });

  it("passes drawer-selected dependencies to createTask on the create path", async () => {
    const user = userEvent.setup();
    tasksFixture.current = [makeTask({ id: "dep-1", title: "Prepare deck" })];
    render(<MatrixSimplified />);

    act(() => {
      window.dispatchEvent(new CustomEvent("gsd:new-task"));
    });
    await screen.findByRole("heading", { name: /new task/i });

    const titleInput = screen.getByLabelText(/^title$/i);
    await waitFor(() => expect(titleInput).toHaveFocus());
    await user.type(titleInput, "Present deck");
    await user.type(screen.getByLabelText(/search tasks/i), "prepare");
    await user.click(await screen.findByTestId("dep-suggestion"));
    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Present deck", dependencies: ["dep-1"] })
      )
    );
  });

  it("forwards ghost dependency ids untouched through the edit save path", async () => {
    const user = userEvent.setup();
    // "dep-ghost" has no local record (e.g. not yet synced) — it must survive
    // an unrelated edit round-trip without being dropped.
    tasksFixture.current = [makeTask({ id: "e1", title: "Editable", dependencies: ["dep-ghost"] })];
    render(<MatrixSimplified />);

    // Task cards render two "Edit task" buttons (desktop row + compact menu).
    await user.click(screen.getAllByRole("button", { name: /^edit task$/i })[0]);
    await screen.findByRole("heading", { name: /edit task/i });
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateTask).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ dependencies: ["dep-ghost"] })
      )
    );
  });

  it("logs edit failures with the task id and update action", async () => {
    const user = userEvent.setup();
    const failure = new Error("edit failed");
    vi.mocked(updateTask).mockRejectedValueOnce(failure);
    tasksFixture.current = [makeTask({ id: "edit-error", title: "Edit error" })];
    render(<MatrixSimplified />);

    await user.click(screen.getAllByRole("button", { name: /^edit task$/i })[0]);
    await user.click(await screen.findByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(logErrorSpy).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ action: "update_task", taskId: "edit-error" })
      )
    );
  });

  it("inspects task details without persistence, then enters the explicit editor", async () => {
    const user = userEvent.setup();
    tasksFixture.current = [
      makeTask({
        id: "inspect-1",
        title: "Protect strategy time",
        description: "Block Friday morning",
        urgent: false,
        important: true,
      }),
    ];
    render(<MatrixSimplified />);

    await user.click(screen.getByRole("button", { name: /view details for protect strategy time/i }));

    const details = screen.getByRole("dialog", { name: "Protect strategy time" });
    expect(details).toBeInTheDocument();
    expect(within(details).getByText("Block Friday morning")).toBeInTheDocument();
    expect(updateTask).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Edit task" }));

    expect(await screen.findByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    expect(screen.queryByTestId("task-detail-sheet")).not.toBeInTheDocument();
  });

  it("keeps an open task inspector in sync with the latest task record", async () => {
    const user = userEvent.setup();
    tasksFixture.current = [
      makeTask({
        id: "inspect-live",
        title: "Original task title",
        description: "Original task description",
        urgent: false,
        important: true,
      }),
    ];
    const { rerender } = render(<MatrixSimplified />);

    await user.click(screen.getByRole("button", { name: /view details for original task title/i }));
    expect(screen.getByRole("dialog", { name: "Original task title" })).toBeInTheDocument();

    tasksFixture.current = [
      makeTask({
        id: "inspect-live",
        title: "Updated task title",
        description: "Updated task description",
        urgent: false,
        important: true,
      }),
    ];
    rerender(<MatrixSimplified />);

    const details = screen.getByRole("dialog", { name: "Updated task title" });
    expect(within(details).getByText("Updated task description")).toBeInTheDocument();
    expect(screen.queryByText("Original task title")).not.toBeInTheDocument();
    expect(screen.queryByText("Original task description")).not.toBeInTheDocument();
  });

  it("closes an open task inspector when its task disappears", async () => {
    const user = userEvent.setup();
    tasksFixture.current = [makeTask({ id: "inspect-deleted", title: "Delete during review" })];
    const { rerender } = render(<MatrixSimplified />);

    await user.click(
      screen.getByRole("button", { name: /view details for delete during review/i })
    );
    expect(screen.getByRole("dialog", { name: "Delete during review" })).toBeInTheDocument();

    tasksFixture.current = [];
    rerender(<MatrixSimplified />);

    await waitFor(() => {
      expect(screen.queryByTestId("task-detail-sheet")).not.toBeInTheDocument();
    });
  });

  it("highlights a task when the shell highlight event fires", async () => {
    tasksFixture.current = [makeTask({ id: "target", title: "Target task" })];
    render(<MatrixSimplified />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("gsd:highlight-task", { detail: { taskId: "target" } })
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("task-card")).toHaveClass("ring-4")
    );
  });

  it("shows and applies smart views when the feature preference is enabled", async () => {
    const user = userEvent.setup();
    smartViewsFixture.enabled = true;
    smartViewsFixture.current = [
      {
        id: "built-in-completed",
        name: "All Completed",
        icon: "✅",
        criteria: { status: "completed" },
        isBuiltIn: true,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    tasksFixture.current = [
      makeTask({ id: "active", title: "Active alpha", completed: false }),
      makeTask({ id: "done", title: "Done bravo", completed: true }),
    ];

    render(<MatrixSimplified />);

    expect(screen.getByText("Active alpha")).toBeInTheDocument();
    expect(screen.queryByText("Done bravo")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /all completed/i }));

    await waitFor(() =>
      expect(screen.queryByText("Active alpha")).not.toBeInTheDocument()
    );
    await revealCompleted();
    expect(screen.getByText("Done bravo")).toBeInTheDocument();
  });

  describe("show-completed preference", () => {
    it("hides completed tasks when 'gsd:show-completed' is unset", () => {
      tasksFixture.current = [
        makeTask({ id: "a", title: "Active alpha", completed: false }),
        makeTask({ id: "b", title: "Done bravo", completed: true }),
      ];
      render(<MatrixSimplified />);
      expect(screen.getByText("Active alpha")).toBeInTheDocument();
      expect(screen.queryByText("Done bravo")).not.toBeInTheDocument();
    });

    it("shows completed tasks when 'gsd:show-completed' is true", async () => {
      localStorage.setItem("gsd:show-completed", "true");
      tasksFixture.current = [
        makeTask({ id: "a", title: "Active alpha", completed: false }),
        makeTask({ id: "b", title: "Done bravo", completed: true }),
      ];
      render(<MatrixSimplified />);
      expect(screen.getByText("Active alpha")).toBeInTheDocument();

      // Behind the "N done" disclosure now, so it takes the click a user makes.
      await revealCompleted();
      expect(screen.getByText("Done bravo")).toBeInTheDocument();
    });

    it("re-renders when 'toggle-completed' event fires", async () => {
      tasksFixture.current = [
        makeTask({ id: "a", title: "Active alpha", completed: false }),
        makeTask({ id: "b", title: "Done bravo", completed: true }),
      ];
      render(<MatrixSimplified />);
      expect(screen.queryByText("Done bravo")).not.toBeInTheDocument();

      act(() => {
        localStorage.setItem("gsd:show-completed", "true");
        window.dispatchEvent(
          new CustomEvent("toggle-completed", { detail: { show: true } }),
        );
      });

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /1 done/i })).toBeInTheDocument(),
      );
      await revealCompleted();
      expect(screen.getByText("Done bravo")).toBeInTheDocument();
    });

    it("opens the share dialog with the target task when its share button is clicked", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [makeTask({ id: "shareable", title: "Shareable thing" })];
      render(<MatrixSimplified />);

      // Dialog is closed until the user clicks Share.
      expect(screen.queryByTestId("share-task-dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /share task/i }));

      const dialog = await screen.findByTestId("share-task-dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /share task: shareable thing/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^cancel$/i }));
      expect(screen.queryByTestId("share-task-dialog")).not.toBeInTheDocument();
    });

    it("opens the create drawer pre-set to a quadrant when its empty-state pill is clicked (polish v0.9.2 — item 3)", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [];
      render(<MatrixSimplified />);

      // The drawer header is "New task" — only present once it opens.
      expect(screen.queryByRole("heading", { name: /new task/i })).not.toBeInTheDocument();

      // Target the visible-text empty-state pill (not the icon-only header "+").
      await user.click(screen.getByText("Add to Do First"));

      const heading = await screen.findByRole("heading", { name: /new task/i });
      expect(heading).toBeInTheDocument();

      // Pre-selected quadrant button should be Do First (urgent + important).
      const doFirstQuadrant = screen.getByRole("button", { name: /^do first$/i, pressed: true });
      expect(doFirstQuadrant).toBeInTheDocument();
    });
  });

  describe("delete + undo", () => {
    it("logs delete failures with the task id and delete action", async () => {
      const user = userEvent.setup();
      const failure = new Error("delete failed");
      vi.mocked(deleteTask).mockRejectedValueOnce(failure);
      tasksFixture.current = [makeTask({ id: "delete-error", title: "Delete error" })];
      render(<MatrixSimplified />);

      await user.click(screen.getByRole("button", { name: /delete task/i }));

      await waitFor(() =>
        expect(logErrorSpy).toHaveBeenCalledWith(
          failure,
          expect.objectContaining({ action: "delete_task", taskId: "delete-error" })
        )
      );
    });

    it("offers an Undo toast that restores the deleted task", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [makeTask({ id: "del-1", title: "Delete me" })];
      render(<MatrixSimplified />);

      await user.click(screen.getByRole("button", { name: /delete task/i }));

      await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("del-1"));
      expect(handleSuccessSpy).toHaveBeenCalledWith("Task deleted", expect.any(Function));

      // Invoking the toast's undo action restores the exact original task record.
      const undoAction = handleSuccessSpy.mock.calls[0][1] as () => Promise<void>;
      await undoAction();
      expect(restoreTask).toHaveBeenCalledWith(expect.objectContaining({ id: "del-1" }));
    });
  });

  describe("filtered empty state", () => {
    it("says nothing matched instead of showing the quadrant empty copy", async () => {
      tasksFixture.current = [
        makeTask({ id: "a", title: "Active alpha" }),
        makeTask({ id: "b", title: "Active bravo" }),
      ];
      render(<MatrixSimplified />);

      await userEvent.type(screen.getByLabelText("Shell search"), "zzz-no-match");

      // Previously each quadrant kept its default copy ("Nothing on fire.")
      // while the header still read "2 active", so the board looked as if it
      // had vanished rather than been filtered.
      await waitFor(() =>
        expect(screen.getByTestId("filtered-empty")).toBeInTheDocument()
      );
      expect(screen.getByTestId("filtered-empty")).toHaveTextContent("zzz-no-match");
      expect(screen.queryByText("Nothing on fire.")).not.toBeInTheDocument();
    });

    it("offers a way back to the full board", async () => {
      const user = userEvent.setup();
      tasksFixture.current = [makeTask({ id: "a", title: "Active alpha" })];
      render(<MatrixSimplified />);

      await user.type(screen.getByLabelText("Shell search"), "zzz-no-match");
      await waitFor(() => expect(screen.getByTestId("filtered-empty")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /clear (search|filter)/i }));

      await waitFor(() => expect(screen.queryByTestId("filtered-empty")).not.toBeInTheDocument());
      expect(screen.getByText("Active alpha")).toBeInTheDocument();
    });

    it("keeps the quadrant empty copy when the board is genuinely empty", () => {
      tasksFixture.current = [];
      render(<MatrixSimplified />);

      expect(screen.queryByTestId("filtered-empty")).not.toBeInTheDocument();
    });

    it("reports the match count in the header while filtering", async () => {
      tasksFixture.current = [
        makeTask({ id: "a", title: "Active alpha" }),
        makeTask({ id: "b", title: "Active bravo" }),
      ];
      render(<MatrixSimplified />);

      await userEvent.type(screen.getByLabelText("Shell search"), "alpha");

      await waitFor(() => expect(screen.getByText("1 active")).toBeInTheDocument());
    });
  });
});
