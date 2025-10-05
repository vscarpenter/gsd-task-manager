import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { parseQuadrantFlags, resolveQuadrantId } from "@/lib/quadrants";
import { importPayloadSchema, taskDraftSchema, taskRecordSchema } from "@/lib/schema";
import type { ImportPayload, QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";

export async function listTasks(): Promise<TaskRecord[]> {
  const db = getDb();
  return db.tasks.orderBy("createdAt").reverse().toArray();
}

export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  const validated = taskDraftSchema.parse(input);
  const now = isoNow();
  const record: TaskRecord = {
    ...validated,
    id: nanoid(12),
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    completed: false,
    createdAt: now,
    updatedAt: now
  };

  const db = getDb();
  await db.tasks.add(record);
  return record;
}

export async function updateTask(id: string, updates: Partial<TaskDraft>): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(id);
  if (!existing) {
    throw new Error(`Task ${id} not found`);
  }

  const nextDraft: TaskDraft = {
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    urgent: updates.urgent ?? existing.urgent,
    important: updates.important ?? existing.important,
    dueDate: updates.dueDate ?? existing.dueDate
  };

  const validated = taskDraftSchema.parse(nextDraft);
  const nextRecord: TaskRecord = {
    ...existing,
    ...validated,
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
  return nextRecord;
}

export async function toggleCompleted(id: string, completed: boolean): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(id);
  if (!existing) {
    throw new Error(`Task ${id} not found`);
  }

  const nextRecord: TaskRecord = {
    ...existing,
    completed,
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
  return nextRecord;
}

export async function deleteTask(id: string): Promise<void> {
  const db = getDb();
  await db.tasks.delete(id);
}

/**
 * Move a task to a different quadrant by updating its urgent/important flags.
 * This is the primary handler for drag-and-drop operations.
 */
export async function moveTaskToQuadrant(id: string, targetQuadrant: QuadrantId): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(id);
  if (!existing) {
    throw new Error(`Task ${id} not found`);
  }

  const { urgent, important } = parseQuadrantFlags(targetQuadrant);

  const nextRecord: TaskRecord = {
    ...existing,
    urgent,
    important,
    quadrant: targetQuadrant,
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
  return nextRecord;
}

export async function clearTasks(): Promise<void> {
  const db = getDb();
  await db.tasks.clear();
}

export async function exportTasks(): Promise<ImportPayload> {
  const db = getDb();
  const tasks = await db.tasks.toArray();
  const normalized = tasks.map((task) => taskRecordSchema.parse(task));
  return {
    tasks: normalized,
    exportedAt: isoNow(),
    version: "1.0.0"
  } satisfies ImportPayload;
}

export async function importTasks(payload: ImportPayload): Promise<void> {
  const db = getDb();
  const parsed = importPayloadSchema.parse(payload);
  await db.transaction("rw", db.tasks, async () => {
    await db.tasks.clear();
    await db.tasks.bulkAdd(parsed.tasks);
  });
}

export async function importFromJson(raw: string): Promise<void> {
  const payload = JSON.parse(raw);
  await importTasks(payload);
}

export async function exportToJson(): Promise<string> {
  const payload = await exportTasks();
  return JSON.stringify(payload, null, 2);
}
