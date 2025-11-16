/**
 * Analytics module - Re-exports for backward compatibility
 * Modularized from analytics.ts (419 lines → ~100 lines per module)
 */

// Type exports
export type {
  QuadrantId,
  ProductivityMetrics,
  TagStatistic,
  QuadrantPerformance,
  UpcomingDeadlines,
} from './metrics.js';

export type { StreakData } from './streaks.js';

// Core metrics functions
export {
  calculateMetrics,
  calculateTagStatistics,
  getQuadrantPerformance,
  getUpcomingDeadlines,
} from './metrics.js';

// Streak functions
export { getStreakData } from './streaks.js';

// Aggregation functions
export { generateInsightsSummary } from './aggregator.js';

// Date utilities (internal use but exported for testing)
export {
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
  isBefore,
  subDays,
  isDueToday,
  isDueThisWeek,
} from './date-utils.js';
