/**
 * Analytics module - Productivity metrics and task statistics
 *
 * This module provides comprehensive analytics for task management:
 * - Core metrics (completion rates, counts, distributions)
 * - Streak tracking (current and longest)
 * - Tag-based analytics
 * - Completion trends over time
 * - Recurrence breakdowns
 * - Quadrant performance analysis
 * - Time tracking analytics
 */

// Re-export all types
export type {
  ProductivityMetrics,
  TagStatistic,
  TrendDataPoint
} from "./metrics";

export type { StreakData } from "./streaks";

export type {
  TimeTrackingSummary,
  QuadrantTimeDistribution,
  TaskTimeComparison
} from "./time-tracking";

// Re-export all functions
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
  getTimeComparisonData,
  formatDuration
} from "./time-tracking";
