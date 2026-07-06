import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TaskRecord } from "@/lib/types";
import type { SmartView } from "@/lib/filters";

const tasksFixture = vi.hoisted(() => ({ current: [] as TaskRecord[] }));
const smartViewsFixture = vi.hoisted(() => ({
  enabled: false,
  current: [] as SmartView[],
}));
const handleSuccessSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({
    all: tasksFixture.current,
    byQuadrant: {
      "urgent-important": [],
      "not-urgent-important": [],
      "urgent-not-important": [],
      "not-urgent-not-important": [],
    },
    isLoading: false,
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
  toggleCompleted: vi.fn().mockResolvedValue(undefined),
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
  AppShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

import { MatrixSimplified } from "@/components/matrix-simplified";
import { createTask, toggleCompleted, updateTask, deleteTask, restoreTask } from "@/lib/tasks";
import { celebrateCompletion } from "@/lib/confetti";

describe("<MatrixSimplified>", () => {
  beforeEach(() => {
    tasksFixture.current = [];
    smartViewsFixture.enabled = false;
    smartViewsFixture.current = [];
    localStorage.removeItem("gsd:show-completed");
    window.history.replaceState({}, "", "/");
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
    vi.mocked(celebrateCompletion).mockClear();
    vi.mocked(toggleCompleted).mockClear();
    vi.mocked(deleteTask).mockClear();
    vi.mocked(restoreTask).mockClear();
    handleSuccessSpy.mockClear();
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

      await user.click(screen.getByRole("button", { name: /mark as incomplete/i }));

      await waitFor(() => expect(toggleCompleted).toHaveBeenCalledWith("b", false));
      expect(celebrateCompletion).not.toHaveBeenCalled();
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

  it("renders 'GSD Matrix' title", () => {
    render(<MatrixSimplified />);
    expect(screen.getByRole("heading", { name: /gsd matrix/i })).toBeInTheDocument();
  });

  it("renders four quadrant panes (regions)", () => {
    render(<MatrixSimplified />);
    expect(screen.getByRole("region", { name: /do first quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /schedule quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /delegate quadrant/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /eliminate quadrant/i })).toBeInTheDocument();
  });

  it("opens the create drawer when the shell new-task event fires", async () => {
    render(<MatrixSimplified />);

    act(() => {
      window.dispatchEvent(new CustomEvent("gsd:new-task"));
    });

    expect(await screen.findByRole("heading", { name: /new task/i })).toBeInTheDocument();
  });

  it("passes drawer-selected dependencies to createTask on the create path", async () => {
    const user = userEvent.setup();
    tasksFixture.current = [makeTask({ id: "dep-1", title: "Prepare deck" })];
    render(<MatrixSimplified />);

    act(() => {
      window.dispatchEvent(new CustomEvent("gsd:new-task"));
    });
    await screen.findByRole("heading", { name: /new task/i });

    await user.type(screen.getByLabelText(/^title$/i), "Present deck");
    await user.type(screen.getByLabelText(/search tasks/i), "prepare");
    await user.click(screen.getByTestId("dep-suggestion"));
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

    await waitFor(() => {
      expect(screen.queryByText("Active alpha")).not.toBeInTheDocument();
      expect(screen.getByText("Done bravo")).toBeInTheDocument();
    });
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

    it("shows completed tasks when 'gsd:show-completed' is true", () => {
      localStorage.setItem("gsd:show-completed", "true");
      tasksFixture.current = [
        makeTask({ id: "a", title: "Active alpha", completed: false }),
        makeTask({ id: "b", title: "Done bravo", completed: true }),
      ];
      render(<MatrixSimplified />);
      expect(screen.getByText("Active alpha")).toBeInTheDocument();
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
        expect(screen.getByText("Done bravo")).toBeInTheDocument(),
      );
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
});
