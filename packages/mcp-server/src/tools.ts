/**
 * GSD MCP Server Tools - Backward Compatibility Re-exports
 *
 * All functionality has been split into focused modules:
 * - pocketbase-client.ts - PocketBase SDK wrapper
 * - tools/*.ts - Individual tool implementations
 * - types.ts - Shared type definitions
 * - constants.ts - Shared constants
 */

export type {
  GsdConfig,
  SyncStatus,
  TaskStats,
  Task,
  TaskFilters,
  PBTask,
} from './types.js';

export {
  syncStatusSchema,
  pbTaskToTask,
  taskToPBFields,
} from './types.js';

export { listTasks } from './tools/list-tasks.js';
export { getTask } from './tools/get-task.js';
export { searchTasks } from './tools/search-tasks.js';

export { getSyncStatus, getTaskStats } from './tools/sync-status.js';
