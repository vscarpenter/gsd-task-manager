"use client";

import { toast } from "sonner";

import { createTask, toggleCompleted, deleteTask, snoozeTask } from "@/lib/tasks";
import { celebrateCompletion } from "@/lib/confetti";
import { extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
import { ErrorActions, logError } from "@/lib/error-logger";
import { TIME_UNITS, TOAST_DURATION } from "@/lib/constants";
import type { TaskRecord } from "@/lib/types";

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
  toast.error(userMessage, { duration: TOAST_DURATION.LONG });
}

// Pure capture/toggle handlers — they close over no component state, so they
// live at module scope (stable identity for memoized children).
export async function handleCapture({ title, urgent, important, tags }: CapturePayload): Promise<void> {
  try {
    const { cleanTitle, urls } = extractUrlsFromTitle(title);
    await createTask({
      title: cleanTitle,
      description: buildDescription("", urls),
      urgent,
      important,
      tags: tags.length > 0 ? tags : undefined,
    });
    toast.success("Task added", { duration: TOAST_DURATION.SHORT });
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.CREATE_TASK, "Failed to create task");
  }
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
): Promise<void> {
  try {
    const { recurringInstance } = await toggleCompleted(task.id, completedNext);
    if (!completedNext) return;

    celebrateCompletion();
    offerUndo("Task completed", async () => {
      await toggleCompleted(task.id, false);
      if (recurringInstance) await deleteTask(recurringInstance.id);
    });
  } catch (error) {
    reportTaskMutationError(
      error,
      ErrorActions.TOGGLE_TASK,
      "Failed to update task",
      task.id
    );
  }
}


/** "1 hour", "30 minutes": the toast's reading of a snooze preset. */
function snoozeDurationLabel(minutes: number): string {
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
