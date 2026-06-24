import { useMemo } from "react";
import type { TaskRecord } from "@/lib/types";
import {
  calculateMetrics,
  getCompletionTrend,
  getStreakData,
  calculateTimeTrackingSummary,
  getTimeByQuadrant,
} from "@/lib/analytics";

export interface DashboardData {
  metrics: ReturnType<typeof calculateMetrics>;
  trendData: ReturnType<typeof getCompletionTrend>;
  streakData: ReturnType<typeof getStreakData>;
  timeTrackingSummary: ReturnType<typeof calculateTimeTrackingSummary>;
  timeByQuadrant: ReturnType<typeof getTimeByQuadrant>;
  completedSeries: number[];
  createdSeries: number[];
  completionRateSeries: number[];
  completedTrend: number;
  previousSixAverage: number;
  completedInsight: string;
  activeInsight: string;
  completionInsight: string;
  plannedActiveShare: number;
}

/** Derives all analytics values for the Dashboard page from the raw task list. */
export function useDashboardData(tasks: TaskRecord[], trendPeriod: 7 | 30 | 90): DashboardData {
  const metrics = useMemo(() => calculateMetrics(tasks), [tasks]);
  const last7TrendData = useMemo(() => getCompletionTrend(tasks, 7), [tasks]);
  const trendData = useMemo(() => getCompletionTrend(tasks, trendPeriod), [tasks, trendPeriod]);
  const streakData = useMemo(() => getStreakData(tasks), [tasks]);
  const timeTrackingSummary = useMemo(() => calculateTimeTrackingSummary(tasks), [tasks]);
  const timeByQuadrant = useMemo(() => getTimeByQuadrant(tasks), [tasks]);

  const completedSeries = useMemo(() => last7TrendData.map((p) => p.completed), [last7TrendData]);
  const createdSeries = useMemo(() => last7TrendData.map((p) => p.created), [last7TrendData]);
  const completionRateSeries = useMemo(
    () => last7TrendData.map((p) => Math.round((p.completed / (p.created || 1)) * 100)),
    [last7TrendData]
  );

  const { completedTrend, previousSixAverage } = useMemo(() => {
    const todayTrend = last7TrendData.at(-1)?.completed ?? 0;
    let previousTotal = 0;
    for (let i = 0; i < last7TrendData.length - 1; i += 1) {
      previousTotal += last7TrendData[i].completed;
    }
    const previousCount = Math.max(0, last7TrendData.length - 1);
    const nextPreviousSixAverage = previousCount > 0 ? previousTotal / previousCount : 0;
    const nextCompletedTrend = nextPreviousSixAverage > 0
      ? Math.round(((todayTrend - nextPreviousSixAverage) / nextPreviousSixAverage) * 100)
      : todayTrend > 0 ? 100 : 0;
    return { completedTrend: nextCompletedTrend, previousSixAverage: nextPreviousSixAverage };
  }, [last7TrendData]);

  const completedInsight = metrics.completedToday === 0
    ? "Ready to start today"
    : completedTrend > 10 ? "Above your recent pace"
    : completedTrend < -10 ? "Below your recent pace"
    : "Holding steady";

  const plannedActiveShare = metrics.activeTasks > 0
    ? Math.round(((metrics.activeTasks - metrics.noDueDateCount) / metrics.activeTasks) * 100)
    : 0;

  const activeInsight = metrics.overdueCount > 0
    ? `${metrics.overdueCount} overdue`
    : metrics.noDueDateCount > 0 ? `${metrics.noDueDateCount} unscheduled`
    : "Well scoped";

  const completionInsight = metrics.completionRate >= 80
    ? "Strong follow-through"
    : metrics.completionRate >= 60 ? "Healthy momentum"
    : "Room to tighten execution";

  return {
    metrics, trendData, streakData, timeTrackingSummary, timeByQuadrant,
    completedSeries, createdSeries, completionRateSeries,
    completedTrend, previousSixAverage,
    completedInsight, activeInsight, completionInsight, plannedActiveShare,
  };
}
