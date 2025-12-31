/**
 * Task CRUD Operations - Re-export Layer
 *
 * This file maintains backward compatibility for existing imports.
 * All operations have been modularized into lib/tasks/crud/ directory.
 *
 * @see lib/tasks/crud/index.ts for the modular implementation
 */

export {
  listTasks,
  clearTasks,
  createTask,
  updateTask,
  toggleCompleted,
  deleteTask,
  moveTaskToQuadrant,
  duplicateTask,
  snoozeTask,
  clearSnooze,
  isTaskSnoozed,
  getRemainingSnoozeMinutes,
  startTimeTracking,
  stopTimeTracking,
  deleteTimeEntry,
  hasRunningTimer,
  getRunningEntry,
  getRunningElapsedMinutes,
  formatTimeSpent,
  formatEstimate,
} from "./crud/index";
