"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { getArchivedStorageStats } from "@/lib/archive";
import { getTrashCount } from "@/lib/trash";
import type { TaskRecord } from "@/lib/types";

const BYTES_PER_KB = 1024;

export interface StorageSummary {
  activeTasks: number;
  completedTasks: number;
  archivedTasks: number;
  trashedTasks: number;
  /** Live + archived. Trash is counted separately for the reset confirmation. */
  totalTasks: number;
  /** Footprint of both stores, in KB, to one decimal place. */
  estimatedKb: string;
}

/**
 * Derive the Settings storage summary from live tasks plus the archive.
 *
 * Archived tasks are still this device's data and still die on "Reset
 * everything" — which sits two rows below this figure — so both the count and
 * the size have to describe the same set of records.
 */
export function useStorageSummary(tasks: TaskRecord[]): StorageSummary {
  const archived = useLiveQuery(() => getArchivedStorageStats());
  const trashed = useLiveQuery(() => getTrashCount());

  let activeTasks = 0;
  let completedTasks = 0;
  for (const task of tasks) {
    if (task.completed) completedTasks += 1;
    else activeTasks += 1;
  }

  const archivedTasks = archived?.count ?? 0;
  const archivedBytes = archived?.bytes ?? 0;
  const totalBytes = JSON.stringify(tasks).length + archivedBytes;

  return {
    activeTasks,
    completedTasks,
    archivedTasks,
    trashedTasks: trashed ?? 0,
    totalTasks: tasks.length + archivedTasks,
    estimatedKb: (totalBytes / BYTES_PER_KB).toFixed(1),
  };
}
