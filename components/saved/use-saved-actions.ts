"use client";

import type { RefObject } from "react";
import { toast } from "sonner";
import { deleteTask, restoreTask, updateTask } from "@/lib/tasks";
import { returnSavedTask, saveTaskForLater } from "@/lib/tasks/saved";
import type { QuadrantId, TaskRecord } from "@/lib/types";

export function useSavedActions(searchRef: RefObject<HTMLInputElement | null>) {
  return {
    saveNotes,
    returnItem: async (task: TaskRecord, quadrant: QuadrantId, dueDate?: string) => {
      const succeeded = await returnItem(task, quadrant, dueDate);
      if (succeeded) searchRef.current?.focus();
      return succeeded;
    },
    removeItem: async (task: TaskRecord) => {
      if (await removeItem(task)) searchRef.current?.focus();
    },
  };
}

async function saveNotes(task: TaskRecord, notes: string): Promise<boolean> {
  try {
    await updateTask(task.id, { description: notes });
    toast.success("Notes saved");
    return true;
  } catch {
    toast.error("Couldn't save your notes. Your text is still here.");
    return false;
  }
}

async function returnItem(task: TaskRecord, quadrant: QuadrantId, dueDate?: string): Promise<boolean> {
  try {
    await returnSavedTask(task.id, quadrant, dueDate);
    toast.success("Returned to matrix", { action: { label: "Undo", onClick: () => { void saveTaskForLater(task.id).catch(() => toast.error("Couldn't undo returning this item")); } } });
    return true;
  } catch {
    toast.error("Couldn't return this item to the matrix");
    return false;
  }
}

async function removeItem(task: TaskRecord): Promise<boolean> {
  try {
    await deleteTask(task.id);
    toast.success("Item moved to Trash", { action: { label: "Undo", onClick: () => { void restoreTask(task).catch(() => toast.error("Couldn't restore this item")); } } });
    return true;
  } catch {
    toast.error("Couldn't delete this saved item");
    return false;
  }
}
