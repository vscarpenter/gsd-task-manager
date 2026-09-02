"use client";

import type { Route } from "next";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ListTodoIcon, TrendingUpIcon } from "lucide-react";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ReviewVerdict } from "@/components/dashboard/review-verdict";
import { DashboardError } from "@/components/dashboard/dashboard-error";
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
import {
  DashboardSkeleton,
  StatRailSkeleton,
  VerdictSkeleton,
} from "@/components/dashboard/dashboard-skeleton";
import { ReviewPrompts } from "@/components/dashboard/review-prompts";
import { FeedbackNudge } from "@/components/dashboard/feedback-nudge";
import { Button } from "@/components/ui/button";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/use-command-palette";
import { useDashboardData } from "./use-dashboard-data";

const TREND_OPTIONS = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
] as const;

type TrendPeriod = 7 | 30 | 90;
type OpenMatrix = (params?: URLSearchParams) => void;

/**
 * The weekly review.
 *
 * Composition is Overview-shaped: one verdict answering "did my week go where I
 * meant it to", a three-measure rail backing it, then the evidence. Deadlines
 * and tags sit below the fold on purpose — the matrix at `/` is where doing
 * happens, and this page is where looking back happens.
 */
export default function DashboardPage(): React.ReactElement {
  const router = useRouter();

  const openMatrixAction: OpenMatrix = (params) => {
    const query = params?.toString();
    router.push(query ? (`/?${query}` as Route) : ROUTES.HOME);
  };

  const handleDeadlineTaskClick = (task: { id: string }) => {
    const params = new URLSearchParams();
    params.set("highlight", task.id);
    openMatrixAction(params);
  };

  useKeyboardShortcuts({
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
  });

  return (
    <AppShell title="Review">
      {/* Scoped to the data region: a failed local read must not cost the
          reader their navigation back to the matrix. */}
      <ErrorBoundary fallback={<DashboardError />}>
        <ReviewBody
          onOpenMatrix={openMatrixAction}
          onDeadlineTaskClick={handleDeadlineTaskClick}
        />
      </ErrorBoundary>
    </AppShell>
  );
}

interface ReviewBodyProps {
  onOpenMatrix: OpenMatrix;
  onDeadlineTaskClick: (task: { id: string }) => void;
}

function ReviewBody({ onOpenMatrix, onDeadlineTaskClick }: ReviewBodyProps): React.ReactElement {
  const { all: tasks, isLoading } = useTasks();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(30);
  const data = useDashboardData(tasks, trendPeriod);
  const isEmpty = !isLoading && tasks.length === 0;

  return (
    <div className="pb-10">
      <header className="border-b border-border/60 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow">Weekly review</p>
          <div className="mt-2">
            <HeroSlot isLoading={isLoading} isEmpty={isEmpty} data={data} />
          </div>
          {isLoading ? <StatRailSkeleton /> : isEmpty ? null : <StatRail data={data} />}
          {!isLoading && !isEmpty && <FeedbackNudge tasks={tasks} />}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading review data">
            <div aria-hidden="true">
              <DashboardSkeleton />
            </div>
          </div>
        ) : isEmpty ? (
          <DashboardEmpty onOpenMatrix={() => onOpenMatrix()} />
        ) : (
          <DashboardContent
            data={data}
            tasks={tasks}
            trendPeriod={trendPeriod}
            onTrendPeriodChange={setTrendPeriod}
            onDeadlineTaskClick={onDeadlineTaskClick}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The hero. The static question only survives where it is still true — with no
 * tasks there is nothing to answer it with, so it stands in for the verdict.
 */
function HeroSlot({
  isLoading,
  isEmpty,
  data,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  data: ReturnType<typeof useDashboardData>;
}): React.ReactElement {
  if (isLoading) return <VerdictSkeleton />;
  if (isEmpty) {
    return (
      <h2 className="max-w-[34rem] text-pretty text-h2 text-foreground sm:text-h1">
        What did this week make room for?
      </h2>
    );
  }
  return <ReviewVerdict metrics={data.metrics} />;
}

/**
 * Three measures behind hairline dividers rather than three bordered cards:
 * side-by-side cards would rebuild the equal-weight grid and tie the squint
 * test against the verdict above them.
 */
function StatRail({ data }: { data: ReturnType<typeof useDashboardData> }): React.ReactElement {
  const {
    metrics,
    completedSeries,
    createdSeries,
    completionRateSeries,
    completedTrend,
    previousSixAverage,
    completedInsight,
    activeInsight,
    completionInsight,
    plannedActiveShare,
  } = data;

  const paceNote =
    previousSixAverage > 0
      ? `${Math.abs(completedTrend)}% ${completedTrend >= 0 ? "above" : "below"} your recent pace`
      : completedInsight;

  return (
    <div className="mt-8 grid gap-6 border-t border-border/70 pt-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/70">
      <StatsCard
        className="sm:pr-6"
        title="Closed today"
        value={metrics.completedToday}
        icon={CheckCircle2Icon}
        note={paceNote}
        meta={`${metrics.completedThisWeek} closed in 7 days`}
        series={completedSeries}
      />
      <StatsCard
        className="sm:px-6"
        title="Active commitments"
        value={metrics.activeTasks}
        icon={ListTodoIcon}
        note={activeInsight}
        meta={`${plannedActiveShare}% scheduled`}
        series={createdSeries}
      />
      <StatsCard
        className="sm:pl-6"
        title="Follow-through"
        value={`${metrics.completionRate}%`}
        icon={TrendingUpIcon}
        note={completionInsight}
        meta={`${metrics.completedTasks} closed overall`}
        series={completionRateSeries}
      />
    </div>
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
  trendPeriod: TrendPeriod;
  onTrendPeriodChange: (v: TrendPeriod) => void;
  onDeadlineTaskClick: (task: { id: string }) => void;
}

function DashboardContent({
  data,
  tasks,
  trendPeriod,
  onTrendPeriodChange,
  onDeadlineTaskClick,
}: DashboardContentProps): React.ReactElement {
  const { metrics, trendData, streakData, timeTrackingSummary, timeByQuadrant } = data;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CompletionChart
            data={trendData}
            control={
              <SegmentedControl
                label="Completion trend period"
                options={TREND_OPTIONS}
                value={String(trendPeriod) as "7" | "30" | "90"}
                onChange={(v) => onTrendPeriodChange(Number(v) as TrendPeriod)}
              />
            }
          />
        </div>
        <div className="flex flex-col gap-6">
          <QuadrantDistribution distribution={metrics.quadrantDistribution} />
          <StreakIndicator streakData={streakData} />
        </div>
      </div>

      <ReviewPrompts distribution={metrics.quadrantDistribution} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingDeadlines tasks={tasks} onTaskClick={onDeadlineTaskClick} />
        <TagAnalytics tagStats={metrics.tagStats} maxTags={8} />
      </div>

      <TimeAnalytics summary={timeTrackingSummary} quadrantDistribution={timeByQuadrant} />
    </div>
  );
}
