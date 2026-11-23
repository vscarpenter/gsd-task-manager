import type { Task } from '../tools.js';
import { getStreakData } from './streaks.js';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  isBefore,
  completionTime,
  isDueToday,
  isDueThisWeek,
} from './date-utils.js';

export type QuadrantId =
  | 'urgent-important'
  | 'not-urgent-important'
  | 'urgent-not-important'
  | 'not-urgent-not-important';

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

export interface TagStatistic {
  tag: string;
  count: number;
  completedCount: number;
  completionRate: number;
}

export interface QuadrantPerformance {
  quadrantId: QuadrantId;
  name: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
}

export interface UpcomingDeadlines {
  overdue: Task[];
  dueToday: Task[];
  dueThisWeek: Task[];
}

export function calculateMetrics(tasks: Task[]): ProductivityMetrics {
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

function calculateCompletionCounts(
  completed: Task[],
  today: Date,
  weekStart: Date,
  monthStart: Date
) {
  const completedSince = (start: Date) =>
    completed.filter((t) => !isBefore(completionTime(t), start)).length;

  return {
    completedToday: completedSince(today),
    completedThisWeek: completedSince(weekStart),
    completedThisMonth: completedSince(monthStart),
  };
}

function calculateCompletionRate(totalCount: number, completedCount: number): number {
  return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
}

function calculateQuadrantDistribution(active: Task[]): Record<QuadrantId, number> {
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

function calculateDueDateMetrics(active: Task[], today: Date) {
  return {
    overdueCount: active.filter((t) => t.dueDate && isBefore(new Date(t.dueDate), today)).length,
    dueTodayCount: active.filter((t) => isDueToday(t, today)).length,
    dueThisWeekCount: active.filter((t) => isDueThisWeek(t, today)).length,
    noDueDateCount: active.filter((t) => !t.dueDate).length,
  };
}

function calculateTagStatistics(tasks: Task[]): TagStatistic[] {
  const tagMap = buildTagMap(tasks);
  const stats = convertTagMapToStats(tagMap);
  return stats.sort((a, b) => b.count - a.count);
}

function buildTagMap(tasks: Task[]): Map<string, { total: number; completed: number }> {
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

export function getQuadrantPerformance(tasks: Task[]): QuadrantPerformance[] {
  const quadrants = getQuadrantDefinitions();
  const performance = quadrants.map((quadrant) => calculateQuadrantMetrics(quadrant, tasks));
  return performance.sort((a, b) => b.completionRate - a.completionRate);
}

function getQuadrantDefinitions(): Array<{ id: QuadrantId; name: string }> {
  return [
    { id: 'urgent-important', name: 'Q1: Do First' },
    { id: 'not-urgent-important', name: 'Q2: Schedule' },
    { id: 'urgent-not-important', name: 'Q3: Delegate' },
    { id: 'not-urgent-not-important', name: 'Q4: Eliminate' },
  ];
}

function calculateQuadrantMetrics(
  quadrant: { id: QuadrantId; name: string },
  tasks: Task[]
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

export function getUpcomingDeadlines(tasks: Task[]): UpcomingDeadlines {
  const now = new Date();
  const today = startOfDay(now);
  const active = tasks.filter((t) => !t.completed && t.dueDate);

  return {
    overdue: getOverdueTasks(active, today),
    dueToday: getDueTodayTasks(active, today),
    dueThisWeek: getDueThisWeekTasks(active, today),
  };
}

function getOverdueTasks(active: Task[], today: Date): Task[] {
  return active
    .filter((t) => isBefore(new Date(t.dueDate!), today))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}

function getDueTodayTasks(active: Task[], today: Date): Task[] {
  return active
    .filter((t) => isDueToday(t, today))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}

function getDueThisWeekTasks(active: Task[], today: Date): Task[] {
  return active
    .filter((t) => isDueThisWeek(t, today))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}
