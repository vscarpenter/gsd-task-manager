/**
 * Tool handler dispatcher
 * Routes tool calls to appropriate handler functions
 */

import type { GsdConfig } from '../../tools.js';
import {
  handleGetSyncStatus,
  handleListDevices,
  handleGetTaskStats,
  handleListTasks,
  handleGetTask,
  handleSearchTasks,
  handleGetTokenStatus,
} from './read-handlers.js';
import {
  handleGetProductivityMetrics,
  handleGetQuadrantAnalysis,
  handleGetTagAnalytics,
  handleGetUpcomingDeadlines,
  handleGetTaskInsights,
} from './analytics-handlers.js';
import {
  handleCreateTask,
  handleUpdateTask,
  handleCompleteTask,
  handleDeleteTask,
  handleBulkUpdateTasks,
} from './write-handlers.js';
import {
  handleValidateConfig,
  handleGetHelp,
  handleGetCacheStats,
} from './system-handlers.js';
import {
  toolArgSchemas,
  validateToolArgs,
  type ToolArgs,
  type ToolName,
} from './input-schemas.js';

// Re-export all handlers
export * from './read-handlers.js';
export * from './analytics-handlers.js';
export * from './write-handlers.js';
export * from './system-handlers.js';
export type { McpToolResponse } from './types.js';

import type { McpToolResponse } from './types.js';

type ToolRunner = (
  config: GsdConfig,
  args: Record<string, unknown>
) => Promise<McpToolResponse>;

function createToolRunner<Name extends ToolName>(
  name: Name,
  handler: (config: GsdConfig, args: ToolArgs<Name>) => Promise<McpToolResponse>
): ToolRunner {
  return async (config, args) => handler(config, validateToolArgs(name, args));
}

const toolRegistry = {
  get_sync_status: createToolRunner('get_sync_status', (config) => handleGetSyncStatus(config)),
  list_devices: createToolRunner('list_devices', (config) => handleListDevices(config)),
  get_task_stats: createToolRunner('get_task_stats', (config) => handleGetTaskStats(config)),
  list_tasks: createToolRunner('list_tasks', handleListTasks),
  get_task: createToolRunner('get_task', handleGetTask),
  search_tasks: createToolRunner('search_tasks', handleSearchTasks),
  get_token_status: createToolRunner('get_token_status', (config) => handleGetTokenStatus(config)),
  get_productivity_metrics: createToolRunner(
    'get_productivity_metrics',
    (config) => handleGetProductivityMetrics(config)
  ),
  get_quadrant_analysis: createToolRunner(
    'get_quadrant_analysis',
    (config) => handleGetQuadrantAnalysis(config)
  ),
  get_tag_analytics: createToolRunner('get_tag_analytics', handleGetTagAnalytics),
  get_upcoming_deadlines: createToolRunner(
    'get_upcoming_deadlines',
    (config) => handleGetUpcomingDeadlines(config)
  ),
  get_task_insights: createToolRunner('get_task_insights', (config) => handleGetTaskInsights(config)),
  create_task: createToolRunner('create_task', handleCreateTask),
  update_task: createToolRunner('update_task', handleUpdateTask),
  complete_task: createToolRunner('complete_task', handleCompleteTask),
  delete_task: createToolRunner('delete_task', handleDeleteTask),
  bulk_update_tasks: createToolRunner('bulk_update_tasks', handleBulkUpdateTasks),
  validate_config: createToolRunner('validate_config', (config) => handleValidateConfig(config)),
  get_help: createToolRunner('get_help', (_config, args) => handleGetHelp(args)),
  get_cache_stats: createToolRunner('get_cache_stats', (_config, args) => handleGetCacheStats(args)),
} satisfies Record<ToolName, ToolRunner>;

export const REGISTERED_TOOL_NAMES = Object.freeze(
  Object.keys(toolRegistry) as ToolName[]
);

function isToolName(name: string): name is ToolName {
  return Object.hasOwn(toolArgSchemas, name);
}

/**
 * Handle a tool call request
 * @param name - Tool name
 * @param args - Tool arguments
 * @param config - GSD configuration
 * @returns Tool response content
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  config: GsdConfig
): Promise<McpToolResponse> {
  try {
    if (!isToolName(name)) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return await toolRegistry[name](config, args);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
