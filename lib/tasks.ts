/**
 * Task management module - main entry point
 *
 * This file re-exports all task-related functions from modular submodules
 * for backward compatibility with existing imports.
 *
 * Modular structure:
 * - tasks/crud.ts - Core CRUD operations (create, read, update, delete, toggle)
 * - tasks/subtasks.ts - Subtask management (add, delete, toggle)
 * - tasks/dependencies.ts - Dependency management (add, remove, cleanup)
 * - tasks/import-export.ts - Data import/export operations
 */

// CRUD operations
export {
  listTasks,
  createTask,
  updateTask,
  toggleCompleted,
  deleteTask,
  moveTaskToQuadrant,
  clearTasks,
  duplicateTask
} from "./tasks/crud";

// Subtask operations
export {
  toggleSubtask,
  addSubtask,
  deleteSubtask
} from "./tasks/subtasks";

// Dependency operations
export {
  addDependency,
  removeDependency,
  removeDependencyReferences
} from "./tasks/dependencies";

// Import/Export operations
export {
  exportTasks,
  importTasks,
  importFromJson,
  exportToJson
} from "./tasks/import-export";
