/**
 * Bulk operations for managing multiple tasks at once.
 * Extracted from matrix-board.tsx to reduce file complexity.
 */

import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import { deleteTask, toggleCompleted, moveTaskToQuadrant, updateTask } from "@/lib/tasks";
import { quadrants } from "@/lib/quadrants";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";
import { TOAST_DURATION } from "@/lib/constants";

/**
 * Clear selection state and exit selection mode.
 */
export function clearSelection(
  setSelectedTaskIds: (ids: Set<string>) => void,
  setSelectionMode: (enabled: boolean) => void
): void {
  setSelectedTaskIds(new Set());
  setSelectionMode(false);
}

/**
 * Toggle selection mode on or off.
 * When exiting, automatically clears all selections.
 */
export function toggleSelectionMode(
  selectionMode: boolean,
  clearSelectionFn: () => void,
  setSelectionMode: (enabled: boolean) => void
): void {
  if (selectionMode) {
    // Exiting selection mode - clear selections
    clearSelectionFn();
  } else {
    // Entering selection mode
    setSelectionMode(true);
  }
}

/**
 * Delete all selected tasks.
 */
export async function bulkDelete(
  selectedTaskIds: Set<string>,
  allTasks: TaskRecord[],
  onSuccess: (message: string) => void,
  onError: (error: unknown, context: any) => void
): Promise<void> {
  if (selectedTaskIds.size === 0) return;

  const tasksToDelete = allTasks.filter(t => selectedTaskIds.has(t.id));
  const count = tasksToDelete.length;

  try {
    await Promise.all(tasksToDelete.map(task => deleteTask(task.id)));
    onSuccess(`Deleted ${count} task${count === 1 ? "" : "s"}`);
  } catch (error) {
    onError(error, {
      action: ErrorActions.DELETE_TASK,
      userMessage: ErrorMessages.TASK_DELETE_FAILED,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Mark all selected tasks as completed.
 * Only affects tasks that are not already completed.
 */
export async function bulkComplete(
  selectedTaskIds: Set<string>,
  allTasks: TaskRecord[],
  onSuccess: (message: string) => void,
  onError: (error: unknown, context: any) => void
): Promise<void> {
  if (selectedTaskIds.size === 0) return;

  const tasksToComplete = allTasks.filter(t => selectedTaskIds.has(t.id) && !t.completed);
  const count = tasksToComplete.length;

  try {
    await Promise.all(tasksToComplete.map(task => toggleCompleted(task.id, true)));
    onSuccess(`Completed ${count} task${count === 1 ? "" : "s"}`);
  } catch (error) {
    onError(error, {
      action: ErrorActions.TOGGLE_TASK,
      userMessage: ErrorMessages.TASK_UPDATE_FAILED,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Mark all selected tasks as incomplete.
 * Only affects tasks that are currently completed.
 */
export async function bulkUncomplete(
  selectedTaskIds: Set<string>,
  allTasks: TaskRecord[],
  onSuccess: (message: string) => void,
  onError: (error: unknown, context: any) => void
): Promise<void> {
  if (selectedTaskIds.size === 0) return;

  const tasksToUncomplete = allTasks.filter(t => selectedTaskIds.has(t.id) && t.completed);
  const count = tasksToUncomplete.length;

  try {
    await Promise.all(tasksToUncomplete.map(task => toggleCompleted(task.id, false)));
    onSuccess(`Marked ${count} task${count === 1 ? "" : "s"} as incomplete`);
  } catch (error) {
    onError(error, {
      action: ErrorActions.TOGGLE_TASK,
      userMessage: ErrorMessages.TASK_UPDATE_FAILED,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Move all selected tasks to a specific quadrant.
 */
export async function bulkMoveToQuadrant(
  selectedTaskIds: Set<string>,
  allTasks: TaskRecord[],
  quadrantId: QuadrantId,
  onSuccess: (message: string) => void,
  onError: (error: unknown, context: any) => void
): Promise<void> {
  if (selectedTaskIds.size === 0) return;

  const tasksToMove = allTasks.filter(t => selectedTaskIds.has(t.id));
  const count = tasksToMove.length;

  try {
    await Promise.all(tasksToMove.map(task => moveTaskToQuadrant(task.id, quadrantId)));
    const quadrantName = quadrants.find(q => q.id === quadrantId)?.title;
    onSuccess(`Moved ${count} task${count === 1 ? "" : "s"} to ${quadrantName}`);
  } catch (error) {
    onError(error, {
      action: ErrorActions.MOVE_TASK,
      userMessage: ErrorMessages.TASK_MOVE_FAILED,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Add tags to all selected tasks.
 * Automatically deduplicates tags (won't add tags that already exist on a task).
 */
export async function bulkAddTags(
  tagsToAdd: string[],
  selectedTaskIds: Set<string>,
  allTasks: TaskRecord[],
  toDraft: (task: TaskRecord) => TaskDraft,
  onSuccess: (message: string) => void,
  onError: (error: unknown, context: any) => void
): Promise<void> {
  if (selectedTaskIds.size === 0 || tagsToAdd.length === 0) return;

  const tasksToUpdate = allTasks.filter(t => selectedTaskIds.has(t.id));
  const count = tasksToUpdate.length;

  try {
    await Promise.all(
      tasksToUpdate.map(task => {
        const existingTags = new Set(task.tags);
        tagsToAdd.forEach(tag => existingTags.add(tag));
        return updateTask(task.id, { ...toDraft(task), tags: Array.from(existingTags) });
      })
    );
    onSuccess(`Added tags to ${count} task${count === 1 ? "" : "s"}`);
  } catch (error) {
    onError(error, {
      action: ErrorActions.UPDATE_TASK,
      userMessage: ErrorMessages.TASK_UPDATE_FAILED,
      timestamp: new Date().toISOString()
    });
  }
}
