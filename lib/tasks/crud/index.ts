/**
 * Task CRUD Operations
 *
 * This module provides all task create, read, update, delete operations
 * with sync support and validation.
 *
 * Re-exports from modular files for backward compatibility.
 */

// List and clear operations
export { listTasks, clearTasks } from "./list";

// Create operation
export { createTask } from "./create";

// Update operation
export { updateTask } from "./update";

// Toggle completion (with recurring task support)
export { toggleCompleted } from "./toggle";

// Delete operation
export { deleteTask } from "./delete";

// Move to quadrant (drag-and-drop)
export { moveTaskToQuadrant } from "./move";

// Duplicate task
export { duplicateTask } from "./duplicate";

// Snooze operations
export { snoozeTask, clearSnooze, isTaskSnoozed, getRemainingSnoozeMinutes } from "./snooze";

// Time tracking operations
export {
  startTimeTracking,
  stopTimeTracking,
  deleteTimeEntry,
  hasRunningTimer,
  getRunningEntry,
  getRunningElapsedMinutes,
  formatTimeSpent,
  formatEstimate,
} from "./time-tracking";
