import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import { resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import { enqueueSyncOperation, getSyncContext } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Create a new task with validation and sync support
 */
export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  const result = taskDraftSchema.safeParse(input);
  if (!result.success) {
    const msg = result.error.issues.map(i => i.message).join(", ");
    logger.error("Task validation failed", undefined, { input, validationErrors: msg });
    throw new Error(`Task validation failed: ${msg}`);
  }

  try {
    const { syncConfig } = await getSyncContext();
    const record = buildTaskRecord(result.data);

    const db = getDb();
    await db.tasks.add(record);

    logger.info("Task created", { taskId: record.id, title: record.title });

    await enqueueSyncOperation(
      "create",
      record.id,
      record,
      syncConfig?.enabled ?? false
    );

    return record;
  } catch (error) {
    logger.error("Failed to create task", error instanceof Error ? error : undefined, {
      input,
    });
    throw new Error(`Failed to create task: ${formatErrorMessage(error)}`);
  }
}

/**
 * Build a complete TaskRecord from validated draft data
 */
function buildTaskRecord(validated: TaskDraft): TaskRecord {
  const now = isoNow();

  return {
    ...validated,
    id: generateId(),
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    completed: false,
    createdAt: now,
    updatedAt: now,
    recurrence: validated.recurrence ?? "none",
    tags: validated.tags ?? [],
    subtasks: validated.subtasks ?? [],
    dependencies: validated.dependencies ?? [],
    notificationEnabled: validated.notificationEnabled ?? true,
    notificationSent: false,
  };
}
