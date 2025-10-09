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
    updatedAt: now,
    recurrence: validated.recurrence ?? "none",
    tags: validated.tags ?? [],
    subtasks: validated.subtasks ?? []
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
    dueDate: updates.dueDate ?? existing.dueDate,
    recurrence: updates.recurrence ?? existing.recurrence,
    tags: updates.tags ?? existing.tags,
    subtasks: updates.subtasks ?? existing.subtasks
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

/**
 * Calculate the next due date for a recurring task
 */
function calculateNextDueDate(currentDueDate: string | undefined, recurrence: string): string | undefined {
  if (!currentDueDate || recurrence === "none") {
    return currentDueDate;
  }

  const current = new Date(currentDueDate);
  const next = new Date(current);

  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return next.toISOString();
}

export async function toggleCompleted(id: string, completed: boolean): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(id);
  if (!existing) {
    throw new Error(`Task ${id} not found`);
  }

  // If marking as completed and task has recurrence, create a new instance
  if (completed && existing.recurrence !== "none") {
    const now = isoNow();
    const nextDueDate = calculateNextDueDate(existing.dueDate, existing.recurrence);

    // Create new recurring instance
    const newInstance: TaskRecord = {
      ...existing,
      id: nanoid(12),
      completed: false,
      dueDate: nextDueDate,
      createdAt: now,
      updatedAt: now,
      parentTaskId: existing.parentTaskId ?? existing.id, // Track original recurring task
      // Reset subtasks to uncompleted for new instance
      subtasks: existing.subtasks.map(st => ({ ...st, completed: false }))
    };

    await db.tasks.add(newInstance);
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

export async function importTasks(payload: ImportPayload, mode: "replace" | "merge" = "replace"): Promise<void> {
  const db = getDb();
  const parsed = importPayloadSchema.parse(payload);

  await db.transaction("rw", db.tasks, async () => {
    if (mode === "replace") {
      // Replace mode: clear existing and add imported tasks
      await db.tasks.clear();
      await db.tasks.bulkAdd(parsed.tasks);
    } else {
      // Merge mode: keep existing, add imported with regenerated IDs if needed
      const existingTasks = await db.tasks.toArray();
      const existingIds = new Set(existingTasks.map(t => t.id));

      const tasksToImport = parsed.tasks.map(task => {
        // If ID already exists, regenerate it
        if (existingIds.has(task.id)) {
          return {
            ...task,
            id: nanoid(12),
            // Also regenerate subtask IDs to avoid conflicts
            subtasks: task.subtasks.map(st => ({
              ...st,
              id: nanoid(12)
            }))
          };
        }
        return task;
      });

      await db.tasks.bulkAdd(tasksToImport);
    }
  });
}

export async function importFromJson(raw: string, mode: "replace" | "merge" = "replace"): Promise<void> {
  try {
    const payload = JSON.parse(raw);
    await importTasks(payload, mode);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format. Please ensure you selected a valid export file.");
    }
    // Re-throw validation errors from importTasks/schema with their original messages
    throw error;
  }
}

export async function exportToJson(): Promise<string> {
  const payload = await exportTasks();
  return JSON.stringify(payload, null, 2);
}

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
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
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

  const newSubtask = {
    id: nanoid(12),
    title,
    completed: false
  };

  const nextRecord: TaskRecord = {
    ...existing,
    subtasks: [...existing.subtasks, newSubtask],
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
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
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
  return nextRecord;
}
