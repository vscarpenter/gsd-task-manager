import { buildDescription, extractUrlsFromTitle } from "@/lib/capture-parser";
import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { createLogger } from "@/lib/logger";
import { resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow, formatErrorMessage } from "@/lib/utils";
import { enqueueSyncOperation, getSyncContext } from "./helpers";

const logger = createLogger("TASK_CRUD");

/**
 * Create a new task with validation and sync support.
 *
 * URL extraction runs unconditionally so every task-creation path (capture-bar,
 * edit-drawer, WebMCP, future callers) gets the same XSS-safe link handling.
 * Idempotent: callers that already extracted URLs pass a clean title and the
 * second pass is a no-op.
 */
export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  const { cleanTitle, urls } = extractUrlsFromTitle(input.title);
  const normalized: TaskDraft = {
    ...input,
    title: cleanTitle,
    description: buildDescription(input.description ?? "", urls),
  };

  const result = taskDraftSchema.safeParse(normalized);
  if (!result.success) {
    // Summarize failures as field + Zod error code only. Never log the raw
    // input — it holds the task title/description and would leak free-text
    // content to the browser console.
    const fieldErrors = result.error.issues
      .map(issue => `${issue.path.join(".") || "(root)"} (${issue.code})`)
      .join(", ");
    logger.error("Task validation failed", undefined, { validationErrors: fieldErrors });
    throw new Error(`Task validation failed: ${fieldErrors}`);
  }

  try {
    const { syncConfig } = await getSyncContext();
    const record = buildTaskRecord(result.data);

    const db = getDb();
    await db.tasks.add(record);

    logger.info("Task created", { taskId: record.id, title: record.title });

    await enqueueSyncOperation(
      "create",
      record.id,
      record,
      syncConfig?.enabled ?? false
    );

    return record;
  } catch (error) {
    logger.error("Failed to create task", error instanceof Error ? error : undefined, {
      input,
    });
    throw new Error(`Failed to create task: ${formatErrorMessage(error)}`);
  }
}

/**
 * Build a complete TaskRecord from validated draft data
 */
function buildTaskRecord(validated: TaskDraft): TaskRecord {
  const now = isoNow();

  return {
    ...validated,
    id: generateId(),
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    completed: false,
    createdAt: now,
    updatedAt: now,
    recurrence: validated.recurrence ?? "none",
    tags: validated.tags ?? [],
    subtasks: validated.subtasks ?? [],
    dependencies: validated.dependencies ?? [],
    notificationEnabled: validated.notificationEnabled ?? true,
    notificationSent: false,
  };
}
