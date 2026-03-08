import { getPocketBase } from '../pocketbase-client.js';
import { getTaskCache, generateTaskListCacheKey } from '../cache.js';
import { createMcpLogger } from '../utils/logger.js';
import type {
  GsdConfig,
  Task,
  TaskFilters,
  PBTask,
} from '../types.js';
import { pbTaskToTask } from '../types.js';

const logger = createMcpLogger('LIST_TASKS');

/**
 * List all tasks from PocketBase
 * Uses in-memory cache to reduce API calls
 */
export async function listTasks(
  config: GsdConfig,
  filters?: TaskFilters
): Promise<Task[]> {
  const cache = getTaskCache();
  const cacheKey = generateTaskListCacheKey(filters);

  // Check cache: for filtered requests, try the 'all' cache first and filter locally
  if (filters) {
    const cachedAll = cache.getTaskList('all');
    if (cachedAll) {
      return applyTaskFilters(cachedAll, filters);
    }
  } else {
    const cachedTasks = cache.getTaskList(cacheKey);
    if (cachedTasks) {
      return cachedTasks;
    }
  }

  // Fetch tasks from PocketBase
  const tasks = await fetchTasks(config);

  // Cache unfiltered results
  if (!filters) {
    cache.setTaskList(cacheKey, tasks);
  }

  return applyTaskFilters(tasks, filters);
}

/**
 * Fetch all tasks from PocketBase collection
 */
async function fetchTasks(config: GsdConfig): Promise<Task[]> {
  const pb = getPocketBase(config);

  try {
    const records = await pb.collection('tasks').getFullList<PBTask>({
      sort: '-client_updated_at',
    });

    return records.map((record) => {
      try {
        return pbTaskToTask(record);
      } catch (error) {
        logger.error(
          `Failed to map task ${record.id}`,
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    }).filter((task): task is Task => task !== null);
  } catch (error) {
    throw new Error(
      `Failed to fetch tasks from PocketBase\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please check:\n` +
        `  1. Your internet connection\n` +
        `  2. GSD_POCKETBASE_URL is correct\n` +
        `  3. Your auth token is valid\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }
}

/**
 * Apply filters to tasks
 */
function applyTaskFilters(
  tasks: Task[],
  filters?: TaskFilters
): Task[] {
  if (!filters) return tasks;

  return tasks.filter((task) => {
    if (filters.quadrant && task.quadrant !== filters.quadrant) {
      return false;
    }

    if (filters.completed !== undefined && task.completed !== filters.completed) {
      return false;
    }

    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !filters.tags.some((tag) => task.tags.includes(tag))
    ) {
      return false;
    }

    return true;
  });
}
