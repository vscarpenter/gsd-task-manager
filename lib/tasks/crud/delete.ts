import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { removeDependencyReferences } from "@/lib/tasks/dependencies";
import { enqueueSyncOperation, getSyncContext, updateVectorClock } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Delete a task and enqueue sync operation
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    const db = getDb();

    // Read task BEFORE deleting to preserve vector clock
    // This is critical for conflict detection on the server
    const task = await db.tasks.get(id);

    if (!task) {
      // Idempotent delete: if task doesn't exist, operation succeeds without error
      logger.info("Task already deleted or does not exist", { taskId: id });
      return;
    }

    const vectorClock = task.vectorClock || {};
    const taskTitle = task.title;

    await removeDependencyReferences(id);
    await db.tasks.delete(id);

    logger.info("Task deleted", { taskId: id, title: taskTitle });

    // Enqueue sync operation if sync is enabled
    const { syncConfig, deviceId } = await getSyncContext();

    if (syncConfig?.enabled) {
      const deleteClock = updateVectorClock(vectorClock, deviceId);
      await enqueueSyncOperation("delete", id, null, deleteClock, true);
      logger.debug("Task deletion queued for sync", { taskId: id });
    }
  } catch (error) {
    logger.error("Failed to delete task", error instanceof Error ? error : undefined, {
      taskId: id,
    });
    throw new Error(
      `Failed to delete task: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
