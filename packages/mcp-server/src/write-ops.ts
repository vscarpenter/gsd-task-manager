/**
 * Write operations module - main entry point
 *
 * Re-exports all write operation functions from modular submodules.
 */

// Export type definitions
export type {
  CreateTaskInput,
  UpdateTaskInput,
  BulkOperation,
  WriteOptions,
} from './write-ops/types.js';

// Export helper functions
export {
  generateTaskId,
  deriveQuadrant,
  createTaskInPB,
  updateTaskInPB,
  deleteTaskInPB,
  getAuthInfo,
} from './write-ops/helpers.js';

// Export task operations and result types
export {
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  type CreateTaskResult,
  type UpdateTaskResult,
  type DeleteTaskResult,
} from './write-ops/task-operations.js';

// Export bulk operations
export { bulkUpdateTasks } from './write-ops/bulk-operations.js';
