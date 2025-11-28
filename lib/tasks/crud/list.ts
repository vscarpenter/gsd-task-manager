import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";

const logger = createLogger("TASK_CRUD");

/**
 * List all tasks ordered by creation date (newest first)
 */
export async function listTasks(): Promise<TaskRecord[]> {
  try {
    const db = getDb();
    const tasks = await db.tasks.orderBy("createdAt").reverse().toArray();
    logger.debug("Listed tasks", { count: tasks.length });
    return tasks;
  } catch (error) {
    logger.error("Failed to list tasks", error instanceof Error ? error : undefined);
    throw new Error(
      `Failed to list tasks: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Clear all tasks from the database
 */
export async function clearTasks(): Promise<void> {
  try {
    const db = getDb();
    const count = await db.tasks.count();
    await db.tasks.clear();
    logger.info("All tasks cleared", { count });
  } catch (error) {
    logger.error("Failed to clear tasks", error instanceof Error ? error : undefined);
    throw new Error(
      `Failed to clear tasks: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
