"use client";

import type { Route } from "next";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ListTodoIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CompletionChart } from "@/components/dashboard/completion-chart";
import { QuadrantDistribution } from "@/components/dashboard/quadrant-distribution";
import { StreakIndicator } from "@/components/dashboard/streak-indicator";
import { TagAnalytics } from "@/components/dashboard/tag-analytics";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { TimeAnalytics } from "@/components/dashboard/time-analytics";
import { useTasks } from "@/lib/use-tasks";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { ROUTES } from "@/lib/routes";
import {
  calculateMetrics,
  getCompletionTrend,
  getStreakData,
  calculateTimeTrackingSummary,
  getTimeByQuadrant,
} from "@/lib/analytics";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

/**
 * Dashboard page showing productivity metrics and analytics.
 * Uses a bento-grid layout with visual hierarchy:
 *   Row 1: Stats cards + streak indicator
 *   Row 2: Completion trend (wide) + quadrant donut (narrow)
 *   Row 3: Upcoming deadlines + tag analytics
 *   Row 4: Time tracking (full width, conditional)
 */
export default function DashboardPage() {
  const router = useRouter();
  const { all: tasks, isLoading } = useTasks();
  const [trendPeriod, setTrendPeriod] = useState<7 | 30 | 90>(30);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const metrics = useMemo(() => calculateMetrics(tasks), [tasks]);
  const last7TrendData = useMemo(() => getCompletionTrend(tasks, 7), [tasks]);
  const trendData = useMemo(
    () => getCompletionTrend(tasks, trendPeriod),
    [tasks, trendPeriod],
  );
  const streakData = useMemo(() => getStreakData(tasks), [tasks]);
  const timeTrackingSummary = useMemo(
    () => calculateTimeTrackingSummary(tasks),
    [tasks],
  );
  const timeByQuadrant = useMemo(() => getTimeByQuadrant(tasks), [tasks]);
  const todayTrend = last7TrendData.at(-1)?.completed ?? 0;
  const previousSixDays = last7TrendData.slice(0, -1);
  const previousSixAverage = previousSixDays.length > 0
    ? previousSixDays.reduce((sum, point) => sum + point.completed, 0) / previousSixDays.length
    : 0;
  const completedTrend = previousSixAverage > 0
    ? Math.round(((todayTrend - previousSixAverage) / previousSixAverage) * 100)
    : todayTrend > 0 ? 100 : 0;
  const completionPeak = Math.max(1, ...last7TrendData.map((point) => point.completed));
  const completedInsight = metrics.completedToday === 0
    ? "Ready to start today"
    : completedTrend > 10
      ? "Above your recent pace"
      : completedTrend < -10
        ? "Below your recent pace"
        : "Holding steady";
  const plannedActiveShare = metrics.activeTasks > 0
    ? Math.round(((metrics.activeTasks - metrics.noDueDateCount) / metrics.activeTasks) * 100)
    : 0;
  const activeInsight = metrics.overdueCount > 0
    ? `${metrics.overdueCount} overdue`
    : metrics.noDueDateCount > 0
      ? `${metrics.noDueDateCount} unscheduled`
      : "Well scoped";
  const completionInsight = metrics.completionRate >= 80
    ? "Strong follow-through"
    : metrics.completionRate >= 60
      ? "Healthy momentum"
      : "Room to tighten execution";

  const openMatrixAction = (params?: URLSearchParams) => {
    const query = params?.toString();
    const href = query ? (`/?${query}` as Route) : ROUTES.HOME;
    router.push(href);
  };

  useKeyboardShortcuts(
    {
      onNewTask: () => {
        const params = new URLSearchParams();
        params.set("action", "new-task");
        openMatrixAction(params);
      },
      onSearch: () => searchInputRef.current?.focus(),
      onHelp: () => {
        const params = new URLSearchParams();
        params.set("action", "help");
        openMatrixAction(params);
      },
    },
    searchInputRef
  );

  return (
    <AppShell
      title="Dashboard"
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchInputRef={searchInputRef}
    >
      <div className="space-y-8 pb-10">
          <div className="border-b border-border/60 bg-gradient-to-b from-background to-background-muted/40 px-4 py-8 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-7xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                Workspace Insights
              </p>
              <h1 className="rd-serif mt-2 text-3xl tracking-tight text-foreground sm:text-4xl">
                Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted sm:text-base">
                Track follow-through, spot overdue drag, and keep the matrix balanced before work starts to sprawl.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            {isLoading ? (
              <DashboardSkeleton />
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                <ListTodoIcon className="mx-auto h-12 w-12 text-foreground-muted" />
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  No tasks yet
                </h2>
                <p className="mt-2 text-sm text-foreground-muted">
                  Create your first task to start tracking your productivity!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <StatsCard
                    title="Completed Today"
                    value={metrics.completedToday}
                    subtitle={`${metrics.completedThisWeek} this week`}
                    icon={CheckCircle2Icon}
                    trend={previousSixAverage > 0 ? { value: completedTrend, isPositive: completedTrend >= 0 } : undefined}
                    insight={completedInsight}
                    progressValue={Math.round((metrics.completedToday / completionPeak) * 100)}
                    progressLabel="Vs. recent best day"
                    accentColor="emerald"
                  />
                  <StatsCard
                    title="Active Tasks"
                    value={metrics.activeTasks}
                    subtitle={`${metrics.totalTasks} total tasks`}
                    icon={ListTodoIcon}
                    insight={activeInsight}
                    progressValue={plannedActiveShare}
                    progressLabel="Have a due date"
                    accentColor="blue"
                  />
                  <StatsCard
                    title="Completion Rate"
                    value={`${metrics.completionRate}%`}
                    subtitle={`${metrics.completedTasks} completed`}
                    icon={TrendingUpIcon}
                    insight={completionInsight}
                    progressValue={metrics.completionRate}
                    progressLabel="Done overall"
                    accentColor="amber"
                  />
                  <StreakIndicator streakData={streakData} />
                </div>

                {metrics.overdueCount > 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-500/5 px-5 py-3.5 dark:border-red-900/50 dark:bg-red-500/10">
                    <AlertTriangleIcon className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {metrics.overdueCount} overdue{" "}
                        {metrics.overdueCount === 1 ? "task" : "tasks"}
                        {metrics.dueTodayCount > 0 && (
                          <span className="text-foreground-muted">
                            {" "}
                            &middot; {metrics.dueTodayCount} due today
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-2">
                    <div className="flex items-center">
                      <SegmentedControl
                        options={[
                          { value: "7", label: "7 Days" },
                          { value: "30", label: "30 Days" },
                          { value: "90", label: "90 Days" },
                        ]}
                        value={String(trendPeriod) as "7" | "30" | "90"}
                        onChange={(v) =>
                          setTrendPeriod(Number(v) as 7 | 30 | 90)
                        }
                      />
                    </div>
                    <CompletionChart data={trendData} />
                  </div>
                  <QuadrantDistribution
                    distribution={metrics.quadrantDistribution}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <UpcomingDeadlines
                    tasks={tasks}
                    onTaskClick={(task) => {
                      const params = new URLSearchParams();
                      params.set("highlight", task.id);
                      openMatrixAction(params);
                    }}
                  />
                  {metrics.tagStats.length > 0 ? (
                    <TagAnalytics tagStats={metrics.tagStats} maxTags={8} />
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                      <h3 className="mb-4 text-lg font-semibold text-foreground">
                        Top Tags
                      </h3>
                      <div className="flex h-[240px] items-center justify-center">
                        <p className="text-sm text-foreground-muted">
                          Add tags to your tasks to see analytics here.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <TimeAnalytics
                  summary={timeTrackingSummary}
                  quadrantDistribution={timeByQuadrant}
                />
              </div>
            )}
          </div>

      </div>
    </AppShell>
  );
}
