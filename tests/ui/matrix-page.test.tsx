import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/matrix-board", () => ({
  MatrixBoard: () => <div data-testid="matrix-board">MatrixBoard</div>,
}));

const mockUseTasks = vi.fn().mockReturnValue({ all: [], isLoading: false });
vi.mock("@/lib/use-tasks", () => ({
  useTasks: (...args: unknown[]) => mockUseTasks(...args),
}));

vi.mock("@/components/view-toggle", () => ({
  ViewToggle: () => <div data-testid="view-toggle">ViewToggle</div>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

vi.mock("@/lib/analytics", () => ({
  calculateMetrics: () => ({
    completedToday: 0,
    completedThisWeek: 0,
    activeTasks: 0,
    totalTasks: 0,
    completionRate: 0,
    completedTasks: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    quadrantDistribution: { q1: 0, q2: 0, q3: 0, q4: 0 },
    tagStats: [],
  }),
  getCompletionTrend: () => [],
  getStreakData: () => ({ currentStreak: 0, longestStreak: 0 }),
  calculateTimeTrackingSummary: () => ({
    totalMinutes: 0,
    avgMinutesPerDay: 0,
    avgMinutesPerTask: 0,
    trackedTasks: 0,
  }),
  getTimeByQuadrant: () => [],
}));

vi.mock("@/components/dashboard/stats-card", () => ({
  StatsCard: () => <div>StatsCard</div>,
}));

vi.mock("@/components/dashboard/completion-chart", () => ({
  CompletionChart: () => <div>CompletionChart</div>,
}));

vi.mock("@/components/dashboard/quadrant-distribution", () => ({
  QuadrantDistribution: () => <div>QuadrantDistribution</div>,
}));

vi.mock("@/components/dashboard/streak-indicator", () => ({
  StreakIndicator: () => <div>StreakIndicator</div>,
}));

vi.mock("@/components/dashboard/tag-analytics", () => ({
  TagAnalytics: () => <div>TagAnalytics</div>,
}));

vi.mock("@/components/dashboard/upcoming-deadlines", () => ({
  UpcomingDeadlines: () => <div>UpcomingDeadlines</div>,
}));

vi.mock("@/components/dashboard/time-analytics", () => ({
  TimeAnalytics: () => <div>TimeAnalytics</div>,
}));

vi.mock("@/components/dashboard/dashboard-skeleton", () => ({
  DashboardSkeleton: () => <div>DashboardSkeleton</div>,
}));

vi.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: () => <div>SegmentedControl</div>,
}));

// ---------------------------------------------------------------------------
// Tests: MatrixPage
// ---------------------------------------------------------------------------

describe("MatrixPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the MatrixBoard component", async () => {
    const { default: MatrixPage } = await import("@/app/(matrix)/page");
    render(<MatrixPage />);
    expect(screen.getByTestId("matrix-board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: DashboardPage
// ---------------------------------------------------------------------------

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and description", async () => {
    const { default: DashboardPage } = await import(
      "@/app/(dashboard)/dashboard/page"
    );
    render(<DashboardPage />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText("Track your productivity and task completion metrics")
    ).toBeInTheDocument();
  });

  it("renders ViewToggle and ThemeToggle in the nav bar", async () => {
    const { default: DashboardPage } = await import(
      "@/app/(dashboard)/dashboard/page"
    );
    render(<DashboardPage />);

    expect(screen.getByTestId("view-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("shows empty state when there are no tasks", async () => {
    const { default: DashboardPage } = await import(
      "@/app/(dashboard)/dashboard/page"
    );
    render(<DashboardPage />);

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create your first task to start tracking your productivity!"
      )
    ).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true", async () => {
    mockUseTasks.mockReturnValue({ all: [], isLoading: true });

    const { default: DashboardPage } = await import(
      "@/app/(dashboard)/dashboard/page"
    );
    render(<DashboardPage />);

    expect(screen.getByText("DashboardSkeleton")).toBeInTheDocument();
  });

  it("renders stats cards and charts when tasks exist", async () => {
    mockUseTasks.mockReturnValue({
      all: [
        {
          id: "t1",
          title: "Task 1",
          completed: false,
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          tags: [],
          subtasks: [],
          dependencies: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          notificationEnabled: false,
          notificationSent: false,
        },
      ],
      isLoading: false,
    });

    const { default: DashboardPage } = await import(
      "@/app/(dashboard)/dashboard/page"
    );
    render(<DashboardPage />);

    // Should show stats/charts instead of empty state
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    // Tag section falls through to the "no tags" placeholder
    expect(
      screen.getByText("Add tags to your tasks to see analytics here.")
    ).toBeInTheDocument();
  });
});
