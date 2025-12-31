import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { TaskRecord, TimeEntry } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { enqueueSyncOperation, getSyncContext, updateVectorClock } from "./helpers";
import { TIME_TRACKING } from "@/lib/constants";

const logger = createLogger("TIME_TRACKING");

/**
 * Calculate total time spent from time entries
 */
function calculateTimeSpent(entries: TimeEntry[]): number {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total; // Don't count running entries
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
  const existing = await db.tasks.get(taskId);

  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Check if there's already a running timer
  const runningEntry = existing.timeEntries?.find((e) => !e.endedAt);
  if (runningEntry) {
    logger.warn("Task already has running timer", { taskId });
    throw new Error("Task already has a running timer");
  }

  const { syncConfig, deviceId } = await getSyncContext();
  const newClock = updateVectorClock(existing.vectorClock || {}, deviceId);

  const newEntry: TimeEntry = {
    id: nanoid(8),
    startedAt: isoNow(),
  };

  const updatedEntries = [...(existing.timeEntries || []), newEntry];

  const nextRecord: TaskRecord = {
    ...existing,
    timeEntries: updatedEntries,
    updatedAt: isoNow(),
    vectorClock: newClock,
  };

  await db.tasks.put(nextRecord);

  logger.info("Time tracking started", { taskId, entryId: newEntry.id });

  await enqueueSyncOperation(
    "update",
    taskId,
    nextRecord,
    nextRecord.vectorClock || {},
    syncConfig?.enabled ?? false
  );

  return nextRecord;
}

/**
 * Stop the running time tracking session for a task
 */
export async function stopTimeTracking(
  taskId: string,
  notes?: string
): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);

  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const runningEntryIndex = existing.timeEntries?.findIndex((e) => !e.endedAt);
  if (runningEntryIndex === undefined || runningEntryIndex === -1) {
    logger.warn("No running timer to stop", { taskId });
    throw new Error("No running timer found for this task");
  }

  const { syncConfig, deviceId } = await getSyncContext();
  const newClock = updateVectorClock(existing.vectorClock || {}, deviceId);

  const updatedEntries = [...(existing.timeEntries || [])];
  updatedEntries[runningEntryIndex] = {
    ...updatedEntries[runningEntryIndex],
    endedAt: isoNow(),
    notes: notes || updatedEntries[runningEntryIndex].notes,
  };

  const timeSpent = calculateTimeSpent(updatedEntries);

  const nextRecord: TaskRecord = {
    ...existing,
    timeEntries: updatedEntries,
    timeSpent,
    updatedAt: isoNow(),
    vectorClock: newClock,
  };

  await db.tasks.put(nextRecord);

  logger.info("Time tracking stopped", {
    taskId,
    entryId: updatedEntries[runningEntryIndex].id,
    duration: timeSpent - (existing.timeSpent || 0),
  });

  await enqueueSyncOperation(
    "update",
    taskId,
    nextRecord,
    nextRecord.vectorClock || {},
    syncConfig?.enabled ?? false
  );

  return nextRecord;
}

/**
 * Delete a time entry from a task
 */
export async function deleteTimeEntry(
  taskId: string,
  entryId: string
): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);

  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const updatedEntries = (existing.timeEntries || []).filter(
    (e) => e.id !== entryId
  );

  if (updatedEntries.length === existing.timeEntries?.length) {
    throw new Error(`Time entry ${entryId} not found`);
  }

  const { syncConfig, deviceId } = await getSyncContext();
  const newClock = updateVectorClock(existing.vectorClock || {}, deviceId);

  const timeSpent = calculateTimeSpent(updatedEntries);

  const nextRecord: TaskRecord = {
    ...existing,
    timeEntries: updatedEntries,
    timeSpent,
    updatedAt: isoNow(),
    vectorClock: newClock,
  };

  await db.tasks.put(nextRecord);

  logger.info("Time entry deleted", { taskId, entryId });

  await enqueueSyncOperation(
    "update",
    taskId,
    nextRecord,
    nextRecord.vectorClock || {},
    syncConfig?.enabled ?? false
  );

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
 * Get elapsed time in minutes for the current running entry
 */
export function getRunningElapsedMinutes(task: TaskRecord): number {
  const runningEntry = getRunningEntry(task);
  if (!runningEntry) return 0;

  const start = new Date(runningEntry.startedAt).getTime();
  const now = Date.now();
  return Math.floor((now - start) / TIME_TRACKING.MS_PER_MINUTE);
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

/**
 * Format time estimation for display
 */
export function formatEstimate(minutes: number | undefined): string {
  if (!minutes) return "No estimate";
  return formatTimeSpent(minutes);
}
