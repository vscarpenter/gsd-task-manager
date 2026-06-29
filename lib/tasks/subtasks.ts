import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { subtaskSchema } from "@/lib/schema";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import type { TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { getSyncQueue } from "@/lib/sync/queue";
import { getSyncConfig } from "@/lib/sync/config";

/**
 * Toggle a subtask's completion status
 */
export async function toggleSubtask(taskId: string, subtaskId: string, completed: boolean): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const updatedSubtasks = existing.subtasks.map(st =>
    st.id === subtaskId ? { ...st, completed } : st
  );

  const nextRecord: TaskRecord = {
    ...existing,
    subtasks: updatedSubtasks,
    updatedAt: isoNow(),
  };

  await db.tasks.put(nextRecord);

  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord);
  }

  return nextRecord;
}

/**
 * Add a new subtask to a task
 */
export async function addSubtask(taskId: string, title: string): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (existing.subtasks.length >= SCHEMA_LIMITS.MAX_SUBTASKS) {
    throw new Error(`Cannot add subtask: maximum of ${SCHEMA_LIMITS.MAX_SUBTASKS} subtasks reached`);
  }

  const validation = subtaskSchema.safeParse({
    id: generateId(),
    title,
    completed: false,
  });
  if (!validation.success) {
    throw new Error(`Invalid subtask: ${validation.error.issues.map((i) => i.message).join(", ")}`);
  }

  const nextRecord: TaskRecord = {
    ...existing,
    subtasks: [...existing.subtasks, validation.data],
    updatedAt: isoNow(),
  };

  await db.tasks.put(nextRecord);

  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord);
  }

  return nextRecord;
}

/**
 * Delete a subtask from a task
 */
export async function deleteSubtask(taskId: string, subtaskId: string): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const nextRecord: TaskRecord = {
    ...existing,
    subtasks: existing.subtasks.filter(st => st.id !== subtaskId),
    updatedAt: isoNow(),
  };

  await db.tasks.put(nextRecord);

  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', taskId, nextRecord);
  }

  return nextRecord;
}
