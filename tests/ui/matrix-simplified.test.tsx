import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TaskRecord } from "@/lib/types";

const tasksFixture = vi.hoisted(() => ({ current: [] as TaskRecord[] }));

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
  useErrorHandlerWithUndo: () => ({ handleError: vi.fn() }),
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
import { createTask } from "@/lib/tasks";

describe("<MatrixSimplified>", () => {
  beforeEach(() => {
    tasksFixture.current = [];
    localStorage.removeItem("gsd:show-completed");
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
  });
});
