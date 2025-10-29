import {
  getSyncStatus,
  listDevices,
  getTaskStats,
  listTasks,
  getTask,
  searchTasks,
  type GsdConfig,
} from '../../tools.js';

/**
 * Read-only tool handlers for accessing task data and metadata
 */

export async function handleGetSyncStatus(config: GsdConfig) {
  const status = await getSyncStatus(config);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}

export async function handleListDevices(config: GsdConfig) {
  const devices = await listDevices(config);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(devices, null, 2),
      },
    ],
  };
}

export async function handleGetTaskStats(config: GsdConfig) {
  const stats = await getTaskStats(config);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
}

export async function handleListTasks(
  config: GsdConfig,
  args: { quadrant?: string; completed?: boolean; tags?: string[] }
) {
  const tasks = await listTasks(config, args);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(tasks, null, 2),
      },
    ],
  };
}

export async function handleGetTask(config: GsdConfig, args: { taskId: string }) {
  const task = await getTask(config, args.taskId);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(task, null, 2),
      },
    ],
  };
}

export async function handleSearchTasks(config: GsdConfig, args: { query: string }) {
  const tasks = await searchTasks(config, args.query);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(tasks, null, 2),
      },
    ],
  };
}
