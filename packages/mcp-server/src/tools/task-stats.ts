import { listTasks } from './list-tasks.js';
import { getTaskStats } from './sync-status.js';
import type { GsdConfig, DecryptedTask } from '../types.js';
/**
 * Detailed task statistics derived from decrypted tasks
 */
export interface DetailedTaskStats {
  totalTasks: number;
  activeTasks: number;
  deletedTasks: number;
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
  oldestTaskDate: number | null;
  newestTaskDate: number | null;
  lastUpdated: number | null;
  storageUsed: number;
}

/**
 * Get detailed task statistics by fetching and decrypting tasks
 * Requires encryption passphrase to be set
 */
export async function getDetailedTaskStats(
  config: GsdConfig
): Promise<DetailedTaskStats> {
  // Fetch metadata counts from Supabase (no decryption needed)
  const metadata = await getTaskStats(config);

  // Fetch and decrypt all active tasks for detailed stats
  const decryptedTasks = await listTasks(config);

  return calculateDetailedStats(decryptedTasks, metadata);
}

/**
 * Calculate detailed statistics from decrypted tasks
 */
function calculateDetailedStats(
  tasks: DecryptedTask[],
  metadata: {
    totalTasks: number | null;
    activeTasks: number | null;
    deletedTasks: number | null;
    lastUpdated: number | null;
    oldestTask: number | null;
    newestTask: number | null;
  }
): DetailedTaskStats {
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

  const tagStats = calculateTagStats(tasks);

  // Use reduce instead of Math.max(...spread) to avoid stack overflow on large arrays
  const lastUpdated = tasks.length > 0
    ? tasks.reduce((max, t) => {
        const ts = new Date(t.updatedAt).getTime();
        return ts > max ? ts : max;
      }, -Infinity)
    : null;

  return {
    totalTasks: metadata.totalTasks ?? 0,
    activeTasks: metadata.activeTasks ?? 0,
    deletedTasks: metadata.deletedTasks ?? 0,
    completedTasks,
    incompleteTasks,
    quadrantCounts,
    tagStats,
    oldestTaskDate: metadata.oldestTask,
    newestTaskDate: metadata.newestTask,
    lastUpdated,
    storageUsed: metadata.activeTasks ?? 0,
  };
}

/**
 * Calculate per-tag statistics from decrypted tasks
 */
function calculateTagStats(
  tasks: DecryptedTask[]
): DetailedTaskStats['tagStats'] {
  const tagMap = new Map<string, { count: number; completedCount: number }>();

  for (const task of tasks) {
    for (const tag of task.tags || []) {
      const stats = tagMap.get(tag) || { count: 0, completedCount: 0 };
      stats.count++;
      if (task.completed) {
        stats.completedCount++;
      }
      tagMap.set(tag, stats);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      completedCount: stats.completedCount,
      completionRate:
        stats.count > 0
          ? Math.round((stats.completedCount / stats.count) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
