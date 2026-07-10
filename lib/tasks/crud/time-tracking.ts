import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { timeEntrySchema } from "@/lib/schema";
import type { TaskRecord, TimeEntry } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { runTaskSyncTransaction } from "./helpers";
import { TIME_TRACKING } from "@/lib/constants";

const logger = createLogger("TIME_TRACKING");

/**
 * Calculate total time spent from time entries
 */
function calculateTimeSpent(entries: TimeEntry[]): number {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    const start = new Date(entry.startedAt).getTime();
    const end = new Date(entry.endedAt).getTime();
    const minutes = Math.round((end - start) / TIME_TRACKING.MS_PER_MINUTE);
    return total + Math.max(0, minutes);
  }, 0);
}

/**
 * Start a new time tracking session for a task
 */
export async function startTimeTracking(taskId: string): Promise<TaskRecord> {
  const db = getDb();
  const newEntry: TimeEntry = {
    id: nanoid(8),
    startedAt: isoNow(),
  };
  const nextRecord = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);
    if (existing.timeEntries?.some((entry) => !entry.endedAt)) {
      logger.warn("Task already has running timer", { taskId });
      throw new Error("Task already has a running timer");
    }
    const record: TaskRecord = {
      ...existing,
      timeEntries: [...(existing.timeEntries || []), newEntry],
      updatedAt: isoNow(),
    };
    await db.tasks.put(record);
    if (syncEnabled) await enqueue("update", taskId, record);
    return record;
  });

  logger.info("Time tracking started", { taskId, entryId: newEntry.id });

  return nextRecord;
}

/** Close the running entry and recalculate total time */
function closeRunningEntry(
  entries: TimeEntry[],
  runningIndex: number,
  notes?: string
): { updatedEntries: TimeEntry[]; timeSpent: number } {
  const updatedEntries = [...entries];
  updatedEntries[runningIndex] = {
    ...updatedEntries[runningIndex],
    endedAt: isoNow(),
    notes: notes || updatedEntries[runningIndex].notes,
  };
  return { updatedEntries, timeSpent: calculateTimeSpent(updatedEntries) };
}

/**
 * Stop the running time tracking session for a task
 */
export async function stopTimeTracking(
  taskId: string,
  notes?: string
): Promise<TaskRecord> {
  const db = getDb();
  const notesValidation = timeEntrySchema.shape.notes.safeParse(notes);
  if (!notesValidation.success) {
    throw new Error(`Invalid time entry notes: ${notesValidation.error.issues.map((i) => i.message).join(", ")}`);
  }

  let entryId = "";
  let duration = 0;
  const nextRecord = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);
    const runningIndex = existing.timeEntries?.findIndex((entry) => !entry.endedAt);
    if (runningIndex === undefined || runningIndex === -1) {
      logger.warn("No running timer to stop", { taskId });
      throw new Error("No running timer found for this task");
    }
    const closed = closeRunningEntry(existing.timeEntries || [], runningIndex, notes);
    const record: TaskRecord = {
      ...existing,
      timeEntries: closed.updatedEntries,
      timeSpent: closed.timeSpent,
      updatedAt: isoNow(),
    };
    entryId = closed.updatedEntries[runningIndex].id;
    duration = closed.timeSpent - (existing.timeSpent || 0);
    await db.tasks.put(record);
    if (syncEnabled) await enqueue("update", taskId, record);
    return record;
  });

  logger.info("Time tracking stopped", {
    taskId,
    entryId,
    duration,
  });

  return nextRecord;
}


/**
 * Check if a task has a running timer
 */
export function hasRunningTimer(task: TaskRecord): boolean {
  return task.timeEntries?.some((e) => !e.endedAt) ?? false;
}

/**
 * Get the running time entry for a task
 */
export function getRunningEntry(task: TaskRecord): TimeEntry | undefined {
  return task.timeEntries?.find((e) => !e.endedAt);
}

/**
 * Format time in minutes to human-readable string
 */
export function formatTimeSpent(minutes: number): string {
  if (minutes < 1) return "< 1m";
  if (minutes < TIME_TRACKING.MINUTES_PER_HOUR) return `${minutes}m`;

  const hours = Math.floor(minutes / TIME_TRACKING.MINUTES_PER_HOUR);
  const remainingMinutes = minutes % TIME_TRACKING.MINUTES_PER_HOUR;

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}
