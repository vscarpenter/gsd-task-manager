import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TaskRecord } from "@/lib/types";
import { toast } from "sonner";

// Mock @tanstack/react-virtual since jsdom has no layout engine
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 200,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 200,
        size: 200,
      })),
  }),
}));

// Mock AppShell — render caption and children so page-level assertions still work
vi.mock("@/components/matrix-simplified/app-shell", () => ({
  AppShell: ({
    children,
    caption,
    topbarRightSlot,
  }: {
    children: React.ReactNode;
    caption?: React.ReactNode;
    topbarRightSlot?: React.ReactNode;
  }) => (
    <>
      {caption && <div data-testid="shell-caption">{caption}</div>}
      {topbarRightSlot}
      {children}
    </>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock archive functions
const mockListArchivedTasks = vi.fn<() => Promise<TaskRecord[]>>();
const mockRestoreTask = vi.fn<(id: string) => Promise<void>>();
const mockDeleteArchivedTask = vi.fn<(id: string) => Promise<void>>();
const mockArchiveTaskNow = vi.fn<(id: string) => Promise<void>>();
const mockReinstateArchivedTask = vi.fn<(task: TaskRecord) => Promise<void>>();

vi.mock("@/lib/archive", () => ({
  listArchivedTasks: (...args: unknown[]) => mockListArchivedTasks(...args as []),
  restoreTask: (...args: unknown[]) => mockRestoreTask(...args as [string]),
  deleteArchivedTask: (...args: unknown[]) => mockDeleteArchivedTask(...args as [string]),
  archiveTaskNow: (...args: unknown[]) => mockArchiveTaskNow(...args as [string]),
  reinstateArchivedTask: (...args: unknown[]) => mockReinstateArchivedTask(...args as [TaskRecord]),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock TaskCard to simplify rendering
vi.mock("@/components/task-card", () => ({
  TaskCard: ({ task }: { task: TaskRecord }) => (
    <div data-testid={`task-${task.id}`}>
      <span>{task.title}</span>
    </div>
  ),
}));

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function createMockArchivedTask(overrides?: Partial<TaskRecord>): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: "archived-1",
    title: "Archived Task",
    description: "",
    urgent: false,
    important: false,
    quadrant: "not-urgent-not-important",
    completed: true,
    completedAt: now,
    archivedAt: now,
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    notificationEnabled: false,
    notificationSent: false,
    ...overrides,
  };
}

// Dynamic import of ArchivePage (must be after mocks)
let ArchivePage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockListArchivedTasks.mockResolvedValue([]);
  const mod = await import("@/app/(archive)/archive/page");
  ArchivePage = mod.default;
});

describe("ArchivePage with TanStack Query + Virtual", () => {
  it("shows loading state initially", async () => {
    mockListArchivedTasks.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("Loading archived tasks...")).toBeInTheDocument();
  });

  it("shows empty state when no archived tasks", async () => {
    mockListArchivedTasks.mockResolvedValue([]);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("No archived tasks")).toBeInTheDocument();
    });
  });

  it("renders archived tasks via useQuery", async () => {
    const tasks = [
      createMockArchivedTask({ id: "task-1", title: "First Task" }),
      createMockArchivedTask({ id: "task-2", title: "Second Task" }),
    ];
    mockListArchivedTasks.mockResolvedValue(tasks);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("First Task")).toBeInTheDocument();
      expect(screen.getByText("Second Task")).toBeInTheDocument();
    });
  });

  it("displays correct task count", async () => {
    const tasks = [
      createMockArchivedTask({ id: "task-1", title: "Task 1" }),
      createMockArchivedTask({ id: "task-2", title: "Task 2" }),
      createMockArchivedTask({ id: "task-3", title: "Task 3" }),
    ];
    mockListArchivedTasks.mockResolvedValue(tasks);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("3 archived tasks")).toBeInTheDocument();
    });
  });

  it("restores task via useMutation and invalidates query", async () => {
    const user = userEvent.setup();
    const tasks = [
      createMockArchivedTask({ id: "task-1", title: "Restorable Task" }),
    ];
    mockListArchivedTasks.mockResolvedValue(tasks);
    mockRestoreTask.mockResolvedValue(undefined);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Restorable Task")).toBeInTheDocument();
    });

    // Click restore button
    const restoreButton = screen.getByRole("button", { name: /restore/i });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(mockRestoreTask).toHaveBeenCalledWith("task-1");
    });
  });

  it("undoes a restore through archiveTaskNow rather than raw Dexie writes", async () => {
    // The Undo lives inside the success toast's action, so it is only reachable
    // by invoking the callback sonner was handed.
    const user = userEvent.setup();
    mockListArchivedTasks.mockResolvedValue([
      createMockArchivedTask({ id: "task-1", title: "Restorable Task" }),
    ]);
    mockRestoreTask.mockResolvedValue(undefined);
    mockArchiveTaskNow.mockResolvedValue(undefined);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Restorable Task")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /restore/i }));
    await waitFor(() => {
      expect(mockRestoreTask).toHaveBeenCalledWith("task-1");
    });

    const successCall = vi.mocked(toast.success).mock.calls.find(
      ([message]) => typeof message === "string" && message.includes("Restored")
    );
    expect(successCall).toBeDefined();
    const action = (successCall![1] as { action?: { onClick: () => Promise<void> } })?.action;
    expect(action).toBeDefined();

    await action!.onClick();

    expect(mockArchiveTaskNow).toHaveBeenCalledWith("task-1");
  });

  it("surfaces an error when undoing a restore fails", async () => {
    const user = userEvent.setup();
    mockListArchivedTasks.mockResolvedValue([
      createMockArchivedTask({ id: "task-1", title: "Restorable Task" }),
    ]);
    mockRestoreTask.mockResolvedValue(undefined);
    mockArchiveTaskNow.mockRejectedValue(new Error("could not re-archive"));

    render(<ArchivePage />, { wrapper: createQueryWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Restorable Task")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /restore/i }));
    await waitFor(() => {
      expect(mockRestoreTask).toHaveBeenCalledWith("task-1");
    });

    const successCall = vi.mocked(toast.success).mock.calls.find(
      ([message]) => typeof message === "string" && message.includes("Restored")
    );
    const action = (successCall![1] as { action?: { onClick: () => Promise<void> } })?.action;

    // A rejected undo must not escape as an unhandled rejection.
    await expect(action!.onClick()).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalled();
  });

  it("deletes task with confirmation via useMutation", async () => {
    const user = userEvent.setup();
    const tasks = [
      createMockArchivedTask({ id: "task-1", title: "Deletable Task" }),
    ];
    mockListArchivedTasks.mockResolvedValue(tasks);
    mockDeleteArchivedTask.mockResolvedValue(undefined);

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Deletable Task")).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteArchivedTask).toHaveBeenCalledWith("task-1");
    });
  });

  it("deletes immediately without confirmation dialog (undo via toast)", async () => {
    const user = userEvent.setup();
    const tasks = [
      createMockArchivedTask({ id: "task-1", title: "Keep Task" }),
    ];
    mockListArchivedTasks.mockResolvedValue(tasks);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Keep Task")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    // Should delete immediately (no confirm dialog), with undo available via toast
    await waitFor(() => {
      expect(mockDeleteArchivedTask).toHaveBeenCalledWith("task-1");
    });
  });

  it("undoes a delete through reinstateArchivedTask, tolerating a repeat click", async () => {
    const user = userEvent.setup();
    mockListArchivedTasks.mockResolvedValue([
      createMockArchivedTask({ id: "task-1", title: "Keep Task" }),
    ]);
    mockDeleteArchivedTask.mockResolvedValue(undefined);
    mockReinstateArchivedTask.mockResolvedValue(undefined);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Keep Task")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(mockDeleteArchivedTask).toHaveBeenCalledWith("task-1");
    });

    const successCall = vi.mocked(toast.success).mock.calls.find(
      ([message]) => typeof message === "string" && message.includes("Deleted")
    );
    expect(successCall).toBeDefined();
    const action = (successCall![1] as { action?: { onClick: () => Promise<void> } })?.action;
    expect(action).toBeDefined();

    await action!.onClick();
    // A second activation must not throw — the reinstate is idempotent.
    await expect(action!.onClick()).resolves.toBeUndefined();

    expect(mockReinstateArchivedTask).toHaveBeenCalledTimes(2);
    expect(mockReinstateArchivedTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1" })
    );
  });

  it("surfaces an error when undoing a delete fails", async () => {
    const user = userEvent.setup();
    mockListArchivedTasks.mockResolvedValue([
      createMockArchivedTask({ id: "task-1", title: "Keep Task" }),
    ]);
    mockDeleteArchivedTask.mockResolvedValue(undefined);
    mockReinstateArchivedTask.mockRejectedValue(new Error("could not reinstate"));

    render(<ArchivePage />, { wrapper: createQueryWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Keep Task")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(mockDeleteArchivedTask).toHaveBeenCalledWith("task-1");
    });

    const successCall = vi.mocked(toast.success).mock.calls.find(
      ([message]) => typeof message === "string" && message.includes("Deleted")
    );
    const action = (successCall![1] as { action?: { onClick: () => Promise<void> } })?.action;

    // Must not escape as an unhandled rejection.
    await expect(action!.onClick()).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalled();
  });

  it("fetches data only once via TanStack Query caching", async () => {
    const tasks = [createMockArchivedTask()];
    mockListArchivedTasks.mockResolvedValue(tasks);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Archived Task")).toBeInTheDocument();
    });

    // Should only call the fetch function once
    expect(mockListArchivedTasks).toHaveBeenCalledTimes(1);
  });
});
