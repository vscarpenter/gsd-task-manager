"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { getArchivedStorageStats } from "@/lib/archive";
import { getTrashStorageStats } from "@/lib/trash";
import type { TaskRecord } from "@/lib/types";

const BYTES_PER_KB = 1024;

export interface StorageSummary {
  activeTasks: number;
  savedTasks: number;
  completedTasks: number;
  archivedTasks: number;
  trashedTasks: number;
  /** Live, archived, and trashed: every record this device still holds. */
  totalTasks: number;
  /** Footprint of all three stores, in KB, to one decimal place. */
  estimatedKb: string;
}

/**
 * Derive the Settings storage summary from live tasks, the archive, and Trash.
 *
 * Archived and trashed tasks are still this device's data and still die on
 * "Reset everything", which sits two rows below this figure, so both the count
 * and the size have to describe the same set of records.
 */
function countByState(tasks: TaskRecord[]) {
  let activeTasks = 0;
  let savedTasks = 0;
  let completedTasks = 0;
  for (const task of tasks) {
    if (task.savedAt) savedTasks += 1;
    else if (task.completed) completedTasks += 1;
    else activeTasks += 1;
  }
  return { activeTasks, savedTasks, completedTasks };
}

export function useStorageSummary(tasks: TaskRecord[]): StorageSummary {
  const archived = useLiveQuery(() => getArchivedStorageStats());
  const trashed = useLiveQuery(() => getTrashStorageStats());
  const [archivedTasks, archivedBytes] = [archived?.count ?? 0, archived?.bytes ?? 0];
  const [trashedTasks, trashedBytes] = [trashed?.count ?? 0, trashed?.bytes ?? 0];
  const totalBytes = JSON.stringify(tasks).length + archivedBytes + trashedBytes;

  return {
    ...countByState(tasks),
    archivedTasks,
    trashedTasks,
    totalTasks: tasks.length + archivedTasks + trashedTasks,
    estimatedKb: (totalBytes / BYTES_PER_KB).toFixed(1),
  };
}
