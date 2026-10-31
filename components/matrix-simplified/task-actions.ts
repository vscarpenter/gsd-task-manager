"use client";

import { toast } from "sonner";

import { createTask, toggleCompleted, deleteTask, snoozeTask, clearSnooze, duplicateTask, moveTaskToQuadrant } from "@/lib/tasks";
import { saveTaskForLater, returnSavedTask } from "@/lib/tasks/saved";
import { celebrateCompletion } from "@/lib/confetti";
import { extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
import { ErrorActions, logError } from "@/lib/error-logger";
import { quadrantForTask, quadrants } from "@/lib/quadrants";
import { taskValidationMessage } from "@/lib/tasks/crud/validation-error";
import { TIME_UNITS, TOAST_DURATION } from "@/lib/constants";
import type { QuadrantId, TaskRecord } from "@/lib/types";

import type { CapturePayload } from "./capture-bar";

export function reportTaskMutationError(
  error: unknown,
  action: string,
  userMessage: string,
  taskId?: string
): void {
  logError(error, {
    action,
    taskId,
    userMessage,
    timestamp: new Date().toISOString(),
  });
  // A limit the person can act on beats a generic failure.
  toast.error(taskValidationMessage(error) ?? userMessage, { duration: TOAST_DURATION.LONG });
}

// Pure capture/toggle handlers — they close over no component state, so they
// live at module scope (stable identity for memoized children).
export async function handleCapture({ title, urgent, important, tags }: CapturePayload): Promise<TaskRecord | null> {
  try {
    const { cleanTitle, urls } = extractUrlsFromTitle(title);
    const task = await createTask({
      title: cleanTitle,
      description: buildDescription("", urls),
      urgent,
      important,
      tags: tags.length > 0 ? tags : undefined,
    });
    // Name the quadrant: a plain task lands in Eliminate, often below the fold.
    toast.success(`Added to ${quadrantForTask(urgent, important).title}`, { duration: TOAST_DURATION.SHORT });
    return task;
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.CREATE_TASK, "Failed to create task");
    return null;
  }
}

/**
 * Capture, then show the new card where it landed. The caller decides how to
 * reveal it; the matrix scrolls to it without pulling focus out of the bar.
 */
export async function captureAndReveal(
  payload: CapturePayload,
  reveal: (taskId: string) => void
): Promise<boolean> {
  const task = await handleCapture(payload);
  if (task) reveal(task.id);
  return task !== null;
}

/**
 * Toggle completion, offering an Undo on the completing direction only.
 *
 * Completion is the most frequent action in the app and its checkbox sits
 * inches from delete, which has had an Undo since forever. Un-completing needs
 * none — it is already the reversal.
 *
 * A recurring completion spawns the next instance, so undo removes that too;
 * reversing only the completion would leave an orphan on the board.
 */
export async function handleToggle(
  task: TaskRecord,
  completedNext: boolean,
  offerUndo: (message: string, undo: () => Promise<void>) => void
): Promise<boolean> {
  try {
    const { recurringInstance } = await toggleCompleted(task.id, completedNext);
    if (!completedNext) return true;

    celebrateCompletion();
    offerUndo("Task completed", async () => {
      await toggleCompleted(task.id, false);
      if (recurringInstance) await deleteTask(recurringInstance.id);
    });
    return true;
  } catch (error) {
    reportTaskMutationError(
      error,
      ErrorActions.TOGGLE_TASK,
      "Failed to update task",
      task.id
    );
    return false;
  }
}


/** "1 hour", "30 minutes": the toast's reading of a snooze preset. */
function snoozeDurationLabel(minutes: number): string {
  if (minutes === TIME_UNITS.MINUTES_PER_DAY) return "1 day";
  if (minutes === 7 * TIME_UNITS.MINUTES_PER_DAY) return "1 week";
  if (minutes % TIME_UNITS.MINUTES_PER_HOUR !== 0) return `${minutes} minutes`;
  const hours = minutes / TIME_UNITS.MINUTES_PER_HOUR;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/**
 * Quiet a task's reminders for a while. Reached from the trailing swipe and the
 * mobile overflow menu; both hand over the same one-hour preset.
 */
export async function handleSnooze(taskId: string, minutes: number): Promise<void> {
  try {
    await snoozeTask(taskId, minutes);
    toast.success(`Snoozed for ${snoozeDurationLabel(minutes)}`, { duration: TOAST_DURATION.SHORT });
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.SNOOZE_TASK, "Failed to snooze task", taskId);
  }
}

export function taskContext(stored: TaskRecord[] | undefined, active: TaskRecord[]): TaskRecord[] {
  return stored ?? active;
}

export async function handleSaveForLater(
  task: TaskRecord,
  offerUndo: (message: string, undo: () => Promise<void>) => void
): Promise<boolean> {
  try {
    await saveTaskForLater(task.id);
    offerUndo("Moved to Saved", () => returnSavedTask(task.id, task.quadrant, task.dueDate).then(() => {}));
    return true;
  } catch (error) {
    reportTaskMutationError(error, "save_task", error instanceof Error ? error.message : "Failed to move to Saved", task.id);
    return false;
  }
}

export async function handleDuplicate(task: TaskRecord): Promise<void> {
  try {
    await duplicateTask(task.id);
    toast.success("Task duplicated", { duration: TOAST_DURATION.SHORT });
  } catch (error) {
    reportTaskMutationError(error, "duplicate_task", "Failed to duplicate task", task.id);
  }
}

/** The menu route to a quadrant drag: same move, with an Undo back to where it was. */
export async function handleMoveTo(
  task: TaskRecord,
  target: QuadrantId,
  offerUndo: (message: string, undo: () => Promise<void>) => void
): Promise<void> {
  try {
    await moveTaskToQuadrant(task.id, target);
    offerUndo(`Moved to ${quadrants.find((q) => q.id === target)?.title}`, () => moveTaskToQuadrant(task.id, task.quadrant).then(() => {}));
  } catch (error) {
    reportTaskMutationError(error, "move_task", "Failed to move task", task.id);
  }
}

export async function handleClearSnooze(taskId: string): Promise<void> {
  try {
    await clearSnooze(taskId);
    toast.success("Snooze cleared", { duration: TOAST_DURATION.SHORT });
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.SNOOZE_TASK, "Failed to clear snooze", taskId);
  }
}
