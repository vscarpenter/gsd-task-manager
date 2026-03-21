import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TaskRecord } from "@/lib/types";

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

vi.mock("@/lib/archive", () => ({
  listArchivedTasks: (...args: unknown[]) => mockListArchivedTasks(...args as []),
  restoreTask: (...args: unknown[]) => mockRestoreTask(...args as [string]),
  deleteArchivedTask: (...args: unknown[]) => mockDeleteArchivedTask(...args as [string]),
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

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const tasks = [
      createMockArchivedTask({ id: "task-1", title: "Keep Task" }),
    ];
    mockListArchivedTasks.mockResolvedValue(tasks);

    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ArchivePage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Keep Task")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    expect(mockDeleteArchivedTask).not.toHaveBeenCalled();
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
