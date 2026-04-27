import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SyncHistoryRecord } from "@/lib/types";

// Mock @tanstack/react-virtual since jsdom has no layout engine
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 136,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 136,
        size: 136,
      })),
  }),
}));

// Mock AppShell — render caption and topbarRightSlot so page-level assertions still work
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

// Mock sync-history functions
const mockGetRecentHistory = vi.fn<() => Promise<SyncHistoryRecord[]>>();
const mockGetHistoryStats = vi.fn();
const mockClearHistory = vi.fn<() => Promise<void>>();

vi.mock("@/lib/sync-history", () => ({
  getRecentHistory: (...args: unknown[]) => mockGetRecentHistory(...args as []),
  getHistoryStats: () => mockGetHistoryStats(),
  clearHistory: () => mockClearHistory(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock date-fns to avoid timezone issues
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 hours ago",
}));

const defaultStats = {
  totalSyncs: 5,
  successfulSyncs: 4,
  failedSyncs: 1,
  conflictSyncs: 0,
  totalPushed: 10,
  totalPulled: 8,
  totalConflictsResolved: 0,
  lastSyncAt: new Date().toISOString(),
};

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

function createMockHistoryRecord(
  overrides?: Partial<SyncHistoryRecord>
): SyncHistoryRecord {
  return {
    id: "sync-1",
    timestamp: new Date().toISOString(),
    status: "success",
    pushedCount: 3,
    pulledCount: 2,
    conflictsResolved: 0,
    deviceId: "device-1",
    triggeredBy: "user",
    ...overrides,
  };
}

let SyncHistoryPage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockGetRecentHistory.mockResolvedValue([]);
  mockGetHistoryStats.mockResolvedValue(defaultStats);
  mockClearHistory.mockResolvedValue(undefined);
  const mod = await import("@/app/(sync)/sync-history/page");
  SyncHistoryPage = mod.default;
});

describe("SyncHistoryPage with TanStack Query + Virtual", () => {
  it("shows loading state initially", async () => {
    mockGetRecentHistory.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    expect(
      screen.getByText("Loading sync history...")
    ).toBeInTheDocument();
  });

  it("shows empty state when no history", async () => {
    mockGetRecentHistory.mockResolvedValue([]);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("No sync history yet")).toBeInTheDocument();
    });
  });

  it("renders sync history records via useQuery", async () => {
    const records = [
      createMockHistoryRecord({
        id: "sync-1",
        status: "success",
        pushedCount: 5,
      }),
      createMockHistoryRecord({
        id: "sync-2",
        status: "error",
        errorMessage: "Connection timeout",
      }),
    ];
    mockGetRecentHistory.mockResolvedValue(records);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("success Sync")).toBeInTheDocument();
    });
  });

  it("displays statistics when history exists", async () => {
    const records = [createMockHistoryRecord()];
    mockGetRecentHistory.mockResolvedValue(records);
    mockGetHistoryStats.mockResolvedValue(defaultStats);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Total Syncs")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("Successful")).toBeInTheDocument();
    });
  });

  it("shows correct operation count", async () => {
    const records = [
      createMockHistoryRecord({ id: "sync-1" }),
      createMockHistoryRecord({ id: "sync-2" }),
    ];
    mockGetRecentHistory.mockResolvedValue(records);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(screen.getByText("2 sync operations")).toBeInTheDocument();
    });
  });

  it("clears history via useMutation with confirmation", async () => {
    const user = userEvent.setup();
    const records = [createMockHistoryRecord()];
    mockGetRecentHistory.mockResolvedValue(records);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /clear history/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /clear history/i }));

    await waitFor(() => {
      expect(mockClearHistory).toHaveBeenCalledTimes(1);
    });
  });

  it("does not clear history when confirmation cancelled", async () => {
    const user = userEvent.setup();
    const records = [createMockHistoryRecord()];
    mockGetRecentHistory.mockResolvedValue(records);

    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /clear history/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /clear history/i }));

    expect(mockClearHistory).not.toHaveBeenCalled();
  });

  it("fetches history and stats in parallel via TanStack Query", async () => {
    const records = [createMockHistoryRecord()];
    mockGetRecentHistory.mockResolvedValue(records);
    mockGetHistoryStats.mockResolvedValue(defaultStats);

    render(<SyncHistoryPage />, { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(mockGetRecentHistory).toHaveBeenCalledTimes(1);
      expect(mockGetHistoryStats).toHaveBeenCalledTimes(1);
    });
  });
});
