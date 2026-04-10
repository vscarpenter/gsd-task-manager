"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2Icon,
  ListTodoIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CompletionChart } from "@/components/dashboard/completion-chart";
import { QuadrantDistribution } from "@/components/dashboard/quadrant-distribution";
import { StreakIndicator } from "@/components/dashboard/streak-indicator";
import { TagAnalytics } from "@/components/dashboard/tag-analytics";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { TimeAnalytics } from "@/components/dashboard/time-analytics";
import { ViewToggle } from "@/components/view-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTasks } from "@/lib/use-tasks";
import {
  calculateMetrics,
  getCompletionTrend,
  getStreakData,
  calculateTimeTrackingSummary,
  getTimeByQuadrant,
} from "@/lib/analytics";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  const { all: tasks, isLoading } = useTasks();
  const [trendPeriod, setTrendPeriod] = useState<7 | 30 | 90>(30);

  const metrics = useMemo(() => calculateMetrics(tasks), [tasks]);
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        {/* Navigation Bar */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4">
            <ViewToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Header */}
        <div className="border-b border-border bg-background-muted px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-2 text-foreground-muted">
              Track your productivity and task completion metrics
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-6 py-8">
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
              {/* Row 1: Stats + Streak */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Completed Today"
                  value={metrics.completedToday}
                  subtitle={`${metrics.completedThisWeek} this week`}
                  icon={CheckCircle2Icon}
                  accentColor="emerald"
                />
                <StatsCard
                  title="Active Tasks"
                  value={metrics.activeTasks}
                  subtitle={`${metrics.totalTasks} total tasks`}
                  icon={ListTodoIcon}
                  accentColor="blue"
                />
                <StatsCard
                  title="Completion Rate"
                  value={`${metrics.completionRate}%`}
                  subtitle={`${metrics.completedTasks} completed`}
                  icon={TrendingUpIcon}
                  accentColor="amber"
                />
                <StreakIndicator streakData={streakData} />
              </div>

              {/* Overdue alert banner */}
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

              {/* Row 2: Completion Trend + Quadrant Distribution */}
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

              {/* Row 3: Deadlines + Tags */}
              <div className="grid gap-6 lg:grid-cols-2">
                <UpcomingDeadlines
                  tasks={tasks}
                  onTaskClick={(task) => {
                    window.location.href = `/?highlight=${task.id}`;
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

              {/* Row 4: Time Tracking (conditional) */}
              <TimeAnalytics
                summary={timeTrackingSummary}
                quadrantDistribution={timeByQuadrant}
              />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
