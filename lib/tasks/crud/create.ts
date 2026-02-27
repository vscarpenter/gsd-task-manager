import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import { resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import {
  enqueueSyncOperation,
  getSyncContext,
} from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Create a new task with validation and sync support
 */
export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  try {
    const validated = taskDraftSchema.parse(input);
    const { syncConfig } = await getSyncContext();

    const record = buildTaskRecord(validated);

    const db = getDb();
    await db.tasks.add(record);

    logger.info("Task created", { taskId: record.id, title: record.title });

    await enqueueSyncOperation(
      "create",
      record.id,
      record,
      syncConfig?.enabled ?? false
    );

    if (syncConfig?.enabled) {
      logger.debug("Task creation queued for sync", { taskId: record.id });
    }

    return record;
  } catch (error) {
    logger.error("Failed to create task", error instanceof Error ? error : undefined, {
      input,
    });
    if (error instanceof Error && error.name === "ZodError") {
      throw new Error(`Task validation failed: ${error.message}`);
    }
    throw new Error(
      `Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`
    );
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
