import type { TaskRecord } from "@/lib/types";

/**
 * Why a task can't be in Saved, or null when it can. saveTaskForLater and the
 * sync backfill both ask, so the two can't disagree. Kept free of Dexie and
 * sync imports so the sync layer can use it without an import cycle.
 */
export function savedPlacementBlocker(task: TaskRecord): string | null {
  if (task.completed) return "Completed tasks belong in Archive";
  if (task.timeEntries?.some((entry) => !entry.endedAt)) {
    return "Stop the timer before moving this task to Saved";
  }
  return null;
}
