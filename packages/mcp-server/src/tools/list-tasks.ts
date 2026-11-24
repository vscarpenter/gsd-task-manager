import { confirmUsersPrincipal, getPocketBase } from '../pocketbase-client.js';
import {
  getTaskCache,
  taskCacheNamespace,
} from '../cache.js';
import { createMcpLogger } from '../utils/logger.js';
import type {
  GsdConfig,
  Task,
  TaskFilters,
  PBTask,
} from '../types.js';
import { pbTaskToTask } from '../types.js';
import { normalizeTag } from '../text/tags.js';

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
  const namespace = taskCacheNamespace(config);
  const cached = cache.getTaskList(namespace);
  if (cached) return applyTaskFilters(cached, filters);

  const generation = cache.generation;
  const tasks = await fetchTasks(config);

  // A write may have invalidated this snapshot while the read was in flight.
  if (cache.generation === generation) {
    cache.setTaskList(namespace, tasks);
  }

  return applyTaskFilters(tasks, filters);
}

/** Fetch directly from PocketBase, bypassing the read cache for write preflights. */
export function listTasksFresh(config: GsdConfig): Promise<Task[]> {
  return fetchTasks(config);
}

async function fetchTasks(config: GsdConfig): Promise<Task[]> {
  const records = await fetchTaskRecords(config);
  // A refused token reads as a guest, whose listing is empty too.
  if (records.length === 0) await confirmUsersPrincipal(config);

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
}

async function fetchTaskRecords(config: GsdConfig): Promise<PBTask[]> {
  const pb = getPocketBase(config);

  try {
    return await pb.collection('tasks').getFullList<PBTask>({
      sort: '-client_updated_at',
    });
  } catch (error) {
    const safeError = new Error(
      `Failed to fetch tasks from PocketBase\n\n` +
        `Please check:\n` +
        `  1. Your internet connection\n` +
        `  2. GSD_POCKETBASE_URL is correct\n` +
        `  3. Your auth token is valid\n\n` +
        `Run: gsd-mcp-server --validate`
    );
    const status = (error as { status?: unknown } | null)?.status;
    if (typeof status === 'number') Object.assign(safeError, { status });
    throw safeError;
  }
}

/** Stored tags may predate normalization, so compare their normalized form. */
function matchesAnyTag(stored: string[], wanted: string[]): boolean {
  const normalized = new Set(stored.map(normalizeTag));
  return wanted.some((tag) => normalized.has(tag));
}

function applyTaskFilters(
  tasks: Task[],
  filters?: TaskFilters
): Task[] {
  const active = tasks.filter((task) => !task.savedAt);
  if (!filters) return active;

  return active.filter((task) => {
    if (filters.quadrant && task.quadrant !== filters.quadrant) {
      return false;
    }

    if (filters.completed !== undefined && task.completed !== filters.completed) {
      return false;
    }

    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !matchesAnyTag(task.tags, filters.tags)
    ) {
      return false;
    }

    return true;
  });
}
