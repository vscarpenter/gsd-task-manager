import type { GsdConfig } from '../../tools.js';
import {
  handleGetSyncStatus,
  handleGetTaskStats,
  handleListTasks,
  handleGetTask,
  handleSearchTasks,
  handleGetTokenStatus,
} from './read-handlers.js';
import { handleGetTopThree } from './top-three-handler.js';
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
} from './write-handlers.js';
import {
  NO_CONFIRMATION,
  bulkUpdateWithConfirmation,
  deleteTaskWithConfirmation,
  type DeleteConfirmation,
} from './delete-confirmation.js';
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

export * from './read-handlers.js';
export * from './top-three-handler.js';
export * from './analytics-handlers.js';
export * from './write-handlers.js';
export * from './system-handlers.js';
export type { McpToolResponse } from './types.js';

import type { McpToolResponse, ToolCallResult } from './types.js';
import { sanitizePocketBaseWriteError } from '../../write-ops/write-rate-limiter.js';

type ToolRunner = (
  config: GsdConfig,
  args: Record<string, unknown>,
  confirmation: DeleteConfirmation
) => Promise<ToolCallResult>;

function createToolRunner<Name extends ToolName>(
  name: Name,
  handler: (config: GsdConfig, args: ToolArgs<Name>, confirmation: DeleteConfirmation) => Promise<ToolCallResult>
): ToolRunner {
  return async (config, args, confirmation) => handler(config, validateToolArgs(name, args), confirmation);
}

const toolRegistry = {
  get_sync_status: createToolRunner('get_sync_status', (config) => handleGetSyncStatus(config)),
  get_task_stats: createToolRunner('get_task_stats', (config) => handleGetTaskStats(config)),
  list_tasks: createToolRunner('list_tasks', handleListTasks),
  get_task: createToolRunner('get_task', handleGetTask),
  search_tasks: createToolRunner('search_tasks', handleSearchTasks),
  get_token_status: createToolRunner('get_token_status', (config) => handleGetTokenStatus(config)),
  get_top_three: createToolRunner('get_top_three', handleGetTopThree),
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
  delete_task: createToolRunner('delete_task', deleteTaskWithConfirmation),
  bulk_update_tasks: createToolRunner('bulk_update_tasks', bulkUpdateWithConfirmation),
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

const WRITE_TOOL_NAMES: ReadonlySet<ToolName> = new Set([
  'create_task',
  'update_task',
  'complete_task',
  'delete_task',
  'bulk_update_tasks',
]);

function isPocketBaseStatusError(error: unknown): boolean {
  return typeof (error as { status?: unknown } | null)?.status === 'number';
}

/** Without a confirmation to carry, no call can come back asking the user. */
export function handleToolCall(name: string, args: Record<string, unknown>, config: GsdConfig): Promise<McpToolResponse>;
export function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  config: GsdConfig,
  confirmation: DeleteConfirmation
): Promise<ToolCallResult>;
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  config: GsdConfig,
  confirmation: DeleteConfirmation = NO_CONFIRMATION
): Promise<ToolCallResult> {
  try {
    if (!isToolName(name)) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return await toolRegistry[name](config, args, confirmation);
  } catch (error) {
    const errorMessage = isToolName(name) && WRITE_TOOL_NAMES.has(name) &&
      isPocketBaseStatusError(error)
      ? sanitizePocketBaseWriteError(error).code
      : error instanceof Error ? error.message : 'Unknown error';
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
