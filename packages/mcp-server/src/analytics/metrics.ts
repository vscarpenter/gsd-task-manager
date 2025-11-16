/**
 * Core productivity metrics calculation
 */

import type { DecryptedTask } from '../tools.js';
import { getStreakData } from './streaks.js';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
  isBefore,
  isDueToday,
  isDueThisWeek,
} from './date-utils.js';

/**
 * Task quadrant IDs
 */
export type QuadrantId =
  | 'urgent-important'
  | 'not-urgent-important'
  | 'urgent-not-important'
  | 'not-urgent-not-important';

/**
 * Core productivity metrics
 */
export interface ProductivityMetrics {
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  activeStreak: number;
  longestStreak: number;
  completionRate: number;
  quadrantDistribution: Record<QuadrantId, number>;
  tagStats: TagStatistic[];
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  noDueDateCount: number;
  activeTasks: number;
  completedTasks: number;
  totalTasks: number;
}

/**
 * Tag-based statistics
 */
export interface TagStatistic {
  tag: string;
  count: number;
  completedCount: number;
  completionRate: number;
}

/**
 * Quadrant performance metrics
 */
export interface QuadrantPerformance {
  quadrantId: QuadrantId;
  name: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
}

/**
 * Upcoming deadlines grouped by urgency
 */
export interface UpcomingDeadlines {
  overdue: DecryptedTask[];
  dueToday: DecryptedTask[];
  dueThisWeek: DecryptedTask[];
}

/**
 * Calculate all productivity metrics
 */
export function calculateMetrics(tasks: DecryptedTask[]): ProductivityMetrics {
  const now = new Date();
  const today = startOfDay(now);
  const thisWeekStart = startOfWeek(now);
  const thisMonthStart = startOfMonth(now);

  const completed = tasks.filter((t) => t.completed);
  const active = tasks.filter((t) => !t.completed);

  const completionCounts = calculateCompletionCounts(completed, today, thisWeekStart, thisMonthStart);
  const streakData = getStreakData(tasks);
  const completionRate = calculateCompletionRate(tasks.length, completed.length);
  const quadrantDistribution = calculateQuadrantDistribution(active);
  const tagStats = calculateTagStatistics(tasks);
  const dueDateMetrics = calculateDueDateMetrics(active, today);

  return {
    ...completionCounts,
    activeStreak: streakData.current,
    longestStreak: streakData.longest,
    completionRate,
    quadrantDistribution,
    tagStats,
    ...dueDateMetrics,
    activeTasks: active.length,
    completedTasks: completed.length,
    totalTasks: tasks.length,
  };
}

/**
 * Calculate completion counts by time period
 */
function calculateCompletionCounts(
  completed: DecryptedTask[],
  today: Date,
  weekStart: Date,
  monthStart: Date
) {
  return {
    completedToday: completed.filter((t) => isAfter(new Date(t.updatedAt), today)).length,
    completedThisWeek: completed.filter((t) => isAfter(new Date(t.updatedAt), weekStart)).length,
    completedThisMonth: completed.filter((t) => isAfter(new Date(t.updatedAt), monthStart)).length,
  };
}

/**
 * Calculate overall completion rate
 */
function calculateCompletionRate(totalCount: number, completedCount: number): number {
  return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
}

/**
 * Calculate quadrant distribution of active tasks
 */
function calculateQuadrantDistribution(active: DecryptedTask[]): Record<QuadrantId, number> {
  const distribution: Record<QuadrantId, number> = {
    'urgent-important': 0,
    'not-urgent-important': 0,
    'urgent-not-important': 0,
    'not-urgent-not-important': 0,
  };

  active.forEach((task) => {
    distribution[task.quadrant as QuadrantId]++;
  });

  return distribution;
}

/**
 * Calculate due date metrics
 */
