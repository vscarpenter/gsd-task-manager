"use client";

import { ClockIcon, TimerIcon, TargetIcon, TrendingUpIcon } from "lucide-react";
import type { TimeTrackingSummary, QuadrantTimeDistribution } from "@/lib/analytics";
import { formatDuration } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface TimeAnalyticsProps {
  summary: TimeTrackingSummary;
  quadrantDistribution: QuadrantTimeDistribution[];
  className?: string;
}

const QUADRANT_LABELS: Record<string, { name: string; color: string }> = {
  "urgent-important": { name: "Do First (Q1)", color: "bg-red-500" },
  "not-urgent-important": { name: "Schedule (Q2)", color: "bg-blue-500" },
  "urgent-not-important": { name: "Delegate (Q3)", color: "bg-amber-500" },
  "not-urgent-not-important": { name: "Eliminate (Q4)", color: "bg-gray-400" },
};

/**
 * Display time tracking analytics on the dashboard
 */
export function TimeAnalytics({ summary, quadrantDistribution, className }: TimeAnalyticsProps) {
  const hasTimeData = summary.tasksWithTimeTracking > 0 || summary.tasksWithEstimates > 0;

  if (!hasTimeData) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ClockIcon className="h-5 w-5 text-accent" />
          Time Tracking
        </h3>
        <p className="mt-4 text-sm text-foreground-muted">
          No time tracking data yet. Start tracking time on tasks to see analytics here.
        </p>
      </div>
    );
  }

  const totalTrackedHours = Math.floor(summary.totalMinutesTracked / 60);
  const accuracyLabel = getAccuracyLabel(summary.estimationAccuracy);

  return (
    <div className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}>
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ClockIcon className="h-5 w-5 text-accent" />
        Time Tracking
      </h3>

      {/* Summary Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          icon={TimerIcon}
          label="Total Tracked"
          value={formatDuration(summary.totalMinutesTracked)}
          subtitle={`${summary.tasksWithTimeTracking} tasks`}
        />
        <StatBlock
          icon={TargetIcon}
          label="Total Estimated"
          value={formatDuration(summary.totalMinutesEstimated)}
          subtitle={`${summary.tasksWithEstimates} tasks`}
        />
        <StatBlock
          icon={TrendingUpIcon}
          label="Estimation Accuracy"
          value={summary.estimationAccuracy > 0 ? `${summary.estimationAccuracy}%` : "N/A"}
          subtitle={accuracyLabel}
          valueColor={getAccuracyColor(summary.estimationAccuracy)}
        />
        <StatBlock
          icon={ClockIcon}
          label="Running Timers"
          value={summary.tasksWithRunningTimers}
          subtitle={summary.tasksWithRunningTimers > 0 ? "active now" : "none active"}
          valueColor={summary.tasksWithRunningTimers > 0 ? "text-green-600" : undefined}
        />
      </div>

      {/* Quadrant Time Distribution */}
      {summary.totalMinutesTracked > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-foreground-muted">Time by Quadrant</h4>
          <div className="mt-3 space-y-3">
            {quadrantDistribution.map((dist) => {
              const config = QUADRANT_LABELS[dist.quadrantId];
              const percentage = summary.totalMinutesTracked > 0
                ? Math.round((dist.totalMinutes / summary.totalMinutesTracked) * 100)
                : 0;

              return (
                <div key={dist.quadrantId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{config.name}</span>
                    <span className="text-foreground-muted">
                      {formatDuration(dist.totalMinutes)} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", config.color)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Estimation Insight */}
      {(summary.overEstimateTasks > 0 || summary.underEstimateTasks > 0) && (
        <div className="mt-6 rounded-lg bg-background-muted p-4">
          <h4 className="text-sm font-medium text-foreground">Estimation Insights</h4>
          <div className="mt-2 flex gap-6 text-sm">
            <div>
              <span className="text-red-600 font-medium">{summary.overEstimateTasks}</span>
              <span className="text-foreground-muted"> tasks over estimate</span>
            </div>
            <div>
              <span className="text-green-600 font-medium">{summary.underEstimateTasks}</span>
              <span className="text-foreground-muted"> tasks under estimate</span>
            </div>
          </div>
        </div>
      )}
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
    <div className="rounded-lg bg-background-muted p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-foreground-muted" />
        <span className="text-xs font-medium text-foreground-muted">{label}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-bold", valueColor || "text-foreground")}>
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
  if (accuracy >= 80 && accuracy <= 120) return "text-green-600";
  if (accuracy > 150 || accuracy < 50) return "text-red-600";
  return "text-amber-600";
}
