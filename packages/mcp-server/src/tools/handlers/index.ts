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

// Re-export all handlers
export * from './read-handlers.js';
export * from './analytics-handlers.js';
export * from './write-handlers.js';
export * from './system-handlers.js';

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
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedArgs = args as any;
    switch (name) {
      // Read tools
      case 'get_sync_status':
        return await handleGetSyncStatus(config);

      case 'list_devices':
        return await handleListDevices(config);

      case 'get_task_stats':
        return await handleGetTaskStats(config);

      case 'list_tasks':
        return await handleListTasks(config, typedArgs);

      case 'get_task':
        return await handleGetTask(config, typedArgs);

      case 'search_tasks':
        return await handleSearchTasks(config, typedArgs);

      case 'get_token_status':
        return await handleGetTokenStatus(config);

      // Analytics tools
      case 'get_productivity_metrics':
        return await handleGetProductivityMetrics(config);

      case 'get_quadrant_analysis':
        return await handleGetQuadrantAnalysis(config);

      case 'get_tag_analytics':
        return await handleGetTagAnalytics(config, typedArgs);

      case 'get_upcoming_deadlines':
        return await handleGetUpcomingDeadlines(config);

      case 'get_task_insights':
        return await handleGetTaskInsights(config);

      // Write tools
      case 'create_task':
        return await handleCreateTask(config, typedArgs);

      case 'update_task':
        return await handleUpdateTask(config, typedArgs);

      case 'complete_task':
        return await handleCompleteTask(config, typedArgs);

      case 'delete_task':
        return await handleDeleteTask(config, typedArgs);

      case 'bulk_update_tasks':
        return await handleBulkUpdateTasks(config, typedArgs);

      // System tools
      case 'validate_config':
        return await handleValidateConfig(config);

      case 'get_help':
        return await handleGetHelp(typedArgs);

      case 'get_cache_stats':
        return await handleGetCacheStats(typedArgs);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
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
