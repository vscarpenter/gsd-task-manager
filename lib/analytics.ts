import type { TaskRecord, QuadrantId, RecurrenceType } from "@/lib/types";
import { startOfDay, startOfWeek, startOfMonth, subDays, isAfter, isBefore } from "date-fns";

/**
 * Core metrics for productivity tracking
 */
export interface ProductivityMetrics {
  // Completion counts
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;

  // Streaks
  activeStreak: number; // Consecutive days with completed tasks
  longestStreak: number;

  // Rates and distributions
  completionRate: number; // Percentage of completed vs total tasks
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
 * Statistics for a specific tag
 */
export interface TagStatistic {
  tag: string;
  count: number; // Total tasks with this tag
  completedCount: number;
  completionRate: number; // Percentage (0-100)
}

/**
 * Completion trend data point
 */
export interface TrendDataPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  completed: number;
  created: number;
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
 * Calculate all productivity metrics for given tasks
 */
export function calculateMetrics(tasks: TaskRecord[]): ProductivityMetrics {
  const now = new Date();
  const today = startOfDay(now);
  const thisWeekStart = startOfWeek(now);
  const thisMonthStart = startOfMonth(now);

  const completed = tasks.filter(t => t.completed);
  const active = tasks.filter(t => !t.completed);

  // Completion counts by time period
  const completedToday = completed.filter(t =>
    isAfter(new Date(t.updatedAt), today)
  ).length;

  const completedThisWeek = completed.filter(t =>
    isAfter(new Date(t.updatedAt), thisWeekStart)
  ).length;

  const completedThisMonth = completed.filter(t =>
    isAfter(new Date(t.updatedAt), thisMonthStart)
  ).length;

  // Streak calculation
  const streakData = getStreakData(tasks);

  // Completion rate
  const completionRate = tasks.length > 0
    ? Math.round((completed.length / tasks.length) * 100)
    : 0;

  // Quadrant distribution (of active tasks)
  const quadrantDistribution: Record<QuadrantId, number> = {
    "urgent-important": 0,
    "not-urgent-important": 0,
    "urgent-not-important": 0,
    "not-urgent-not-important": 0
  };

  active.forEach(task => {
    quadrantDistribution[task.quadrant]++;
  });

  // Tag statistics
  const tagStats = calculateTagStatistics(tasks);

  // Due date tracking
  const overdueCount = active.filter(t => t.dueDate && isBefore(new Date(t.dueDate), today)).length;
  const dueTodayCount = active.filter(t => isDueToday(t, today)).length;
  const dueThisWeekCount = active.filter(t => isDueThisWeek(t, today)).length;
  const noDueDateCount = active.filter(t => !t.dueDate).length;

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
    totalTasks: tasks.length
  };
}

/**
 * Get completion trend data for the last N days
 */
export function getCompletionTrend(tasks: TaskRecord[], days: number): TrendDataPoint[] {
  const now = new Date();
  const dataPoints: TrendDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(subDays(now, i));
    const nextDate = startOfDay(subDays(now, i - 1));
    const dateStr = date.toISOString().split('T')[0];

    const completed = tasks.filter(t => {
      if (!t.completed) return false;
      const updatedAt = new Date(t.updatedAt);
      return isAfter(updatedAt, date) && isBefore(updatedAt, nextDate);
    }).length;

    const created = tasks.filter(t => {
      const createdAt = new Date(t.createdAt);
      return isAfter(createdAt, date) && isBefore(createdAt, nextDate);
    }).length;

    dataPoints.push({
      date: dateStr,
      completed,
      created
    });
  }

  return dataPoints;
}

/**
 * Calculate current and longest streak of task completion
 * A streak is broken if a day passes without completing any tasks
 */
export function getStreakData(tasks: TaskRecord[]): StreakData {
  const completedTasks = tasks
    .filter(t => t.completed)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (completedTasks.length === 0) {
    return { current: 0, longest: 0, lastCompletionDate: null };
  }

  // Group tasks by completion date (YYYY-MM-DD)
  const completionDates = new Set<string>();
  completedTasks.forEach(task => {
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
    const daysDiff = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

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
    lastCompletionDate: uniqueDates[0] || null
  };
}

/**
 * Calculate statistics for each tag
 */
export function calculateTagStatistics(tasks: TaskRecord[]): TagStatistic[] {
  const tagMap = new Map<string, { total: number; completed: number }>();

  tasks.forEach(task => {
    task.tags.forEach(tag => {
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
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    });
  });

  // Sort by count descending
  return stats.sort((a, b) => b.count - a.count);
}

/**
 * Get task breakdown by recurrence type
 */
export function getRecurrenceBreakdown(tasks: TaskRecord[]): Record<RecurrenceType, number> {
  const breakdown: Record<RecurrenceType, number> = {
    none: 0,
    daily: 0,
    weekly: 0,
    monthly: 0
  };

  tasks.forEach(task => {
    if (!task.completed) {
      breakdown[task.recurrence]++;
    }
  });

  return breakdown;
}

/**
 * Helper: Check if task is due today
 */
function isDueToday(task: TaskRecord, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = startOfDay(new Date(task.dueDate));
  return dueDate.getTime() === today.getTime();
}

/**
 * Helper: Check if task is due this week
 */
function isDueThisWeek(task: TaskRecord, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = new Date(task.dueDate);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return isAfter(dueDate, today) && isBefore(dueDate, weekEnd);
}

/**
 * Get top performing quadrants by completion rate
 */
export function getQuadrantPerformance(tasks: TaskRecord[]): Array<{
  quadrantId: QuadrantId;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
}> {
  const quadrants: QuadrantId[] = [
    "urgent-important",
    "not-urgent-important",
    "urgent-not-important",
    "not-urgent-not-important"
  ];

  return quadrants.map(quadrantId => {
    const quadrantTasks = tasks.filter(t => t.quadrant === quadrantId);
    const completed = quadrantTasks.filter(t => t.completed).length;
    const total = quadrantTasks.length;

    return {
      quadrantId,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalTasks: total,
      completedTasks: completed
    };
  }).sort((a, b) => b.completionRate - a.completionRate);
}
