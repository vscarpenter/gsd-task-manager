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
      await db.tasks.add(task);
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
