import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { parseQuadrantFlags, resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { getSyncQueue } from "@/lib/sync/queue";
import { incrementVectorClock } from "@/lib/sync/vector-clock";
import { getSyncConfig } from "@/lib/sync/config";

/**
 * List all tasks ordered by creation date (newest first)
 */
export async function listTasks(): Promise<TaskRecord[]> {
  const db = getDb();
  return db.tasks.orderBy("createdAt").reverse().toArray();
}

/**
 * Create a new task with validation and sync support
 */
export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  const validated = taskDraftSchema.parse(input);
  const now = isoNow();

  // Get device ID and initialize vector clock for sync
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const vectorClock = incrementVectorClock({}, deviceId);

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
    notificationSent: false,
    vectorClock
  };

  const db = getDb();
  await db.tasks.add(record);

  // Enqueue sync operation if sync is enabled
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('create', record.id, record, record.vectorClock || {});
  }

  return record;
}

/**
 * Update an existing task with partial updates
 */
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

  // Increment vector clock for sync
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const currentClock = existing.vectorClock || {};
  const newClock = incrementVectorClock(currentClock, deviceId);

  const nextRecord: TaskRecord = {
    ...existing,
    ...validated,
    quadrant: resolveQuadrantId(validated.urgent, validated.important),
    updatedAt: isoNow(),
    vectorClock: newClock,
    // Reset notification state if due date or reminder time changed
    ...(dueDateChanged || notifyBeforeChanged ? {
      notificationSent: false,
      lastNotificationAt: undefined,
      snoozedUntil: undefined
    } : {})
  };

  await db.tasks.put(nextRecord);

  // Enqueue sync operation if sync is enabled
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', id, nextRecord, nextRecord.vectorClock || {});
  }

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
async function createRecurringInstance(existing: TaskRecord): Promise<TaskRecord> {
  const now = isoNow();
  const nextDueDate = calculateNextDueDate(existing.dueDate, existing.recurrence);

  // Initialize new vector clock for new instance
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const vectorClock = incrementVectorClock({}, deviceId);

  return {
    ...existing,
    id: generateId(),
    completed: false,
    dueDate: nextDueDate,
    createdAt: now,
    updatedAt: now,
    parentTaskId: existing.parentTaskId ?? existing.id,
    vectorClock,
    // Reset subtasks to uncompleted for new instance
    subtasks: existing.subtasks.map(subtask => ({ ...subtask, completed: false })),
    // Reset notification state for new instance
    notificationSent: false,
    lastNotificationAt: undefined,
    snoozedUntil: undefined
  };
}

/**
 * Toggle task completion status, handling recurring task creation
 */
export async function toggleCompleted(id: string, completed: boolean): Promise<TaskRecord> {
  const db = getDb();
  const existing = await db.tasks.get(id);
  if (!existing) {
    throw new Error(`Task ${id} not found`);
  }

  // Get sync config for vector clock and queue
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';

  // If marking as completed and task has recurrence, create a new instance
  if (completed && existing.recurrence !== "none") {
    const newInstance = await createRecurringInstance(existing);
    await db.tasks.add(newInstance);

    // Enqueue creation of new recurring instance if sync is enabled
    if (syncConfig?.enabled) {
      const queue = getSyncQueue();
      await queue.enqueue('create', newInstance.id, newInstance, newInstance.vectorClock || {});
    }
  }

  // Increment vector clock for the completed task
  const currentClock = existing.vectorClock || {};
  const newClock = incrementVectorClock(currentClock, deviceId);

  const now = isoNow();
  const nextRecord: TaskRecord = {
    ...existing,
    completed,
    completedAt: completed ? now : undefined, // Set completedAt when marking complete, clear when uncompleting
    updatedAt: now,
    vectorClock: newClock
  };

  await db.tasks.put(nextRecord);

  // Enqueue sync operation if sync is enabled
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', id, nextRecord, nextRecord.vectorClock || {});
  }

  return nextRecord;
}

/**
 * Delete a task and enqueue sync operation
 */
export async function deleteTask(id: string): Promise<void> {
  const db = getDb();

  // Read task BEFORE deleting to preserve vector clock
  // This is critical for conflict detection on the server
  const task = await db.tasks.get(id);
  const vectorClock = task?.vectorClock || {};

  await db.tasks.delete(id);

  // Enqueue sync operation if sync is enabled
  const syncConfig = await getSyncConfig();
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    // Increment vector clock for delete operation
    const deviceId = syncConfig.deviceId || 'local';
    const deleteClock = incrementVectorClock(vectorClock, deviceId);
    await queue.enqueue('delete', id, null, deleteClock);
  }
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

  // Increment vector clock for sync
  const syncConfig = await getSyncConfig();
  const deviceId = syncConfig?.deviceId || 'local';
  const currentClock = existing.vectorClock || {};
  const newClock = incrementVectorClock(currentClock, deviceId);

  const nextRecord: TaskRecord = {
    ...existing,
    urgent,
    important,
    quadrant: targetQuadrant,
    updatedAt: isoNow(),
    vectorClock: newClock
  };

  await db.tasks.put(nextRecord);

  // Enqueue sync operation if sync is enabled
  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('update', id, nextRecord, nextRecord.vectorClock || {});
  }

  return nextRecord;
}

/**
 * Clear all tasks from the database
 */
export async function clearTasks(): Promise<void> {
  const db = getDb();
  await db.tasks.clear();
}
