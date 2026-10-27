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
/** Plain halves, not a 60% bar the page never explains. */
function completionInsightFor(rate: number): string {
  if (rate === 0) return "None completed yet";
  if (rate >= 80) return "Most are done";
  if (rate >= 50) return "Over half are done";
  return "Under half are done";
}

export function useDashboardData(tasks: TaskRecord[], trendPeriod: 7 | 30 | 90): DashboardData {
  const metrics = calculateMetrics(tasks);
  const last7TrendData = getCompletionTrend(tasks, 7);
  const trendData = getCompletionTrend(tasks, trendPeriod);
  const streakData = getStreakData(tasks);
  const timeTrackingSummary = calculateTimeTrackingSummary(tasks);
  const timeByQuadrant = getTimeByQuadrant(tasks);

  const completedSeries = last7TrendData.map((p) => p.completed);
  const createdSeries = last7TrendData.map((p) => p.created);
  const completionRateSeries = last7TrendData.map((p) =>
    Math.round((p.completed / (p.created || 1)) * 100)
  );

  const { completedTrend, previousSixAverage } = (() => {
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
  })();

  const completedInsight = metrics.completedToday === 0
    ? "None completed yet today"
    : completedTrend > 10 ? "Above your recent pace"
    : completedTrend < -10 ? "Below your recent pace"
    : "About the same as recently";

  const plannedActiveShare = metrics.activeTasks > 0
    ? Math.round(((metrics.activeTasks - metrics.noDueDateCount) / metrics.activeTasks) * 100)
    : 0;

  const activeInsight = metrics.overdueCount > 0
    ? `${metrics.overdueCount} overdue`
    : metrics.noDueDateCount > 0 ? `${metrics.noDueDateCount} without a due date`
    : "All have due dates";

  const completionInsight = completionInsightFor(metrics.completionRate);

  return {
    metrics, trendData, streakData, timeTrackingSummary, timeByQuadrant,
    completedSeries, createdSeries, completionRateSeries,
    completedTrend, previousSixAverage,
    completedInsight, activeInsight, completionInsight, plannedActiveShare,
  };
}
