import type { TaskRecord } from "@/lib/types";
import type { TagStatistic } from "./metrics";

/**
 * Calculate statistics for each tag
 */
export function calculateTagStatistics(tasks: TaskRecord[]): TagStatistic[] {
  const tagMap = buildTagMap(tasks);
  const stats = convertTagMapToStats(tagMap);
  return sortByCountDescending(stats);
}

/**
 * Build map of tag counts and completions
 */
function buildTagMap(tasks: TaskRecord[]): Map<string, { total: number; completed: number }> {
  const tagMap = new Map<string, { total: number; completed: number }>();

  tasks.forEach(task => {
    task.tags.forEach(tag => {
      updateTagCounts(tagMap, tag, task.completed);
    });
  });

  return tagMap;
}

/**
 * Update counts for a single tag
 */
function updateTagCounts(
  tagMap: Map<string, { total: number; completed: number }>,
  tag: string,
  isCompleted: boolean
): void {
  const existing = tagMap.get(tag) || { total: 0, completed: 0 };
  existing.total++;
  if (isCompleted) {
    existing.completed++;
  }
  tagMap.set(tag, existing);
}

/**
 * Convert tag map to array of statistics
 */
function convertTagMapToStats(
  tagMap: Map<string, { total: number; completed: number }>
): TagStatistic[] {
  const stats: TagStatistic[] = [];

  tagMap.forEach((data, tag) => {
    stats.push(createTagStatistic(tag, data.total, data.completed));
  });

  return stats;
}

/**
 * Create a single tag statistic object
 */
function createTagStatistic(tag: string, total: number, completed: number): TagStatistic {
  return {
    tag,
    count: total,
    completedCount: completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * Sort tag statistics by count in descending order
 */
function sortByCountDescending(stats: TagStatistic[]): TagStatistic[] {
  return stats.sort((a, b) => b.count - a.count);
}
