/**
 * Write operations module - main entry point
 *
 * This file re-exports all write operation functions from modular submodules
 * for backward compatibility with existing imports.
 *
 * Modular structure:
 * - write-ops/types.ts - Type definitions and interfaces
 * - write-ops/helpers.ts - Helper functions (ID generation, encryption, sync push)
 * - write-ops/task-operations.ts - Individual task CRUD operations
 * - write-ops/bulk-operations.ts - Bulk update operations
 */

// Export type definitions
export type {
  CreateTaskInput,
  UpdateTaskInput,
  BulkOperation,
  SyncOperation,
  WriteOptions,
} from './write-ops/types.js';

// Export helper functions
export {
  generateTaskId,
  deriveQuadrant,
  ensureEncryption,
  pushToSync,
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
