import { getDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { formatErrorMessage } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";
import { runTaskSyncTransaction } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Restore a previously deleted task by re-inserting the exact record.
 *
 * Unlike createTask, this preserves the original id, completed state, and
 * timestamps so an "undo delete" is faithful (and any references that still
 * point at this id resolve again). Enqueues a "create" sync op, symmetric to
 * deleteTask's "delete", so synced devices re-create the task.
 *
 * Limitation: inbound dependency edges that removeDependencyReferences stripped
 * on delete are not restored here.
 */
export async function restoreTask(task: TaskRecord): Promise<void> {
  try {
    const db = getDb();
    await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      // `put`, not `add`: this is the Undo path and must stay idempotent.
      await db.tasks.put(task);
      // The record is in trash whenever this ran from the delete toast. Leaving
      // the row behind would put one id in two lifecycle tables (ADR 0013).
      await db.deletedTasks.delete(task.id);
      if (syncEnabled) await enqueue("create", task.id, task);
    });

    logger.info("Task restored", { taskId: task.id, title: task.title });
  } catch (error) {
    logger.error("Failed to restore task", error instanceof Error ? error : undefined, {
      taskId: task.id,
    });
    throw new Error(`Failed to restore task: ${formatErrorMessage(error)}`);
  }
}
