import { getDb } from "@/lib/db";
import { generateId } from "@/lib/id-generator";
import { parseQuadrantFlags, resolveQuadrantId } from "@/lib/quadrants";
import { taskDraftSchema } from "@/lib/schema";
import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import { isoNow } from "@/lib/utils";
import { getSyncQueue } from "@/lib/sync/queue";
import { incrementVectorClock } from "@/lib/sync/vector-clock";
import { getSyncConfig } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";

const logger = createLogger('TASK_CRUD');

/**
 * List all tasks ordered by creation date (newest first)
 */
export async function listTasks(): Promise<TaskRecord[]> {
  try {
    const db = getDb();
    const tasks = await db.tasks.orderBy("createdAt").reverse().toArray();
    logger.debug('Listed tasks', { count: tasks.length });
    return tasks;
  } catch (error) {
    logger.error('Failed to list tasks', error instanceof Error ? error : undefined);
    throw new Error(`Failed to list tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a new task with validation and sync support
 */
export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  try {
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

    logger.info('Task created', { taskId: record.id, title: record.title });

    // Enqueue sync operation if sync is enabled
    if (syncConfig?.enabled) {
      const queue = getSyncQueue();
      await queue.enqueue('create', record.id, record, record.vectorClock || {});
      logger.debug('Task creation queued for sync', { taskId: record.id });
    }

    return record;
  } catch (error) {
    logger.error('Failed to create task', error instanceof Error ? error : undefined, { input });
    if (error instanceof Error && error.name === 'ZodError') {
      throw new Error(`Task validation failed: ${error.message}`);
    }
    throw new Error(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing task with partial updates
 */
export async function updateTask(id: string, updates: Partial<TaskDraft>): Promise<TaskRecord> {
  try {
    const db = getDb();
    const existing = await db.tasks.get(id);
    if (!existing) {
      logger.warn('Task not found for update', { taskId: id });
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

    logger.info('Task updated', { taskId: id, title: nextRecord.title });

    // Enqueue sync operation if sync is enabled
    if (syncConfig?.enabled) {
      const queue = getSyncQueue();
      await queue.enqueue('update', id, nextRecord, nextRecord.vectorClock || {});
      logger.debug('Task update queued for sync', { taskId: id });
    }

    return nextRecord;
  } catch (error) {
    logger.error('Failed to update task', error instanceof Error ? error : undefined, { taskId: id, updates });
    if (error instanceof Error && error.name === 'ZodError') {
      throw new Error(`Task validation failed: ${error.message}`);
    }
    throw new Error(`Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  try {
    const db = getDb();
    const existing = await db.tasks.get(id);
    if (!existing) {
      logger.warn('Task not found for completion toggle', { taskId: id });
      throw new Error(`Task ${id} not found`);
    }

    // Get sync config for vector clock and queue
    const syncConfig = await getSyncConfig();
    const deviceId = syncConfig?.deviceId || 'local';

    // If marking as completed and task has recurrence, create a new instance
    if (completed && existing.recurrence !== "none") {
      const newInstance = await createRecurringInstance(existing);
      await db.tasks.add(newInstance);

      logger.info('Created recurring task instance', {
        originalTaskId: id,
        newTaskId: newInstance.id,
        recurrence: existing.recurrence
      });

      // Enqueue creation of new recurring instance if sync is enabled
      if (syncConfig?.enabled) {
        const queue = getSyncQueue();
        await queue.enqueue('create', newInstance.id, newInstance, newInstance.vectorClock || {});
        logger.debug('Recurring task instance queued for sync', { taskId: newInstance.id });
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

    logger.info('Task completion toggled', { taskId: id, completed, title: existing.title });

    // Enqueue sync operation if sync is enabled
    if (syncConfig?.enabled) {
      const queue = getSyncQueue();
      await queue.enqueue('update', id, nextRecord, nextRecord.vectorClock || {});
      logger.debug('Task completion queued for sync', { taskId: id });
    }

    return nextRecord;
  } catch (error) {
    logger.error('Failed to toggle task completion', error instanceof Error ? error : undefined, { taskId: id, completed });
    throw new Error(`Failed to toggle task completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a task and enqueue sync operation
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    const db = getDb();

    // Read task BEFORE deleting to preserve vector clock
    // This is critical for conflict detection on the server
    const task = await db.tasks.get(id);
    if (!task) {
      // Idempotent delete: if task doesn't exist, operation succeeds without error
      logger.info('Task already deleted or does not exist', { taskId: id });
      return;
    }

    const vectorClock = task.vectorClock || {};
    const taskTitle = task.title;

    await db.tasks.delete(id);

    logger.info('Task deleted', { taskId: id, title: taskTitle });

    // Enqueue sync operation if sync is enabled
    const syncConfig = await getSyncConfig();
    if (syncConfig?.enabled) {
      const queue = getSyncQueue();
      // Increment vector clock for delete operation
      const deviceId = syncConfig.deviceId || 'local';
      const deleteClock = incrementVectorClock(vectorClock, deviceId);
      await queue.enqueue('delete', id, null, deleteClock);
      logger.debug('Task deletion queued for sync', { taskId: id });
    }
  } catch (error) {
    logger.error('Failed to delete task', error instanceof Error ? error : undefined, { taskId: id });
    throw new Error(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Move a task to a different quadrant by updating its urgent/important flags.
 * This is the primary handler for drag-and-drop operations.
 */
export async function moveTaskToQuadrant(id: string, targetQuadrant: QuadrantId): Promise<TaskRecord> {
  try {
    const db = getDb();
    const existing = await db.tasks.get(id);
    if (!existing) {
      logger.warn('Task not found for quadrant move', { taskId: id });
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

    logger.info('Task moved to quadrant', {
      taskId: id,
      title: existing.title,
      fromQuadrant: existing.quadrant,
      toQuadrant: targetQuadrant
    });

    // Enqueue sync operation if sync is enabled
    if (syncConfig?.enabled) {
      const queue = getSyncQueue();
      await queue.enqueue('update', id, nextRecord, nextRecord.vectorClock || {});
      logger.debug('Task quadrant move queued for sync', { taskId: id });
    }

    return nextRecord;
  } catch (error) {
    logger.error('Failed to move task to quadrant', error instanceof Error ? error : undefined, { taskId: id, targetQuadrant });
    throw new Error(`Failed to move task to quadrant: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear all tasks from the database
 */
export async function clearTasks(): Promise<void> {
  try {
    const db = getDb();
    const count = await db.tasks.count();
    await db.tasks.clear();
    logger.info('All tasks cleared', { count });
  } catch (error) {
    logger.error('Failed to clear tasks', error instanceof Error ? error : undefined);
    throw new Error(`Failed to clear tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
