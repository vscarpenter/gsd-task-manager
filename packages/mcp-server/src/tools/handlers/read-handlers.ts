import {
  getSyncStatus,
  listDevices,
  getTaskStats,
  listTasks,
  getTask,
  searchTasks,
  type GsdConfig,
} from '../../tools.js';
import { getPocketBase } from '../../pocketbase-client.js';
import type { McpToolResponse } from './types.js';

/**
 * Read-only tool handlers for accessing task data and metadata
 */

export async function handleGetSyncStatus(config: GsdConfig): Promise<McpToolResponse> {
  const status = await getSyncStatus(config);
  const pb = getPocketBase(config);

  const result = {
    ...status,
    authenticated: pb.authStore.isValid,
    pocketBaseUrl: config.pocketBaseUrl,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Handle get_token_status tool
 * Checks PocketBase auth store validity
 */
export async function handleGetTokenStatus(config: GsdConfig): Promise<McpToolResponse> {
  const pb = getPocketBase(config);
  const isValid = pb.authStore.isValid;

  const result = {
    status: isValid ? 'healthy' : 'expired',
    expired: !isValid,
    message: isValid
      ? 'PocketBase auth token is valid.'
      : 'Auth token is invalid or expired. Please re-authenticate.',
    instructions: !isValid
      ? [
          '1. Visit https://gsd.vinny.dev and log in',
          '2. Copy the PocketBase auth token from browser',
          '3. Update GSD_AUTH_TOKEN in Claude Desktop config',
          '4. Restart Claude Desktop',
        ]
      : null,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleListDevices(config: GsdConfig): Promise<McpToolResponse> {
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

export async function handleGetTaskStats(config: GsdConfig): Promise<McpToolResponse> {
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
): Promise<McpToolResponse> {
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

export async function handleGetTask(config: GsdConfig, args: { taskId: string }): Promise<McpToolResponse> {
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

export async function handleSearchTasks(config: GsdConfig, args: { query: string }): Promise<McpToolResponse> {
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
