import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import {
  runTaskSyncTransaction,
  type TransactionalSyncEnqueue,
} from "./helpers";

const logger = createLogger("TASK_CRUD");
const completionLocks = new Map<string, Promise<void>>();

async function withCompletionLock<T>(
  taskId: string,
  mutation: () => Promise<T>
): Promise<T> {
  const previous = completionLocks.get(taskId) ?? Promise.resolve();
  let release = (): void => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  completionLocks.set(taskId, current);
  await previous;
  try {
    return await mutation();
  } finally {
    release();
    if (completionLocks.get(taskId) === current) completionLocks.delete(taskId);
  }
}

/**
 * Toggle task completion status, handling recurring task creation
 */
export async function toggleCompleted(
  id: string,
  completed: boolean
): Promise<TaskRecord> {
  return withCompletionLock(id, () => toggleCompletedTransaction(id, completed));
}

async function toggleCompletedTransaction(
  id: string,
  completed: boolean
): Promise<TaskRecord> {
  try {
    const db = getDb();
    const result = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const existing = await db.tasks.get(id);
      if (!existing) {
        logger.warn("Task not found for completion toggle", { taskId: id });
        throw new Error(`Task ${id} not found`);
      }
      let recurringInstance: TaskRecord | null = null;
      if (completed && !existing.completed && existing.recurrence !== "none") {
        recurringInstance = await createAndQueueRecurringInstance(
          existing,
          enqueue,
          syncEnabled
        );
      }
      const record = buildCompletedRecord(existing, completed);
      await db.tasks.put(record);
      if (syncEnabled) await enqueue("update", id, record);
      return { record, recurringInstance };
    });
    const { record: nextRecord, recurringInstance } = result;

    if (recurringInstance) {
      logger.info("Created recurring task instance", {
        originalTaskId: id,
        newTaskId: recurringInstance.id,
        recurrence: nextRecord.recurrence,
      });
    }

    logger.info("Task completion toggled", {
      taskId: id,
      completed,
      title: nextRecord.title,
    });
    return nextRecord;
  } catch (error) {
    logger.error(
      "Failed to toggle task completion",
      error instanceof Error ? error : undefined,
      { taskId: id, completed }
    );
    throw new Error(`Failed to toggle task completion: ${formatErrorMessage(error)}`);
  }
}

/**
 * Build the updated task record with completion status
 */
function buildCompletedRecord(
  existing: TaskRecord,
  completed: boolean
): TaskRecord {
  const now = isoNow();
  return {
    ...existing,
    completed,
    completedAt: completed ? now : undefined,
    updatedAt: now,
  };
}

/**
 * Create and queue a new recurring task instance
 */
async function createAndQueueRecurringInstance(
  existing: TaskRecord,
  enqueue: TransactionalSyncEnqueue,
  syncEnabled: boolean
): Promise<TaskRecord> {
  const newInstance = buildRecurringInstance(existing);
  const db = getDb();
  await db.tasks.add(newInstance);
  if (syncEnabled) await enqueue("create", newInstance.id, newInstance);
  return newInstance;
}

/**
 * Build a new recurring task instance based on completed task
 */
function buildRecurringInstance(existing: TaskRecord): TaskRecord {
  const now = isoNow();
  const nextDueDate = calculateNextDueDate(existing.dueDate, existing.recurrence);

  return {
    ...existing,
    id: generateId(),
    completed: false,
    dueDate: nextDueDate,
    createdAt: now,
    updatedAt: now,
    parentTaskId: existing.parentTaskId ?? existing.id,
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
