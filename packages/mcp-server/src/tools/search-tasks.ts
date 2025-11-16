import { listTasks } from './list-tasks.js';
import type { GsdConfig, DecryptedTask } from '../types.js';

/**
 * Search tasks by title, description, tags, or subtasks
 * Case-insensitive search across all task fields
 */
export async function searchTasks(
  config: GsdConfig,
  query: string
): Promise<DecryptedTask[]> {
  const tasks = await listTasks(config);
  const queryLower = query.toLowerCase();

  return tasks.filter((task) => matchesSearchQuery(task, queryLower));
}

/**
 * Check if a task matches the search query
 */
function matchesSearchQuery(task: DecryptedTask, queryLower: string): boolean {
  return (
    task.title.toLowerCase().includes(queryLower) ||
    task.description.toLowerCase().includes(queryLower) ||
    matchesTaskTags(task.tags, queryLower) ||
    matchesSubtasks(task.subtasks, queryLower)
  );
}

/**
 * Check if any tag matches the search query
 */
function matchesTaskTags(tags: string[], queryLower: string): boolean {
  return tags.some((tag) => tag.toLowerCase().includes(queryLower));
}

/**
 * Check if any subtask matches the search query
 */
function matchesSubtasks(
  subtasks: Array<{ id: string; title: string; completed: boolean }>,
  queryLower: string
): boolean {
  return subtasks.some((subtask) => subtask.title.toLowerCase().includes(queryLower));
}
