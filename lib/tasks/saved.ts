import { getDb } from "@/lib/db";
import { quadrantIdSchema, taskDraftSchema } from "@/lib/schema";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { runTaskSyncTransaction } from "./crud/helpers";

/** Saving changes placement, never identity or completion. */
export async function saveTaskForLater(id: string): Promise<TaskRecord> {
  return runTaskSyncTransaction(async ({ enqueue }) => {
    const db = getDb();
    const task = await db.tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (task.savedAt) return task;
    if (task.completed) throw new Error("Completed tasks belong in Archive");
    if (task.timeEntries?.some((entry) => !entry.endedAt)) {
      throw new Error("Stop the timer before moving this task to Saved");
    }
    const now = isoNow();
    const saved = { ...task, savedAt: now, updatedAt: now };
    await db.tasks.put(saved);
    await enqueue("update", id, saved);
    return saved;
  });
}

export async function returnSavedTask(
  id: string,
  quadrant: QuadrantId,
  dueDate: string | undefined
): Promise<TaskRecord> {
  quadrantIdSchema.parse(quadrant);
  taskDraftSchema.shape.dueDate.parse(dueDate);
  return runTaskSyncTransaction(async ({ enqueue }) => {
    const db = getDb();
    const task = await db.tasks.get(id);
    if (!task) throw new Error("Saved item not found");
    if (!task.savedAt) return task;
    const active: TaskRecord = {
      ...task,
      savedAt: undefined,
      quadrant,
      urgent: quadrant === "urgent-important" || quadrant === "urgent-not-important",
      important: quadrant === "urgent-important" || quadrant === "not-urgent-important",
      dueDate,
      updatedAt: isoNow(),
      notificationSent: false,
      lastNotificationAt: undefined,
      snoozedUntil: undefined,
    };
    await db.tasks.put(active);
    await enqueue("update", id, active);
    return active;
  });
}
