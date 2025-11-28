import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import {
  createNewVectorClock,
  enqueueSyncOperation,
  getSyncContext,
} from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Duplicate a task - copies all properties except ID
 */
export async function duplicateTask(id: string): Promise<TaskRecord> {
  try {
    const db = getDb();
    const original = await db.tasks.get(id);

    if (!original) {
      throw new Error(`Task with id ${id} not found`);
    }

    const { syncConfig, deviceId } = await getSyncContext();
    const duplicate = buildDuplicateRecord(original, deviceId);

    await db.tasks.add(duplicate);

    await enqueueSyncOperation(
      "create",
      duplicate.id,
      duplicate,
      duplicate.vectorClock || {},
      syncConfig?.enabled ?? true // Default to true for backward compatibility
    );

    logger.info("Task duplicated", { originalId: id, newId: duplicate.id });
    return duplicate;
  } catch (error) {
    logger.error("Failed to duplicate task", error instanceof Error ? error : undefined, {
      taskId: id,
    });
    throw new Error(
      `Failed to duplicate task: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Build a duplicate task record with fresh metadata
 */
function buildDuplicateRecord(original: TaskRecord, deviceId: string): TaskRecord {
  const now = isoNow();
  const vectorClock = createNewVectorClock(deviceId);

  return {
    ...original,
    id: generateId(),
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    completed: false,
    completedAt: undefined,
    notificationSent: false,
    lastNotificationAt: undefined,
    snoozedUntil: undefined,
    archivedAt: undefined,
    vectorClock,
  };
}
