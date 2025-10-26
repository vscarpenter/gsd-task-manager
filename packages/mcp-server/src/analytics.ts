/**
 * Analytics utilities for task productivity metrics
 * Ported from frontend lib/analytics.ts
 */

import type { DecryptedTask } from './tools.js';

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
  // Completion counts
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;

  // Streaks
  activeStreak: number;
  longestStreak: number;

  // Rates and distributions
  completionRate: number; // Percentage (0-100)
  quadrantDistribution: Record<QuadrantId, number>;

  // Tag statistics
  tagStats: TagStatistic[];

  // Due date tracking
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  noDueDateCount: number;

  // Task counts
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
  completionRate: number; // Percentage (0-100)
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
 * Streak data
 */
export interface StreakData {
  current: number;
  longest: number;
  lastCompletionDate: string | null;
}

/**
 * Date utilities (no date-fns dependency)
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday as start of week
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}

function isBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() < date2.getTime();
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
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

  // Completion counts by time period
  const completedToday = completed.filter((t) => isAfter(new Date(t.updatedAt), today)).length;

  const completedThisWeek = completed.filter((t) =>
    isAfter(new Date(t.updatedAt), thisWeekStart)
  ).length;

  const completedThisMonth = completed.filter((t) =>
    isAfter(new Date(t.updatedAt), thisMonthStart)
  ).length;

  // Streak calculation
  const streakData = getStreakData(tasks);

  // Completion rate
  const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

  // Quadrant distribution (of active tasks)
  const quadrantDistribution: Record<QuadrantId, number> = {
    'urgent-important': 0,
    'not-urgent-important': 0,
    'urgent-not-important': 0,
    'not-urgent-not-important': 0,
  };

  active.forEach((task) => {
    quadrantDistribution[task.quadrant as QuadrantId]++;
  });

  // Tag statistics
  const tagStats = calculateTagStatistics(tasks);

  // Due date tracking
  const overdueCount = active.filter(
    (t) => t.dueDate && isBefore(new Date(t.dueDate), today)
  ).length;
  const dueTodayCount = active.filter((t) => isDueToday(t, today)).length;
  const dueThisWeekCount = active.filter((t) => isDueThisWeek(t, today)).length;
  const noDueDateCount = active.filter((t) => !t.dueDate).length;

  return {
    completedToday,
    completedThisWeek,
    completedThisMonth,
    activeStreak: streakData.current,
    longestStreak: streakData.longest,
    completionRate,
    quadrantDistribution,
    tagStats,
    overdueCount,
    dueTodayCount,
    dueThisWeekCount,
    noDueDateCount,
    activeTasks: active.length,
    completedTasks: completed.length,
    totalTasks: tasks.length,
  };
}

/**
 * Calculate current and longest streak
 */
