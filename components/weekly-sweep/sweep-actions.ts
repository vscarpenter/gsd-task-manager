import { deleteTask, restoreTask, updateTask } from "@/lib/tasks";
import { returnSavedTask, saveTaskForLater } from "@/lib/tasks/saved";
import { onDate } from "@/lib/due-time";
import { ErrorActions } from "@/lib/error-logger";
import {
  handleMarkUrgent,
  handleMoveTo,
  handleSaveForLater,
  handleToggle,
  reportTaskMutationError,
} from "@/components/matrix-simplified/task-actions";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import type { SweepCard } from "@/lib/weekly-sweep";

/**
 * The sweep adds no action of its own (spec: tasks/spec-weekly-sweep.md section 5).
 * Each one calls the path the matrix already uses, with the Undo that path already has.
 */

export type SweepReason = SweepCard["reason"];
export type SweepActionId = "complete" | "new-date" | "mark-urgent" | "save" | "delete" | "return" | "move" | "skip";

export type OfferUndo = (message: string, undo: () => Promise<void>) => void;

const ACTIONS: Record<SweepReason, SweepActionId[]> = {
  overdue: ["complete", "new-date", "mark-urgent", "save", "delete", "skip"],
  escalating: ["mark-urgent", "new-date", "complete", "skip"],
  stale: ["complete", "move", "new-date", "save", "delete", "skip"],
  saved: ["return", "delete", "skip"],
  "undated-schedule": ["new-date", "move", "save", "skip"],
};

/** The actions on a card, in the spec's order. Mark urgent only shows for a task that isn't urgent. */
export function actionsFor(reason: SweepReason, task: TaskRecord): SweepActionId[] {
  return ACTIONS[reason].filter((id) => id !== "mark-urgent" || !task.urgent);
}

/** A finished action advances the sweep only when it worked. */
export async function completeTask(task: TaskRecord, offerUndo: OfferUndo): Promise<boolean> {
  return handleToggle(task, true, offerUndo);
}

export async function markUrgent(task: TaskRecord, offerUndo: OfferUndo): Promise<boolean> {
  await handleMarkUrgent(task, offerUndo);
  return true;
}

export async function saveForLater(task: TaskRecord, offerUndo: OfferUndo): Promise<boolean> {
  return handleSaveForLater(task, offerUndo);
}

export async function moveToQuadrant(task: TaskRecord, target: QuadrantId, offerUndo: OfferUndo): Promise<boolean> {
  await handleMoveTo(task, target, offerUndo);
  return true;
}

/** New date and Add date: an ordinary edit that keeps any time of day already set. */
export async function setDueDay(task: TaskRecord, day: string, offerUndo: OfferUndo): Promise<boolean> {
  try {
    await updateTask(task.id, { dueDate: onDate(task.dueDate, day) });
    offerUndo("Due date changed", () => updateTask(task.id, { dueDate: task.dueDate }).then(() => {}));
    return true;
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.UPDATE_TASK, "Couldn't change the due date", task.id);
    return false;
  }
}

export async function removeTask(task: TaskRecord, offerUndo: OfferUndo): Promise<boolean> {
  try {
    await deleteTask(task.id);
    offerUndo("Task deleted. It's in Trash.", () => restoreTask(task));
    return true;
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.DELETE_TASK, "Couldn't delete the task", task.id);
    return false;
  }
}

export async function returnToMatrix(task: TaskRecord, quadrant: QuadrantId, offerUndo: OfferUndo): Promise<boolean> {
  try {
    await returnSavedTask(task.id, quadrant, task.dueDate);
    offerUndo("Returned to matrix", () => saveTaskForLater(task.id).then(() => {}));
    return true;
  } catch (error) {
    reportTaskMutationError(error, "return_saved", "Couldn't return this item to the matrix", task.id);
    return false;
  }
}
