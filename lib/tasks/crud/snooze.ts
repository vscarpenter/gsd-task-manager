import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { enqueueSyncOperation, getSyncContext, updateVectorClock } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Snooze a task's notifications for a specified duration
 * @param id - The task ID to snooze
 * @param minutes - Number of minutes to snooze (0 to clear snooze)
 */
export async function snoozeTask(
  id: string,
  minutes: number
): Promise<TaskRecord> {
  try {
    const db = getDb();
    const existing = await db.tasks.get(id);

    if (!existing) {
      logger.warn("Task not found for snooze", { taskId: id });
      throw new Error(`Task ${id} not found`);
    }

    const { syncConfig, deviceId } = await getSyncContext();
    const newClock = updateVectorClock(existing.vectorClock || {}, deviceId);

    // Calculate snooze end time (or clear if minutes is 0)
    const snoozedUntil = minutes > 0
      ? new Date(Date.now() + minutes * 60 * 1000).toISOString()
      : undefined;

    const nextRecord: TaskRecord = {
      ...existing,
      snoozedUntil,
      updatedAt: isoNow(),
      vectorClock: newClock,
    };

    await db.tasks.put(nextRecord);

    logger.info("Task snoozed", {
      taskId: id,
      title: nextRecord.title,
      snoozedUntil: snoozedUntil ?? "cleared"
    });

    await enqueueSyncOperation(
      "update",
      id,
      nextRecord,
      nextRecord.vectorClock || {},
      syncConfig?.enabled ?? false
    );

    return nextRecord;
  } catch (error) {
    logger.error("Failed to snooze task", error instanceof Error ? error : undefined, {
      taskId: id,
      minutes,
    });
    throw new Error(
      `Failed to snooze task: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Clear the snooze for a task
 * @param id - The task ID to clear snooze for
 */
export async function clearSnooze(id: string): Promise<TaskRecord> {
  return snoozeTask(id, 0);
}

/**
 * Check if a task is currently snoozed
 * @param task - The task to check
 */
export function isTaskSnoozed(task: TaskRecord): boolean {
  if (!task.snoozedUntil) return false;
  return new Date(task.snoozedUntil) > new Date();
}

/**
 * Get remaining snooze time in minutes
 * @param task - The task to check
 * @returns Remaining minutes, or 0 if not snoozed
 */
export function getRemainingSnoozeMinutes(task: TaskRecord): number {
  if (!task.snoozedUntil) return 0;
  const remaining = new Date(task.snoozedUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / (60 * 1000)));
}
