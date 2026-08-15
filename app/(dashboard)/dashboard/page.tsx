"use client";

import type { Route } from "next";
import { useState } from "react";
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
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ReviewPrompts } from "@/components/dashboard/review-prompts";
import { Button } from "@/components/ui/button";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/use-command-palette";
import { useDashboardData } from "./use-dashboard-data";

const TREND_OPTIONS = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
] as const;

/**
 * Dashboard page showing productivity metrics and analytics.
 * Uses a bento-grid layout with visual hierarchy:
 *   Row 1: Stats cards + streak indicator
 *   Row 2: Completion trend (wide) + quadrant donut (narrow)
 *   Row 3: Upcoming deadlines + tag analytics
 *   Row 4: Time tracking (full width, conditional)
 */
export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const { all: tasks, isLoading } = useTasks();
  const [trendPeriod, setTrendPeriod] = useState<7 | 30 | 90>(30);
  const data = useDashboardData(tasks, trendPeriod);

  const openMatrixAction = (params?: URLSearchParams) => {
    const query = params?.toString();
    router.push(query ? (`/?${query}` as Route) : ROUTES.HOME);
  };

  const handleDeadlineTaskClick = (task: { id: string }) => {
    const params = new URLSearchParams();
    params.set("highlight", task.id);
    openMatrixAction(params);
  };

  useKeyboardShortcuts(
    {
      onNewTask: () => {
        const params = new URLSearchParams();
        params.set("action", "new-task");
        openMatrixAction(params);
      },
      onSearch: () => {
        window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
      },
      onHelp: () => {
        window.dispatchEvent(new CustomEvent("gsd:open-help"));
      },
    }
  );

  return (
    <AppShell title="Review">
      <div className="space-y-8 pb-10">
        <header className="border-b border-border/60 px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow">Weekly review</p>
            <h2 className="mt-2 text-h2 text-foreground">
              What did this week make room for?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted sm:text-base">
              Look back before you look ahead. See what closed, what still needs an answer, and where intention can replace reaction.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {isLoading ? (
            <div role="status" aria-busy="true" aria-label="Loading review data">
              <div aria-hidden="true">
                <DashboardSkeleton />
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <DashboardEmpty onOpenMatrix={() => openMatrixAction()} />
          ) : (
            <DashboardContent
              data={data}
              tasks={tasks}
              trendPeriod={trendPeriod}
              onTrendPeriodChange={setTrendPeriod}
              onDeadlineTaskClick={handleDeadlineTaskClick}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function DashboardEmpty({ onOpenMatrix }: { onOpenMatrix: () => void }): React.ReactElement {
  return (
    <div className="mx-auto max-w-xl border-y border-border/70 py-14 text-center sm:py-16">
      <ListTodoIcon className="mx-auto h-10 w-10 text-foreground-muted" aria-hidden />
      <h2 className="mt-4 text-h3 font-semibold text-foreground">Nothing to review yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground-muted">
        Your review will take shape as work moves through the matrix. Start with one commitment that deserves your attention.
      </p>
      <Button className="touch-target mt-6" onClick={onOpenMatrix}>
        Open matrix
      </Button>
    </div>
  );
}

interface DashboardContentProps {
  data: ReturnType<typeof useDashboardData>;
  tasks: ReturnType<typeof useTasks>["all"];
  trendPeriod: 7 | 30 | 90;
  onTrendPeriodChange: (v: 7 | 30 | 90) => void;
  onDeadlineTaskClick: (task: { id: string }) => void;
}

function DashboardContent({ data, tasks, trendPeriod, onTrendPeriodChange, onDeadlineTaskClick }: DashboardContentProps): React.ReactElement {
  const { metrics, trendData, streakData, timeTrackingSummary, timeByQuadrant,
    completedSeries, createdSeries, completionRateSeries,
    completedTrend, previousSixAverage,
    completedInsight, activeInsight, completionInsight, plannedActiveShare } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Closed today"
          value={metrics.completedToday}
          icon={CheckCircle2Icon}
          trend={previousSixAverage > 0 ? { value: completedTrend, isPositive: completedTrend >= 0 } : undefined}
          insight={completedInsight}
          footerMeta={`${metrics.completedThisWeek} / 7d`}
          series={completedSeries}
        />
        <StatsCard
          title="Active commitments"
          value={metrics.activeTasks}
          icon={ListTodoIcon}
          insight={activeInsight}
          footerMeta={`${plannedActiveShare}% scheduled`}
          series={createdSeries}
        />
        <StatsCard
          title="Follow-through"
          value={`${metrics.completionRate}%`}
          icon={TrendingUpIcon}
          insight={completionInsight}
          footerMeta={`${metrics.completedTasks} done overall`}
          series={completionRateSeries}
        />
        <StreakIndicator streakData={streakData} />
      </div>

      {metrics.overdueCount > 0 && (
        <div className="alert is-danger items-center rounded-xl px-5 py-3.5">
          <AlertTriangleIcon className="h-5 w-5 shrink-0 text-rust" />
          <div className="flex-1">
            <p className="alert-title text-sm">
              {metrics.overdueCount} overdue {metrics.overdueCount === 1 ? "task" : "tasks"}
              {metrics.dueTodayCount > 0 && (
                <span className="alert-body"> &middot; {metrics.dueTodayCount} due today</span>
              )}
            </p>
          </div>
        </div>
      )}

      <ReviewPrompts distribution={metrics.quadrantDistribution} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center">
            <SegmentedControl
              label="Completion trend period"
              options={TREND_OPTIONS}
              value={String(trendPeriod) as "7" | "30" | "90"}
              onChange={(v) => onTrendPeriodChange(Number(v) as 7 | 30 | 90)}
            />
          </div>
          <CompletionChart data={trendData} />
        </div>
        <QuadrantDistribution distribution={metrics.quadrantDistribution} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingDeadlines tasks={tasks} onTaskClick={onDeadlineTaskClick} />
        {metrics.tagStats.length > 0 ? (
          <TagAnalytics tagStats={metrics.tagStats} maxTags={8} />
        ) : (
          <div className="rounded-lg border-hair border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-h3 font-semibold text-foreground">Top Tags</h3>
            <div className="flex h-[240px] items-center justify-center">
              <p className="text-sm text-foreground-muted">Add tags to your tasks to see analytics here.</p>
            </div>
          </div>
        )}
      </div>

      <TimeAnalytics summary={timeTrackingSummary} quadrantDistribution={timeByQuadrant} />
    </div>
  );
}
