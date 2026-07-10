import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { subtaskSchema } from "@/lib/schema";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { runTaskSyncTransaction } from "./crud/helpers";

/**
 * Toggle a subtask's completion status
 */
export async function toggleSubtask(taskId: string, subtaskId: string, completed: boolean): Promise<TaskRecord> {
  const db = getDb();
  return runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);
    const nextRecord: TaskRecord = {
      ...existing,
      subtasks: existing.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed } : subtask
      ),
      updatedAt: isoNow(),
    };
    await db.tasks.put(nextRecord);
    if (syncEnabled) await enqueue("update", taskId, nextRecord);
    return nextRecord;
  });
}

/**
 * Add a new subtask to a task
 */
export async function addSubtask(taskId: string, title: string): Promise<TaskRecord> {
  const db = getDb();
  const validation = subtaskSchema.safeParse({
    id: generateId(),
    title,
    completed: false,
  });
  if (!validation.success) {
    throw new Error(`Invalid subtask: ${validation.error.issues.map((i) => i.message).join(", ")}`);
  }

  return runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);
    if (existing.subtasks.length >= SCHEMA_LIMITS.MAX_SUBTASKS) {
      throw new Error(`Cannot add subtask: maximum of ${SCHEMA_LIMITS.MAX_SUBTASKS} subtasks reached`);
    }
    const nextRecord: TaskRecord = {
      ...existing,
      subtasks: [...existing.subtasks, validation.data],
      updatedAt: isoNow(),
    };
    await db.tasks.put(nextRecord);
    if (syncEnabled) await enqueue("update", taskId, nextRecord);
    return nextRecord;
  });
}

/**
 * Delete a subtask from a task
 */
export async function deleteSubtask(taskId: string, subtaskId: string): Promise<TaskRecord> {
  const db = getDb();
  return runTaskSyncTransaction(async ({ syncEnabled, enqueue }) => {
    const existing = await db.tasks.get(taskId);
    if (!existing) throw new Error(`Task ${taskId} not found`);
    const nextRecord: TaskRecord = {
      ...existing,
      subtasks: existing.subtasks.filter((subtask) => subtask.id !== subtaskId),
      updatedAt: isoNow(),
    };
    await db.tasks.put(nextRecord);
    if (syncEnabled) await enqueue("update", taskId, nextRecord);
    return nextRecord;
  });
}
