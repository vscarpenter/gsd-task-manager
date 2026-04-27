import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({
    all: [],
    byQuadrant: {
      "urgent-important": [],
      "not-urgent-important": [],
      "urgent-not-important": [],
      "not-urgent-not-important": [],
    },
    isLoading: false,
  }),
}));

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
});
