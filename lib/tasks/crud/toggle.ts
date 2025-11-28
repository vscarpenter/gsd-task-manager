import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import {
  createNewVectorClock,
  enqueueSyncOperation,
  getSyncContext,
  updateVectorClock,
} from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Toggle task completion status, handling recurring task creation
 */
export async function toggleCompleted(
  id: string,
  completed: boolean
): Promise<TaskRecord> {
  try {
    const db = getDb();
    const existing = await db.tasks.get(id);

    if (!existing) {
      logger.warn("Task not found for completion toggle", { taskId: id });
      throw new Error(`Task ${id} not found`);
    }

    const { syncConfig, deviceId } = await getSyncContext();

    // Handle recurring task instance creation
    if (completed && existing.recurrence !== "none") {
      await createAndQueueRecurringInstance(existing, deviceId, syncConfig?.enabled ?? false);
    }

    // Update the original task
    const newClock = updateVectorClock(existing.vectorClock || {}, deviceId);
    const nextRecord = buildCompletedRecord(existing, completed, newClock);

    await db.tasks.put(nextRecord);

    logger.info("Task completion toggled", {
      taskId: id,
      completed,
      title: existing.title,
    });

    await enqueueSyncOperation(
      "update",
      id,
      nextRecord,
      nextRecord.vectorClock || {},
      syncConfig?.enabled ?? false
    );

    if (syncConfig?.enabled) {
      logger.debug("Task completion queued for sync", { taskId: id });
    }

    return nextRecord;
  } catch (error) {
    logger.error(
      "Failed to toggle task completion",
      error instanceof Error ? error : undefined,
      { taskId: id, completed }
    );
    throw new Error(
      `Failed to toggle task completion: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Build the updated task record with completion status
 */
function buildCompletedRecord(
  existing: TaskRecord,
  completed: boolean,
  newClock: Record<string, number>
): TaskRecord {
  const now = isoNow();
  return {
    ...existing,
    completed,
    completedAt: completed ? now : undefined,
    updatedAt: now,
    vectorClock: newClock,
  };
}

/**
 * Create and queue a new recurring task instance
 */
async function createAndQueueRecurringInstance(
  existing: TaskRecord,
  deviceId: string,
  syncEnabled: boolean
): Promise<void> {
  const newInstance = buildRecurringInstance(existing, deviceId);
  const db = getDb();
  await db.tasks.add(newInstance);

  logger.info("Created recurring task instance", {
    originalTaskId: existing.id,
    newTaskId: newInstance.id,
    recurrence: existing.recurrence,
  });

  await enqueueSyncOperation(
    "create",
    newInstance.id,
    newInstance,
    newInstance.vectorClock || {},
    syncEnabled
  );

  if (syncEnabled) {
    logger.debug("Recurring task instance queued for sync", {
      taskId: newInstance.id,
    });
  }
}

/**
 * Build a new recurring task instance based on completed task
 */
function buildRecurringInstance(existing: TaskRecord, deviceId: string): TaskRecord {
  const now = isoNow();
  const nextDueDate = calculateNextDueDate(existing.dueDate, existing.recurrence);
  const vectorClock = createNewVectorClock(deviceId);

  return {
    ...existing,
    id: generateId(),
    completed: false,
    dueDate: nextDueDate,
    createdAt: now,
    updatedAt: now,
    parentTaskId: existing.parentTaskId ?? existing.id,
    vectorClock,
    subtasks: existing.subtasks.map((subtask) => ({ ...subtask, completed: false })),
    notificationSent: false,
    lastNotificationAt: undefined,
    snoozedUntil: undefined,
  };
}

/**
 * Calculate the next due date for a recurring task
 */
function calculateNextDueDate(
  currentDueDate: string | undefined,
  recurrence: string
): string | undefined {
  if (!currentDueDate || recurrence === "none") {
    return currentDueDate;
  }

  const current = new Date(currentDueDate);
  const next = new Date(current);

  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return next.toISOString();
}
