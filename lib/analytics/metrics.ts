import type { TaskRecord, QuadrantId } from "@/lib/types";
import { startOfDay, startOfWeek, startOfMonth, isAfter, isBefore } from "date-fns";
import { getStreakData } from "./streaks";
import { calculateTagStatistics } from "./tags";

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
 * Calculate all productivity metrics for given tasks
 */
export function calculateMetrics(tasks: TaskRecord[]): ProductivityMetrics {
  const now = new Date();
  const today = startOfDay(now);

  const completed = tasks.filter(t => t.completed);
  const active = tasks.filter(t => !t.completed);

  const completionCounts = calculateCompletionCounts(completed, now, today);
  const streakData = getStreakData(tasks);
  const completionRate = calculateCompletionRate(tasks.length, completed.length);
  const quadrantDistribution = buildQuadrantDistribution(active);
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
    totalTasks: tasks.length
  };
}

/**
 * Calculate completion counts for different time periods
 */
function calculateCompletionCounts(completed: TaskRecord[], now: Date, today: Date) {
  return {
    completedToday: countCompletedInPeriod(completed, today),
    completedThisWeek: countCompletedInPeriod(completed, startOfWeek(now)),
    completedThisMonth: countCompletedInPeriod(completed, startOfMonth(now))
  };
}

/**
 * Count completed tasks after a given date
 */
function countCompletedInPeriod(completed: TaskRecord[], startDate: Date): number {
  return completed.filter(t => isAfter(new Date(t.updatedAt), startDate)).length;
}

/**
 * Calculate completion rate as percentage
 */
function calculateCompletionRate(total: number, completed: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Build quadrant distribution for active tasks
 */
function buildQuadrantDistribution(active: TaskRecord[]): Record<QuadrantId, number> {
  const distribution: Record<QuadrantId, number> = {
    "urgent-important": 0,
    "not-urgent-important": 0,
    "urgent-not-important": 0,
    "not-urgent-not-important": 0
  };

  active.forEach(task => {
    distribution[task.quadrant]++;
  });

  return distribution;
}

/**
 * Calculate due date-related metrics
 */
function calculateDueDateMetrics(active: TaskRecord[], today: Date) {
  return {
    overdueCount: countOverdue(active, today),
    dueTodayCount: countDueToday(active, today),
    dueThisWeekCount: countDueThisWeek(active, today),
    noDueDateCount: active.filter(t => !t.dueDate).length
  };
}

/**
 * Count overdue tasks
 */
function countOverdue(tasks: TaskRecord[], today: Date): number {
  return tasks.filter(t => t.dueDate && isBefore(new Date(t.dueDate), today)).length;
}

/**
 * Count tasks due today
 */
function countDueToday(tasks: TaskRecord[], today: Date): number {
  return tasks.filter(t => isDueToday(t, today)).length;
}

/**
 * Count tasks due this week
 */
function countDueThisWeek(tasks: TaskRecord[], today: Date): number {
  return tasks.filter(t => isDueThisWeek(t, today)).length;
}

/**
 * Check if task is due today
 */
function isDueToday(task: TaskRecord, today: Date): boolean {
  if (!task.dueDate) return false;
  const dueDate = startOfDay(new Date(task.dueDate));
  return dueDate.getTime() === today.getTime();
}

/**
 * Check if task is due this week
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

  return quadrants
    .map(quadrantId => calculateQuadrantStats(tasks, quadrantId))
    .sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Calculate statistics for a single quadrant
 */
function calculateQuadrantStats(tasks: TaskRecord[], quadrantId: QuadrantId) {
  const quadrantTasks = tasks.filter(t => t.quadrant === quadrantId);
  const completed = quadrantTasks.filter(t => t.completed).length;
  const total = quadrantTasks.length;

  return {
    quadrantId,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalTasks: total,
    completedTasks: completed
  };
}
