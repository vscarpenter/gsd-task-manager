import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import { readDefaultReminder } from "@/lib/notifications/default-reminder";
import type { TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import { runTaskSyncTransaction } from "./helpers";

const logger = createLogger("TASK_CRUD");
const COPY_SUFFIX = " (Copy)";

/** Shorten the original so the suffixed title stays valid; the board hides an invalid row. */
function copyTitle(title: string): string {
  const room = SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH - COPY_SUFFIX.length;
  return `${title.slice(0, room).trimEnd()}${COPY_SUFFIX}`;
}

/**
 * Duplicate a task - copies all properties except ID
 */
export async function duplicateTask(id: string): Promise<TaskRecord> {
  try {
    const db = getDb();
    const defaultReminder = await readDefaultReminder();
    const duplicate = await runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
      const original = await db.tasks.get(id);
      if (!original) throw new Error(`Task with id ${id} not found`);
      const record = buildDuplicateRecord(original, defaultReminder);
      await db.tasks.add(record);
      if (syncEnabled) await enqueue("create", record.id, record);
      return record;
    });

    logger.info("Task duplicated", { originalId: id, newId: duplicate.id });
    return duplicate;
  } catch (error) {
    logger.error("Failed to duplicate task", error instanceof Error ? error : undefined, {
      taskId: id,
    });
    throw new Error(`Failed to duplicate task: ${formatErrorMessage(error)}`);
  }
}

/**
 * Build a duplicate task record with fresh metadata
 */
function buildDuplicateRecord(original: TaskRecord, defaultReminder: number): TaskRecord {
  const now = isoNow();

  const duplicate: TaskRecord = {
    ...original,
    id: generateId(),
    title: copyTitle(original.title),
    notifyBefore: original.notifyBefore ?? defaultReminder,
    createdAt: now,
    updatedAt: now,
    completed: false,
    completedAt: undefined,
    notificationSent: false,
    lastNotificationAt: undefined,
    snoozedUntil: undefined,
    // A duplicate starts unpicked (spec-top-three.md section 3.2).
    focusDate: undefined,
    focusRank: undefined,
  };
  // Delete rather than set undefined: IndexedDB stores the key, and the strict
  // export schema, which declares no archivedAt, then left the copy out of backups.
  delete duplicate.archivedAt;
  return duplicate;
}
