import { getPocketBase } from '../pocketbase-client.js';
import type { GsdConfig, SyncStatus, TaskStats, PBTask } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('SYNC_STATUS');

/**
 * Get sync status from PocketBase health check
 */
export async function getSyncStatus(config: GsdConfig): Promise<SyncStatus> {
  const pb = getPocketBase(config);

  try {
    await pb.health.check();
    const taskCount = await pb.collection('tasks').getList<PBTask>(1, 1);

    return {
      healthy: true,
      taskCount: taskCount.totalItems,
      lastSyncAt: null, // PB doesn't have a "last sync" concept — it's always live
    };
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      healthy: false,
      taskCount: 0,
      lastSyncAt: null,
    };
  }
}

/**
 * Get task statistics from PocketBase
 */
export async function getTaskStats(config: GsdConfig): Promise<TaskStats> {
  const pb = getPocketBase(config);

  try {
    const allTasks = await pb.collection('tasks').getFullList<PBTask>({
      fields: 'task_id,completed,client_created_at,client_updated_at',
    });

    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);

    const dates = allTasks
      .map(t => t.client_created_at || t.created)
      .filter(Boolean)
      .sort();

    return {
      totalTasks: allTasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      lastUpdated: dates.length > 0 ? dates[dates.length - 1] : null,
      oldestTask: dates.length > 0 ? dates[0] : null,
      newestTask: dates.length > 0 ? dates[dates.length - 1] : null,
    };
  } catch (error) {
    logger.error('Failed to get task stats', error instanceof Error ? error : new Error(String(error)));
    return {
      totalTasks: null,
      activeTasks: null,
      completedTasks: null,
      lastUpdated: null,
      oldestTask: null,
      newestTask: null,
    };
  }
}