function calculateDueDateMetrics(active: DecryptedTask[], today: Date) {
  return {
    overdueCount: active.filter((t) => t.dueDate && isBefore(new Date(t.dueDate), today)).length,
    dueTodayCount: active.filter((t) => isDueToday(t, today)).length,
    dueThisWeekCount: active.filter((t) => isDueThisWeek(t, today)).length,
    noDueDateCount: active.filter((t) => !t.dueDate).length,
  };
}

/**
 * Calculate tag statistics
 */
export function calculateTagStatistics(tasks: DecryptedTask[]): TagStatistic[] {
  const tagMap = buildTagMap(tasks);
  const stats = convertTagMapToStats(tagMap);
  return stats.sort((a, b) => b.count - a.count);
}

/**
 * Build tag map with counts
 */
function buildTagMap(tasks: DecryptedTask[]): Map<string, { total: number; completed: number }> {
  const tagMap = new Map<string, { total: number; completed: number }>();

  tasks.forEach((task) => {
    task.tags.forEach((tag) => {
      const existing = tagMap.get(tag) || { total: 0, completed: 0 };
      existing.total++;
      if (task.completed) {
        existing.completed++;
      }
      tagMap.set(tag, existing);
    });
  });

  return tagMap;
}

/**
 * Convert tag map to statistics array
 */
function convertTagMapToStats(
  tagMap: Map<string, { total: number; completed: number }>
): TagStatistic[] {
  const stats: TagStatistic[] = [];

  tagMap.forEach((data, tag) => {
    stats.push({
      tag,
      count: data.total,
      completedCount: data.completed,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    });
  });

  return stats;
}

/**
 * Get quadrant performance metrics
 */
export function getQuadrantPerformance(tasks: DecryptedTask[]): QuadrantPerformance[] {
  const quadrants = getQuadrantDefinitions();
  const performance = quadrants.map((quadrant) => calculateQuadrantMetrics(quadrant, tasks));
  return performance.sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Get quadrant definitions
 */
function getQuadrantDefinitions(): Array<{ id: QuadrantId; name: string }> {
  return [
    { id: 'urgent-important', name: 'Q1: Do First' },
    { id: 'not-urgent-important', name: 'Q2: Schedule' },
    { id: 'urgent-not-important', name: 'Q3: Delegate' },
    { id: 'not-urgent-not-important', name: 'Q4: Eliminate' },
  ];
}

/**
 * Calculate metrics for a single quadrant
 */
function calculateQuadrantMetrics(
  quadrant: { id: QuadrantId; name: string },
  tasks: DecryptedTask[]
): QuadrantPerformance {
  const quadrantTasks = tasks.filter((t) => t.quadrant === quadrant.id);
  const completed = quadrantTasks.filter((t) => t.completed).length;
  const active = quadrantTasks.filter((t) => !t.completed).length;
  const total = quadrantTasks.length;

  return {
    quadrantId: quadrant.id,
    name: quadrant.name,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalTasks: total,
    completedTasks: completed,
    activeTasks: active,
  };
}

/**
 * Get upcoming deadlines grouped by urgency
 */
export function getUpcomingDeadlines(tasks: DecryptedTask[]): UpcomingDeadlines {
  const now = new Date();
  const today = startOfDay(now);
  const active = tasks.filter((t) => !t.completed && t.dueDate);

  return {
    overdue: getOverdueTasks(active, today),
    dueToday: getDueTodayTasks(active, today),
    dueThisWeek: getDueThisWeekTasks(active, today),
  };
}

/**
 * Get overdue tasks sorted by due date
 */
function getOverdueTasks(active: DecryptedTask[], today: Date): DecryptedTask[] {
  return active
    .filter((t) => isBefore(new Date(t.dueDate!), today))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}

/**
 * Get tasks due today sorted by due date
 */
function getDueTodayTasks(active: DecryptedTask[], today: Date): DecryptedTask[] {
  return active
    .filter((t) => isDueToday(t, today))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}

/**
 * Get tasks due this week sorted by due date
 */
function getDueThisWeekTasks(active: DecryptedTask[], today: Date): DecryptedTask[] {
  return active
    .filter((t) => isDueThisWeek(t, today))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}
