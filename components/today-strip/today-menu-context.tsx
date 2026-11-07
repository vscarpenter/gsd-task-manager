"use client";

import { toast } from "sonner";
import { createContext, useContext, type ReactNode } from "react";
import type { TaskRecord } from "@/lib/types";
import { removeFromToday } from "@/lib/tasks/top-three-actions";
import { addAndReport } from "./add-feedback";
import { reportTaskMutationError } from "@/components/matrix-simplified/task-actions";
import { useToday } from "./use-today";

/** What a card's menu needs to offer Add to today. Null outside the matrix, where the item is hidden. */
export interface TodayMenu {
  isPicked: (task: TaskRecord) => boolean;
  isFull: boolean;
  add: (task: TaskRecord) => void;
  remove: (task: TaskRecord) => void;
}

export const TodayMenuContext = createContext<TodayMenu | null>(null);

export function useTodayMenu(): TodayMenu | null {
  return useContext(TodayMenuContext);
}

const TOAST_MS = 2500;

async function attempt(run: () => Promise<unknown>, action: string, message: string, done: string): Promise<void> {
  try {
    // A refused add already said so, so it gets no success toast. Toasts are announced,
    // and the card menu is often far from the strip.
    if ((await run()) !== false) toast.success(done, { duration: TOAST_MS });
  } catch (error) {
    reportTaskMutationError(error, action, message);
  }
}

/** Gives every card under it the Today menu item, from the same rules the strip uses. */
export function TodayMenuProvider({ tasks, children }: { tasks: TaskRecord[]; children: ReactNode }) {
  const { picks, hasFreeSlot, now, zone } = useToday(tasks);
  const pickedIds = new Set(picks.map((t) => t.id));
  const menu: TodayMenu = {
    isPicked: (task) => pickedIds.has(task.id),
    isFull: !hasFreeSlot,
    add: (task) => void attempt(() => addAndReport(task.id, tasks, now, zone), "add_to_today", "Couldn't add to today. Try again.", "Added to today"),
    remove: (task) => void attempt(() => removeFromToday(task.id), "remove_from_today", "Couldn't remove that from today. Try again.", "Removed from today"),
  };
  return <TodayMenuContext.Provider value={menu}>{children}</TodayMenuContext.Provider>;
}
