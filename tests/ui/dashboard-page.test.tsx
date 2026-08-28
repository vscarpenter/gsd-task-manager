import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import { ReviewPrompts } from "@/components/dashboard/review-prompts";
import { createMockTask } from "@/tests/fixtures";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useTasks: vi.fn(),
  useDashboardData: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/use-tasks", () => ({
  useTasks: mocks.useTasks,
}));

vi.mock("@/app/(dashboard)/dashboard/use-dashboard-data", () => ({
  useDashboardData: mocks.useDashboardData,
}));

vi.mock("@/components/matrix-simplified/app-shell", () => ({
  AppShell: ({
    children,
    title,
    onSearchChange,
  }: {
    children: React.ReactNode;
    title: string;
    onSearchChange?: (value: string) => void;
  }) => (
    <div
      data-testid="app-shell"
      data-title={title}
      data-has-search={String(onSearchChange !== undefined)}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/dashboard/stats-card", () => ({
  StatsCard: ({ title, value }: { title: string; value: string | number }) => (
    <div data-testid="stats-card">{title}: {value}</div>
  ),
}));

vi.mock("@/components/dashboard/completion-chart", () => ({
  CompletionChart: () => <div data-testid="completion-chart" />,
}));

vi.mock("@/components/dashboard/quadrant-distribution", () => ({
  QuadrantDistribution: () => <div data-testid="quadrant-distribution" />,
}));

vi.mock("@/components/dashboard/streak-indicator", () => ({
  StreakIndicator: () => <div data-testid="streak-indicator" />,
}));

vi.mock("@/components/dashboard/tag-analytics", () => ({
  TagAnalytics: () => <div data-testid="tag-analytics" />,
}));

vi.mock("@/components/dashboard/upcoming-deadlines", () => ({
  UpcomingDeadlines: ({ onTaskClick }: { onTaskClick: (task: { id: string }) => void }) => (
    <button type="button" onClick={() => onTaskClick({ id: "deadline-1" })}>
      Open deadline
    </button>
  ),
}));

vi.mock("@/components/dashboard/time-analytics", () => ({
  TimeAnalytics: () => <div data-testid="time-analytics" />,
}));

vi.mock("@/components/dashboard/dashboard-skeleton", () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
  VerdictSkeleton: () => <div data-testid="verdict-skeleton" />,
  StatRailSkeleton: () => <div data-testid="stat-rail-skeleton" />,
}));

vi.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: () => <div data-testid="trend-period" />,
}));

const quadrantDistribution = {
  "urgent-important": 2,
  "not-urgent-important": 3,
  "urgent-not-important": 4,
  "not-urgent-not-important": 1,
} as const;

function dashboardData() {
  return {
    metrics: {
      completedToday: 2,
      completedThisWeek: 7,
      completedThisMonth: 12,
      activeStreak: 3,
      longestStreak: 5,
      completionRate: 65,
      quadrantDistribution,
      tagStats: [{ tag: "strategy", count: 2, completedCount: 1, completionRate: 50 }],
      overdueCount: 1,
      dueTodayCount: 1,
      dueThisWeekCount: 2,
      noDueDateCount: 4,
      activeTasks: 10,
      completedTasks: 7,
      totalTasks: 17,
    },
    trendData: [],
    streakData: { current: 3, longest: 5, lastActivityDate: null },
    timeTrackingSummary: {},
    timeByQuadrant: {},
    completedSeries: [0, 1, 2],
    createdSeries: [1, 2, 3],
    completionRateSeries: [0, 50, 67],
    completedTrend: 20,
    previousSixAverage: 1,
    completedInsight: "Above your recent pace",
    activeInsight: "1 overdue",
    completionInsight: "Healthy momentum",
    plannedActiveShare: 60,
  };
}

describe("ReviewPrompts", () => {
  it("frames Q1, Q2, and Q4 reflection with honest active counts", () => {
    render(<ReviewPrompts distribution={quadrantDistribution} />);

    expect(screen.getByRole("heading", { name: "What still needs an answer?" })).toBeInTheDocument();
    expect(screen.getByText("2 active commitments in Do First.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What received protected time?" })).toBeInTheDocument();
    expect(screen.getByText("3 active commitments in Schedule.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What can leave the list?" })).toBeInTheDocument();
    expect(screen.getByText("1 active commitment in Eliminate.")).toBeInTheDocument();
    expect(screen.queryByText(/Delegate/)).not.toBeInTheDocument();
  });
});

describe("DashboardPage review framing", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.useTasks.mockReturnValue({
      all: [createMockTask({ id: "active-1", completed: false })],
      isLoading: false,
    });
    mocks.useDashboardData.mockReturnValue(dashboardData());
  });

  it("uses the Review shell and weekly reflection hierarchy without inert search", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-title", "Review");
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-has-search", "false");
    expect(screen.getByText("Weekly review")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "You closed 7 commitments this week." })
    ).toBeInTheDocument();
    expect(screen.getByText("1 commitment slipped past its due date.")).toBeInTheDocument();
    expect(screen.getByTestId("completion-chart")).toBeInTheDocument();
    expect(screen.getByTestId("quadrant-distribution")).toBeInTheDocument();
    expect(screen.getByTestId("time-analytics")).toBeInTheDocument();
  });

  it("opens the command palette for slash and preserves deadline navigation", () => {
    const onPaletteOpen = vi.fn();
    window.addEventListener("gsd:open-command-palette", onPaletteOpen, { once: true });
    render(<DashboardPage />);

    fireEvent.keyDown(window, { key: "/" });
    expect(onPaletteOpen).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Open deadline" }));
    expect(mocks.push).toHaveBeenCalledWith("/?highlight=deadline-1");
  });

  it("offers a calm path back to the matrix when there is nothing to review", () => {
    mocks.useTasks.mockReturnValue({ all: [], isLoading: false });
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "What did this week make room for?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nothing to review yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open matrix" }));
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("keeps the review shell and offers recovery when the local read fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.useTasks.mockImplementation(() => {
      throw new Error("IndexedDB unavailable");
    });

    render(<DashboardPage />);

    // A scoped fallback, not the app-wide boundary: the nav must survive so the
    // matrix is still one click away when only the review data is unreadable.
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t read your review/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("announces loading review data while keeping skeleton geometry decorative", () => {
    mocks.useTasks.mockReturnValue({ all: [], isLoading: true });
    render(<DashboardPage />);

    const status = screen.getByRole("status", { name: "Loading review data" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("dashboard-skeleton").parentElement).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.queryByRole("heading", { name: "Nothing to review yet" })).not.toBeInTheDocument();
    expect(screen.getByTestId("verdict-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("stat-rail-skeleton")).toBeInTheDocument();
  });
});
