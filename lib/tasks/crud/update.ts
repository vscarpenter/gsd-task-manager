import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import { enqueueSyncOperation, getSyncContext } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Update an existing task with partial updates
 */
export async function updateTask(
  id: string,
  updates: Partial<TaskDraft>
): Promise<TaskRecord> {
  try {
    const db = getDb();
    const existing = await db.tasks.get(id);

    if (!existing) {
      logger.warn("Task not found for update", { taskId: id });
      throw new Error(`Task ${id} not found`);
    }

    const nextDraft = mergeTaskUpdates(existing, updates);
    const validated = taskDraftSchema.parse(nextDraft);

    const { syncConfig } = await getSyncContext();
    const nextRecord = buildUpdatedRecord(existing, validated, updates);

    await db.tasks.put(nextRecord);

    logger.info("Task updated", { taskId: id, title: nextRecord.title });

    await enqueueSyncOperation(
      "update",
      id,
      nextRecord,
      syncConfig?.enabled ?? false
    );

    return nextRecord;
  } catch (error) {
    logger.error("Failed to update task", error instanceof Error ? error : undefined, {
      taskId: id,
      updates,
    });
    if (error instanceof Error && error.name === "ZodError") {
      throw new Error(`Task validation failed: ${error.message}`);
    }
    throw new Error(`Failed to update task: ${formatErrorMessage(error)}`);
  }
}

/**
 * Merge existing task data with partial updates
 */
function mergeTaskUpdates(
  existing: TaskRecord,
  updates: Partial<TaskDraft>
): TaskDraft {
  return {
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    urgent: updates.urgent ?? existing.urgent,
    important: updates.important ?? existing.important,
    dueDate: updates.dueDate ?? existing.dueDate,
    recurrence: updates.recurrence ?? existing.recurrence,
    tags: updates.tags ?? existing.tags,
    subtasks: updates.subtasks ?? existing.subtasks,
    dependencies: updates.dependencies ?? existing.dependencies,
    notifyBefore: updates.notifyBefore ?? existing.notifyBefore,
    notificationEnabled: updates.notificationEnabled ?? existing.notificationEnabled,
    estimatedMinutes: updates.estimatedMinutes ?? existing.estimatedMinutes,
  };
}

/**
 * Build the updated task record with notification state handling
 */
function buildUpdatedRecord(
  existing: TaskRecord,
  validated: TaskDraft,
  updates: Partial<TaskDraft>
): TaskRecord {
  const dueDateChanged =
    updates.dueDate !== undefined && updates.dueDate !== existing.dueDate;
  const notifyBeforeChanged =
    updates.notifyBefore !== undefined && updates.notifyBefore !== existing.notifyBefore;

  const notificationReset =
    dueDateChanged || notifyBeforeChanged
      ? {
          notificationSent: false,
          lastNotificationAt: undefined,
          snoozedUntil: undefined,
        }
      : {};

  return {
    ...existing,
    ...validated,
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    updatedAt: isoNow(),
    ...notificationReset,
  };
}
