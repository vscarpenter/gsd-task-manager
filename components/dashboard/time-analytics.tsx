"use client";

import { ClockIcon, TimerIcon, TargetIcon, TrendingUpIcon } from "lucide-react";
import type { TimeTrackingSummary, QuadrantTimeDistribution } from "@/lib/analytics";
import { formatDuration } from "@/lib/analytics";
import { QUADRANT_ACCENT_BY_ID } from "@/lib/quadrants";
import { cn } from "@/lib/utils";
import { EmptyRegion } from "./empty-region";

interface TimeAnalyticsProps {
  summary: TimeTrackingSummary;
  quadrantDistribution: QuadrantTimeDistribution[];
  className?: string;
}

const QUADRANT_LABELS: Record<string, { name: string }> = {
  "urgent-important": { name: "Do First (Q1)" },
  "not-urgent-important": { name: "Schedule (Q2)" },
  "urgent-not-important": { name: "Delegate (Q3)" },
  "not-urgent-not-important": { name: "Eliminate (Q4)" },
};

/** Empty state when no time tracking data exists */
function EmptyState({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-6 shadow-sm", className)}>
      <h3 className="flex items-center gap-2 text-h3 font-semibold text-foreground">
        <ClockIcon className="h-5 w-5 text-foreground-muted" aria-hidden />
        Time tracking
      </h3>
      <EmptyRegion
        className="mt-6 py-4"
        line="Track time on a task to see where your hours go."
      />
    </div>
  );
}

/** Progress bar showing time spent in a quadrant */
function QuadrantBar({ dist, totalMinutes }: { dist: QuadrantTimeDistribution; totalMinutes: number }) {
  const config = QUADRANT_LABELS[dist.quadrantId];
  const percentage = totalMinutes > 0 ? Math.round((dist.totalMinutes / totalMinutes) * 100) : 0;
  const accent = QUADRANT_ACCENT_BY_ID[dist.quadrantId as keyof typeof QUADRANT_ACCENT_BY_ID];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{config.name}</span>
        <span className="tabular-nums text-foreground-muted">
          {formatDuration(dist.totalMinutes)} ({percentage}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-background-muted">
        {/* No transition: this is a static proportion on a read-only surface.
            Animating width forces reflow per frame, and scaleX would distort
            the pill's end caps — the honest fix is not to animate at all. */}
        <div
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

/** Estimation insights panel */
function EstimationInsights({ overCount, underCount }: { overCount: number; underCount: number }) {
  if (overCount === 0 && underCount === 0) return null;

  return (
    <div className="mt-6 rounded-md bg-background-muted p-4">
      <h4 className="text-sm font-medium text-foreground">Estimation insights</h4>
      <div className="mt-2 flex gap-6 text-sm">
        <div>
          <span className="font-medium tabular-nums text-status-overdue-ink">{overCount}</span>
          <span className="text-foreground-muted"> tasks over estimate</span>
        </div>
        <div>
          <span className="font-medium tabular-nums text-status-success-ink">{underCount}</span>
          <span className="text-foreground-muted"> tasks under estimate</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Display time tracking analytics on the dashboard
 */
export function TimeAnalytics({ summary, quadrantDistribution, className }: TimeAnalyticsProps) {
  const hasTimeData = summary.tasksWithTimeTracking > 0 || summary.tasksWithEstimates > 0;

  if (!hasTimeData) {
    return <EmptyState className={className} />;
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-6 shadow-sm", className)}>
      <h3 className="flex items-center gap-2 text-h3 font-semibold text-foreground">
        <ClockIcon className="h-5 w-5 text-foreground-muted" aria-hidden />
        Time tracking
      </h3>

      {/* Summary Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          icon={TimerIcon}
          label="Total tracked"
          value={formatDuration(summary.totalMinutesTracked)}
          subtitle={`${summary.tasksWithTimeTracking} tasks`}
        />
        <StatBlock
          icon={TargetIcon}
          label="Total estimated"
          value={formatDuration(summary.totalMinutesEstimated)}
          subtitle={`${summary.tasksWithEstimates} tasks`}
        />
        <StatBlock
          icon={TrendingUpIcon}
          label="Estimation accuracy"
          value={summary.estimationAccuracy > 0 ? `${summary.estimationAccuracy}%` : "\u2014"}
          subtitle={getAccuracyLabel(summary.estimationAccuracy)}
          valueColor={getAccuracyColor(summary.estimationAccuracy)}
        />
        <StatBlock
          icon={ClockIcon}
          label="Running timers"
          value={summary.tasksWithRunningTimers}
          subtitle={summary.tasksWithRunningTimers > 0 ? "active now" : "none active"}
          valueColor={summary.tasksWithRunningTimers > 0 ? "text-status-success-ink" : undefined}
        />
      </div>

      {/* Quadrant Time Distribution */}
      {summary.totalMinutesTracked > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-foreground-muted">Time by quadrant</h4>
          <div className="mt-3 space-y-3">
            {quadrantDistribution.map((dist) => (
              <QuadrantBar key={dist.quadrantId} dist={dist} totalMinutes={summary.totalMinutesTracked} />
            ))}
          </div>
        </div>
      )}

      <EstimationInsights overCount={summary.overEstimateTasks} underCount={summary.underEstimateTasks} />
    </div>
  );
}

interface StatBlockProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtitle: string;
  valueColor?: string;
}

function StatBlock({ icon: Icon, label, value, subtitle, valueColor }: StatBlockProps) {
  return (
    <div className="rounded-md bg-background-muted p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-foreground-muted" />
        <span className="text-xs font-medium text-foreground-muted">{label}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", valueColor || "text-foreground")}>
        {value}
      </p>
      <p className="text-xs text-foreground-muted">{subtitle}</p>
    </div>
  );
}

function getAccuracyLabel(accuracy: number): string {
  if (accuracy === 0) return "not enough data";
  if (accuracy <= 80) return "under-estimating";
  if (accuracy <= 120) return "good accuracy";
  return "over-estimating";
}

function getAccuracyColor(accuracy: number): string | undefined {
  if (accuracy === 0) return undefined;
  if (accuracy >= 80 && accuracy <= 120) return "text-status-success-ink";
  if (accuracy > 150 || accuracy < 50) return "text-status-overdue-ink";
  return "text-warning-dark";
}
