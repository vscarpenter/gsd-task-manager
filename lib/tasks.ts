import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { resolveQuadrantId } from "@/lib/quadrants";
import { importPayloadSchema, taskDraftSchema, taskRecordSchema } from "@/lib/schema";
import type { ImportPayload, TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";

export async function listTasks(): Promise<TaskRecord[]> {
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

  await db.tasks.add(record);
  return record;
}

export async function updateTask(id: string, updates: Partial<TaskDraft>): Promise<TaskRecord> {
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
  await db.tasks.delete(id);
}

export async function clearTasks(): Promise<void> {
  await db.tasks.clear();
}

export async function exportTasks(): Promise<ImportPayload> {
  const tasks = await db.tasks.toArray();
  const normalized = tasks.map((task) => taskRecordSchema.parse(task));
  return {
    tasks: normalized,
    exportedAt: isoNow(),
    version: "1.0.0"
  } satisfies ImportPayload;
}

export async function importTasks(payload: ImportPayload): Promise<void> {
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
