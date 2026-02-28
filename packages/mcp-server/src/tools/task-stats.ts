import { listTasks } from './list-tasks.js';
import type { GsdConfig, DecryptedTask } from '../types.js';

/**
 * Detailed task statistics derived from PocketBase tasks
 */
export interface DetailedTaskStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  quadrantCounts: {
    'urgent-important': number;
    'not-urgent-important': number;
    'urgent-not-important': number;
    'not-urgent-not-important': number;
  };
  tagStats: Array<{
    tag: string;
    count: number;
    completedCount: number;
    completionRate: number;
  }>;
  oldestTaskDate: string | null;
  newestTaskDate: string | null;
  lastUpdated: string | null;
}

/**
 * Get detailed task statistics from PocketBase
 */
export async function getDetailedTaskStats(
  config: GsdConfig
): Promise<DetailedTaskStats> {
  const tasks = await listTasks(config);
  return calculateDetailedStats(tasks);
}

/**
 * Calculate detailed statistics from tasks
 */
function calculateDetailedStats(tasks: DecryptedTask[]): DetailedTaskStats {
  const completedTasks = tasks.filter((t) => t.completed).length;
  const incompleteTasks = tasks.filter((t) => !t.completed).length;

  const quadrantCounts = {
    'urgent-important': 0,
    'not-urgent-important': 0,
    'urgent-not-important': 0,
    'not-urgent-not-important': 0,
  };

  for (const task of tasks) {
    const quadrant = task.quadrant as keyof typeof quadrantCounts;
    if (quadrant in quadrantCounts) {
      quadrantCounts[quadrant]++;
    }
  }

  const tagMap = new Map<string, { count: number; completedCount: number }>();

  for (const task of tasks) {
    for (const tag of task.tags || []) {
      const stats = tagMap.get(tag) || { count: 0, completedCount: 0 };
      stats.count++;
      if (task.completed) stats.completedCount++;
      tagMap.set(tag, stats);
    }
  }

  const tagStats = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      completedCount: stats.completedCount,
      completionRate: stats.count > 0 ? Math.round((stats.completedCount / stats.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const dates = tasks.map(t => t.createdAt).filter(Boolean).sort();

  return {
    totalTasks: tasks.length,
    activeTasks: incompleteTasks,
    completedTasks,
    incompleteTasks,
    quadrantCounts,
    tagStats,
    oldestTaskDate: dates[0] || null,
    newestTaskDate: dates[dates.length - 1] || null,
    lastUpdated: tasks.length > 0
      ? tasks.reduce((max, t) => t.updatedAt > max ? t.updatedAt : max, '')
      : null,
  };
}
