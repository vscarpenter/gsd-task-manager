import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { removeDependencyReferencesInTransaction } from "@/lib/tasks/dependencies";
import { formatErrorMessage } from "@/lib/utils";
import { toTrashedRecord } from "@/lib/trash";
import { runTaskSyncTransaction } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Move a task to trash and enqueue the sync delete.
 *
 * Soft by design (ADR 0015). The task leaves the board and the remote copy is
 * removed exactly as before, but the record itself lands in `deletedTasks` for
 * 30 days. The Undo toast is now a convenience over a durable store rather than
 * the only thing between the user and permanent loss.
 *
 * The move spans both tables in one transaction: ADR 0013's first rule is that
 * an id lives in exactly one lifecycle table, and trash is the third seat.
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    const db = getDb();
    const task = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const existing = await db.tasks.get(id);
      if (!existing) return null;
      await removeDependencyReferencesInTransaction(id, enqueue, syncEnabled);
      await db.tasks.delete(id);
      // `put`, never `add`: re-deleting a restored task must not raise a
      // ConstraintError and abort the surrounding transaction.
      await db.deletedTasks.put(toTrashedRecord(existing));
      if (syncEnabled) await enqueue("delete", id, null);
      return existing;
    });

    if (!task) {
      // Idempotent delete: if task doesn't exist, operation succeeds without error
      logger.info("Task already deleted or does not exist", { taskId: id });
      return;
    }

    logger.info("Task moved to trash", { taskId: id, title: task.title });
  } catch (error) {
    logger.error("Failed to delete task", error instanceof Error ? error : undefined, {
      taskId: id,
    });
    throw new Error(`Failed to delete task: ${formatErrorMessage(error)}`);
  }
}
