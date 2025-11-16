/**
 * GSD MCP Server Tools - Backward Compatibility Re-exports
 *
 * This file maintains backward compatibility after modularization.
 * All functionality has been split into focused modules:
 * - api/client.ts - HTTP requests and error handling
 * - encryption/manager.ts - Encryption initialization
 * - tools/*.ts - Individual tool implementations
 * - types.ts - Shared type definitions
 * - constants.ts - Shared constants
 */

// Re-export types and schemas
export type {
  GsdConfig,
  SyncStatus,
  Device,
  TaskStats,
  EncryptedTaskBlob,
  DecryptedTask,
  TaskFilters,
  PullTasksResponse,
} from './types.js';

export {
  syncStatusSchema,
  deviceSchema,
  taskStatsSchema,
  encryptedTaskBlobSchema,
} from './types.js';

// Re-export constants
export { MAX_TASKS_PER_PULL } from './constants.js';

// Re-export API client
export { apiRequest } from './api/client.js';

// Re-export encryption utilities
export { initializeEncryption } from './encryption/manager.js';

// Re-export task tools
export { listTasks } from './tools/list-tasks.js';
export { getTask } from './tools/get-task.js';
export { searchTasks } from './tools/search-tasks.js';

// Re-export sync tools
export { getSyncStatus, getTaskStats } from './tools/sync-status.js';

// Re-export device tools
export { listDevices } from './tools/devices.js';
