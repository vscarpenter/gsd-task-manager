import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
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
    notificationSent: false
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
    subtasks: updates.subtasks ?? existing.subtasks,
    dependencies: updates.dependencies ?? existing.dependencies,
    notifyBefore: updates.notifyBefore ?? existing.notifyBefore,
    notificationEnabled: updates.notificationEnabled ?? existing.notificationEnabled
  };

  const validated = taskDraftSchema.parse(nextDraft);

  // Check if due date changed - if so, reset notification state
  const dueDateChanged = updates.dueDate !== undefined && updates.dueDate !== existing.dueDate;
  const notifyBeforeChanged = updates.notifyBefore !== undefined && updates.notifyBefore !== existing.notifyBefore;

  const nextRecord: TaskRecord = {
    ...existing,
    ...validated,
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    updatedAt: isoNow(),
    // Reset notification state if due date or reminder time changed
    ...(dueDateChanged || notifyBeforeChanged ? {
      notificationSent: false,
      lastNotificationAt: undefined,
      snoozedUntil: undefined
    } : {})
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

/**
 * Create a new recurring task instance based on a completed task
 */
function createRecurringInstance(existing: TaskRecord): TaskRecord {
  const now = isoNow();
  const nextDueDate = calculateNextDueDate(existing.dueDate, existing.recurrence);

  return {
    ...existing,
    id: generateId(),
    completed: false,
    dueDate: nextDueDate,
    createdAt: now,
    updatedAt: now,
    parentTaskId: existing.parentTaskId ?? existing.id,
    // Reset subtasks to uncompleted for new instance
    subtasks: existing.subtasks.map(subtask => ({ ...subtask, completed: false })),
    // Reset notification state for new instance
    notificationSent: false,
    lastNotificationAt: undefined,
    snoozedUntil: undefined
  };
}

export async function toggleCompleted(id: string, completed: boolean): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(id);
  if (!existing) {
    throw new Error(`Task ${id} not found`);
  }

  // If marking as completed and task has recurrence, create a new instance
  if (completed && existing.recurrence !== "none") {
    const newInstance = createRecurringInstance(existing);
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

/**
 * Regenerate IDs for tasks that conflict with existing IDs
 *
 * Prevents ID collisions when merging imported tasks with existing tasks.
 * Also regenerates subtask IDs to maintain consistency.
 */
function regenerateConflictingIds(tasks: TaskRecord[], existingIds: Set<string>): TaskRecord[] {
  return tasks.map(task => {
    // If ID already exists, regenerate it
    if (existingIds.has(task.id)) {
      return {
        ...task,
        id: generateId(),
        // Also regenerate subtask IDs to avoid conflicts
        subtasks: task.subtasks.map(subtask => ({
          ...subtask,
          id: generateId()
        }))
      };
    }
    return task;
  });
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
      const tasksToImport = regenerateConflictingIds(parsed.tasks, existingIds);
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
    id: generateId(),
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

/**
 * Add a dependency to a task
 */
export async function addDependency(taskId: string, dependencyId: string): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Check if dependency already exists
  if (existing.dependencies.includes(dependencyId)) {
    return existing;
  }

  const nextRecord: TaskRecord = {
    ...existing,
    dependencies: [...existing.dependencies, dependencyId],
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
  return nextRecord;
}

/**
 * Remove a dependency from a task
 */
export async function removeDependency(taskId: string, dependencyId: string): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(taskId);
  if (!existing) {
    throw new Error(`Task ${taskId} not found`);
  }

  const nextRecord: TaskRecord = {
    ...existing,
    dependencies: existing.dependencies.filter(depId => depId !== dependencyId),
    updatedAt: isoNow()
  };

  await db.tasks.put(nextRecord);
  return nextRecord;
}

/**
 * Remove all references to a task from other tasks' dependencies
 * Should be called before deleting a task to clean up dependencies
 */
export async function removeDependencyReferences(taskId: string): Promise<void> {
  const db = getDb();
  const allTasks = await db.tasks.toArray();

  // Find all tasks that depend on this task
  const tasksToUpdate = allTasks.filter(task =>
    task.dependencies && task.dependencies.includes(taskId)
  );

  // Remove this task from their dependencies
  await Promise.all(
    tasksToUpdate.map(task =>
      removeDependency(task.id, taskId)
    )
  );
}
