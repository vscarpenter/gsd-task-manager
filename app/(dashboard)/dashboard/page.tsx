"use client";

import { useState, useMemo } from "react";
import { CheckCircle2Icon, ListTodoIcon, TrendingUpIcon, TargetIcon } from "lucide-react";
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
import { calculateMetrics, getCompletionTrend, getStreakData, calculateTimeTrackingSummary, getTimeByQuadrant } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Dashboard page showing productivity metrics and analytics
 */
export default function DashboardPage() {
  const { all: tasks } = useTasks();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [trendPeriod, setTrendPeriod] = useState<7 | 30 | 90>(30);

  const metrics = useMemo(() => calculateMetrics(tasks), [tasks]);
  const trendData = useMemo(() => getCompletionTrend(tasks, trendPeriod), [tasks, trendPeriod]);
  const streakData = useMemo(() => getStreakData(tasks), [tasks]);
  const timeTrackingSummary = useMemo(() => calculateTimeTrackingSummary(tasks), [tasks]);
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
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-2 text-foreground-muted">
            Track your productivity and task completion metrics
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <ListTodoIcon className="mx-auto h-12 w-12 text-foreground-muted" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">No tasks yet</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Create your first task to start tracking your productivity!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Stats Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Completed Today"
                value={metrics.completedToday}
                subtitle={`${metrics.completedThisWeek} this week`}
                icon={CheckCircle2Icon}
              />
              <StatsCard
                title="Active Tasks"
                value={metrics.activeTasks}
                subtitle={`${metrics.totalTasks} total tasks`}
                icon={ListTodoIcon}
              />
              <StatsCard
                title="Completion Rate"
                value={`${metrics.completionRate}%`}
                subtitle={`${metrics.completedTasks} completed`}
                icon={TrendingUpIcon}
              />
              <StatsCard
                title="Overdue Tasks"
                value={metrics.overdueCount}
                subtitle={`${metrics.dueTodayCount} due today`}
                icon={TargetIcon}
              />
            </div>

            {/* Streak Indicator */}
            <StreakIndicator streakData={streakData} />

            {/* Completion Trend Chart */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant={trendPeriod === 7 ? "primary" : "subtle"}
                    onClick={() => setTrendPeriod(7)}
                    className="text-sm"
                  >
                    7 Days
                  </Button>
                  <Button
                    variant={trendPeriod === 30 ? "primary" : "subtle"}
                    onClick={() => setTrendPeriod(30)}
                    className="text-sm"
                  >
                    30 Days
                  </Button>
                  <Button
                    variant={trendPeriod === 90 ? "primary" : "subtle"}
                    onClick={() => setTrendPeriod(90)}
                    className="text-sm"
                  >
                    90 Days
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={chartType === "line" ? "primary" : "subtle"}
                    onClick={() => setChartType("line")}
                    className="text-sm"
                  >
                    Line
                  </Button>
                  <Button
                    variant={chartType === "bar" ? "primary" : "subtle"}
                    onClick={() => setChartType("bar")}
                    className="text-sm"
                  >
                    Bar
                  </Button>
                </div>
              </div>
              <CompletionChart data={trendData} chartType={chartType} />
            </div>

            {/* Two Column Layout */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Quadrant Distribution */}
              <QuadrantDistribution distribution={metrics.quadrantDistribution} />

              {/* Upcoming Deadlines */}
              <UpcomingDeadlines
                tasks={tasks}
                onTaskClick={(task) => {
                  // Navigate to matrix view with task highlighted
                  window.location.href = `/?highlight=${task.id}`;
                }}
              />
            </div>

            {/* Tag Analytics */}
            {metrics.tagStats.length > 0 && (
              <TagAnalytics tagStats={metrics.tagStats} maxTags={10} />
            )}

            {/* Time Tracking Analytics */}
            <TimeAnalytics
              summary={timeTrackingSummary}
              quadrantDistribution={timeByQuadrant}
            />

            {/* Summary Card */}
            <div className="rounded-xl border border-border bg-gradient-to-br from-accent/5 to-accent/10 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">Quick Summary</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-foreground-muted">Do First (Q1)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {metrics.quadrantDistribution["urgent-important"]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Schedule (Q2)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {metrics.quadrantDistribution["not-urgent-important"]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Delegate (Q3)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {metrics.quadrantDistribution["urgent-not-important"]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Eliminate (Q4)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {metrics.quadrantDistribution["not-urgent-not-important"]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
