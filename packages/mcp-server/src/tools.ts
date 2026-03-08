/**
 * GSD MCP Server Tools - Backward Compatibility Re-exports
 *
 * All functionality has been split into focused modules:
 * - pocketbase-client.ts - PocketBase SDK wrapper
 * - tools/*.ts - Individual tool implementations
 * - types.ts - Shared type definitions
 * - constants.ts - Shared constants
 */

// Re-export types
export type {
  GsdConfig,
  SyncStatus,
  Device,
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

// Re-export constants
export { MAX_TASKS_PER_PULL } from './constants.js';

// Re-export task tools
export { listTasks } from './tools/list-tasks.js';
export { getTask } from './tools/get-task.js';
export { searchTasks } from './tools/search-tasks.js';

// Re-export sync tools
export { getSyncStatus, getTaskStats } from './tools/sync-status.js';

// Re-export task stats tool
export { getDetailedTaskStats } from './tools/task-stats.js';
export type { DetailedTaskStats } from './tools/task-stats.js';

// Re-export device tools
export { listDevices } from './tools/devices.js';
