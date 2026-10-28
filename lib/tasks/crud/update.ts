import { buildDescription, extractUrlsFromTitle } from "@/lib/capture-parser";
import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import { runTaskSyncTransaction } from "./helpers";
import { TaskValidationError } from "./validation-error";

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
    const nextRecord = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const existing = await db.tasks.get(id);
      if (!existing) {
        logger.warn("Task not found for update", { taskId: id });
        throw new Error(`Task ${id} not found`);
      }
      const validated = validateUpdatedDraft(existing, updates);
      const record = buildUpdatedRecord(existing, validated, updates);
      await db.tasks.put(record);
      if (syncEnabled) await enqueue("update", id, record);
      return record;
    });

    logger.info("Task updated", { taskId: id });
    return nextRecord;
  } catch (error) {
    logger.error("Failed to update task", error instanceof Error ? error : undefined, {
      taskId: id,
      updates,
    });
    throw new Error(`Failed to update task: ${formatErrorMessage(error)}`);
  }
}

function validateUpdatedDraft(
  existing: TaskRecord,
  updates: Partial<TaskDraft>
): TaskDraft {
  const nextDraft = mergeTaskUpdates(existing, updates);
  const { cleanTitle, urls } = extractUrlsFromTitle(nextDraft.title);
  nextDraft.title = cleanTitle;
  nextDraft.description = buildDescription(nextDraft.description, urls);
  const result = taskDraftSchema.safeParse(nextDraft);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw TaskValidationError.fromZod(result.error, `invalid fields — ${fields}`);
  }
  return result.data;
}

/**
 * Merge existing task data with partial updates.
 *
 * A field left out of `updates` keeps its stored value. The optional fields the
 * editor can empty (due date, reminder offset, estimate) also clear when the key
 * is present with `undefined`, which is how the editor sends None or an empty
 * field. With `??` alone, a cleared field silently kept its old value.
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
    dueDate: "dueDate" in updates ? updates.dueDate : existing.dueDate,
    recurrence: updates.recurrence ?? existing.recurrence,
    tags: updates.tags ?? existing.tags,
    subtasks: updates.subtasks ?? existing.subtasks,
    dependencies: updates.dependencies ?? existing.dependencies,
    notifyBefore: "notifyBefore" in updates ? updates.notifyBefore : existing.notifyBefore,
    notificationEnabled: updates.notificationEnabled ?? existing.notificationEnabled,
    estimatedMinutes:
      "estimatedMinutes" in updates ? updates.estimatedMinutes : existing.estimatedMinutes,
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
  // Clearing a field counts as a change too, so a cleared due date drops the old
  // snooze and sent flag along with it.
  const dueDateChanged =
    "dueDate" in updates && updates.dueDate !== existing.dueDate;
  const notifyBeforeChanged =
    "notifyBefore" in updates && updates.notifyBefore !== existing.notifyBefore;

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
