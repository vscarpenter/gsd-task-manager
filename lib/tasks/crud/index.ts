/**
 * Task CRUD Operations
 *
 * This module provides all task create, read, update, delete operations
 * with sync support and validation.
 *
 * Re-exports from modular files for backward compatibility.
 */

export { listTasks, clearTasks } from "./list";

export { createTask } from "./create";

export { updateTask } from "./update";

export { toggleCompleted } from "./toggle";

export { deleteTask } from "./delete";

export { restoreTask } from "./restore";

export { moveTaskToQuadrant } from "./move";

export { duplicateTask } from "./duplicate";

export {
  snoozeTask,
  clearSnooze,
  isTaskSnoozed,
  getRemainingSnoozeMinutes,
  formatSnoozeRemaining,
} from "./snooze";

export {
  startTimeTracking,
  stopTimeTracking,
  hasRunningTimer,
  getRunningEntry,
  formatTimeSpent,
} from "./time-tracking";
