import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { parseQuadrantFlags } from "@/lib/quadrants";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import { runTaskSyncTransaction } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Move a task to a different quadrant by updating its urgent/important flags.
 * This is the primary handler for drag-and-drop operations.
 */
export async function moveTaskToQuadrant(
  id: string,
  targetQuadrant: QuadrantId
): Promise<TaskRecord> {
  try {
    const db = getDb();
    const { urgent, important } = parseQuadrantFlags(targetQuadrant);
    const nextRecord = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const existing = await db.tasks.get(id);
      if (!existing) {
        logger.warn("Task not found for quadrant move", { taskId: id });
        throw new Error(`Task ${id} not found`);
      }
      const record: TaskRecord = {
        ...existing,
        urgent,
        important,
        quadrant: targetQuadrant,
        updatedAt: isoNow(),
      };
      await db.tasks.put(record);
      if (syncEnabled) await enqueue("update", id, record);
      return record;
    });

    logger.info("Task moved to quadrant", {
      taskId: id,
      title: nextRecord.title,
      toQuadrant: targetQuadrant,
    });
    return nextRecord;
  } catch (error) {
    logger.error(
      "Failed to move task to quadrant",
      error instanceof Error ? error : undefined,
      { taskId: id, targetQuadrant }
    );
    throw new Error(`Failed to move task to quadrant: ${formatErrorMessage(error)}`);
  }
}
