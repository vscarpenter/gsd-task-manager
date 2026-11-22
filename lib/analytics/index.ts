export type {
  ProductivityMetrics,
  TrendDataPoint
} from "./metrics";

export type { TagStatistic } from "./types";

export type { StreakData } from "./streaks";

export type {
  TimeTrackingSummary,
  QuadrantTimeDistribution,
} from "./time-tracking";

export {
  calculateMetrics,
  getQuadrantPerformance
} from "./metrics";

export { getStreakData } from "./streaks";

export { calculateTagStatistics } from "./tags";

export {
  getCompletionTrend,
  getRecurrenceBreakdown
} from "./trends";

export {
  calculateTimeTrackingSummary,
  getTimeByQuadrant,
  formatDuration
} from "./time-tracking";
