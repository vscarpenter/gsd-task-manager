import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { removeDependencyReferencesInTransaction } from "@/lib/tasks/dependencies";
import { formatErrorMessage } from "@/lib/utils";
import { runTaskSyncTransaction } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Delete a task and enqueue sync operation
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    const db = getDb();
    const task = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const existing = await db.tasks.get(id);
      if (!existing) return null;
      await removeDependencyReferencesInTransaction(id, enqueue, syncEnabled);
      await db.tasks.delete(id);
      if (syncEnabled) await enqueue("delete", id, null);
      return existing;
    });

    if (!task) {
      // Idempotent delete: if task doesn't exist, operation succeeds without error
      logger.info("Task already deleted or does not exist", { taskId: id });
      return;
    }

    logger.info("Task deleted", { taskId: id, title: task.title });
  } catch (error) {
    logger.error("Failed to delete task", error instanceof Error ? error : undefined, {
      taskId: id,
    });
    throw new Error(`Failed to delete task: ${formatErrorMessage(error)}`);
  }
}
