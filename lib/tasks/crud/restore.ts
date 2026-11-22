import { bringBackInTransaction } from "@/lib/task-tables";
import { createLogger } from "@/lib/logger";
import { formatErrorMessage } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";
import { forgetForResurrect } from "@/lib/sync/resurrect-ids";
import { runTaskSyncTransaction } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Restore a previously deleted task: the record Undo holds, or a newer copy
 * stored since.
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
    await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const restored = await bringBackInTransaction(task);
      await forgetForResurrect([task.id]);
      if (syncEnabled) await enqueue("create", task.id, restored);
    });

    logger.info("Task restored", { taskId: task.id });
  } catch (error) {
    logger.error("Failed to restore task", error instanceof Error ? error : undefined, {
      taskId: task.id,
    });
    throw new Error(`Failed to restore task: ${formatErrorMessage(error)}`);
  }
}
