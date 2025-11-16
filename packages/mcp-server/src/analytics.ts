/**
 * Analytics utilities for task productivity metrics
 * Backward compatibility re-export from modular analytics/
 *
 * @deprecated Import from './analytics/index.js' instead
 */

export type {
  QuadrantId,
  ProductivityMetrics,
  TagStatistic,
  QuadrantPerformance,
  UpcomingDeadlines,
} from './analytics/index.js';

export type { StreakData } from './analytics/index.js';

export {
  calculateMetrics,
  calculateTagStatistics,
  getQuadrantPerformance,
  getUpcomingDeadlines,
  getStreakData,
  generateInsightsSummary,
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
  isBefore,
  subDays,
  isDueToday,
  isDueThisWeek,
} from './analytics/index.js';