export function getStreakData(tasks: DecryptedTask[]): StreakData {
  const completedTasks = tasks
    .filter((t) => t.completed)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (completedTasks.length === 0) {
    return { current: 0, longest: 0, lastCompletionDate: null };
  }

  // Group tasks by completion date (YYYY-MM-DD)
  const completionDates = new Set<string>();
  completedTasks.forEach((task) => {
    const date = new Date(task.updatedAt).toISOString().split('T')[0];
    completionDates.add(date);
  });

  const uniqueDates = Array.from(completionDates).sort().reverse();

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);

  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];

    if (uniqueDates.includes(dateStr)) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const daysDiff = Math.round(
      (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return {
    current: currentStreak,
    longest: longestStreak,
    lastCompletionDate: uniqueDates[0] || null,
  };
}

/**
 * Calculate tag statistics
 */
export function calculateTagStatistics(tasks: DecryptedTask[]): TagStatistic[] {
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

  const stats: TagStatistic[] = [];
  tagMap.forEach((data, tag) => {
    stats.push({
      tag,
      count: data.total,
      completedCount: data.completed,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    });
  });

  // Sort by count descending
  return stats.sort((a, b) => b.count - a.count);
}

/**
 * Get quadrant performance metrics
 */
export function getQuadrantPerformance(tasks: DecryptedTask[]): QuadrantPerformance[] {
  const quadrants: Array<{ id: QuadrantId; name: string }> = [
    { id: 'urgent-important', name: 'Q1: Do First' },
    { id: 'not-urgent-important', name: 'Q2: Schedule' },
    { id: 'urgent-not-important', name: 'Q3: Delegate' },
    { id: 'not-urgent-not-important', name: 'Q4: Eliminate' },
  ];

  return quadrants
    .map((quadrant) => {
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
    })
    .sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Get upcoming deadlines grouped by urgency
 */
export function getUpcomingDeadlines(tasks: DecryptedTask[]): UpcomingDeadlines {
  const now = new Date();
  const today = startOfDay(now);
  const active = tasks.filter((t) => !t.completed && t.dueDate);

  return {
    overdue: active
      .filter((t) => isBefore(new Date(t.dueDate!), today))
      .sort((a, b) => a.dueDate! - b.dueDate!),
    dueToday: active.filter((t) => isDueToday(t, today)).sort((a, b) => a.dueDate! - b.dueDate!),
    dueThisWeek: active
      .filter((t) => isDueThisWeek(t, today))
      .sort((a, b) => a.dueDate! - b.dueDate!),
  };
}

/**
 * Generate AI-friendly task insights summary
 */
export function generateInsightsSummary(tasks: DecryptedTask[]): string {
  const metrics = calculateMetrics(tasks);
  const quadrants = getQuadrantPerformance(tasks);
  const deadlines = getUpcomingDeadlines(tasks);

  const insights: string[] = [];

  // Overall summary
  insights.push(
    `Task Overview: ${metrics.totalTasks} total tasks (${metrics.activeTasks} active, ${metrics.completedTasks} completed)`
  );
  insights.push(`Completion Rate: ${metrics.completionRate}%`);

  // Streaks
  if (metrics.activeStreak > 0) {
    insights.push(
      `Current Streak: ${metrics.activeStreak} day${metrics.activeStreak > 1 ? 's' : ''} (longest: ${metrics.longestStreak})`
    );
  }

  // Recent activity
  if (metrics.completedToday > 0) {
    insights.push(`Completed Today: ${metrics.completedToday} task${metrics.completedToday > 1 ? 's' : ''}`);
  }

  // Deadlines
  if (deadlines.overdue.length > 0) {
    insights.push(
      `⚠️  ${deadlines.overdue.length} overdue task${deadlines.overdue.length > 1 ? 's' : ''}`
    );
  }
  if (deadlines.dueToday.length > 0) {
    insights.push(`${deadlines.dueToday.length} task${deadlines.dueToday.length > 1 ? 's' : ''} due today`);
  }

  // Quadrant distribution
  const topQuadrant = quadrants[0];
  if (topQuadrant && topQuadrant.activeTasks > 0) {
    insights.push(
      `Most tasks in ${topQuadrant.name}: ${topQuadrant.activeTasks} active (${topQuadrant.completionRate}% completion rate)`
    );
  }

  // Tag insights
  if (metrics.tagStats.length > 0) {
    const topTag = metrics.tagStats[0];
    insights.push(`Most used tag: ${topTag.tag} (${topTag.count} tasks, ${topTag.completionRate}% completed)`);
  }

  return insights.join('\n');
}

/**
 * Helper: Check if task is due today
 */
function isDueToday(task: DecryptedTask, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = startOfDay(new Date(task.dueDate));
  return dueDate.getTime() === today.getTime();
}

/**
 * Helper: Check if task is due this week
 */
function isDueThisWeek(task: DecryptedTask, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = new Date(task.dueDate);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return isAfter(dueDate, today) && isBefore(dueDate, weekEnd);
}
