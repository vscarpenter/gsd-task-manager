/**
 * The next instance of a recurring task. Shared by update_task, complete_task and
 * bulk complete so every completion path spawns the same way the clients do.
 */

import type { GsdConfig, Task } from '../types.js';
import { createTaskInPB, generateTaskId } from './helpers.js';

export function completesRecurringTask(current: Task, completed: boolean | undefined): boolean {
  return completed === true && !current.completed && current.recurrence !== 'none';
}

/**
 * Next due date of a recurring task. Same rule as calculateNextDueDate in
 * lib/tasks/crud/toggle.ts, including local-time arithmetic and setMonth's
 * overflow (Jan 31 plus a month is Mar 3), so both clients agree.
 */
function calculateNextDueDate(dueDate: string | undefined, recurrence: Task['recurrence']): string | undefined {
  if (!dueDate || recurrence === 'none') return dueDate;
  const next = new Date(dueDate);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

/**
 * The instance completing a recurring task spawns. Mirrors buildRecurringInstance
 * in lib/tasks/crud/toggle.ts: everything carries over except the id, completion,
 * the due date, timestamps, subtask completion and the notification bookkeeping.
 * The web's local-only `parentTaskId` has no PocketBase field, so it is not set.
 */
export function buildRecurringInstance(completed: Task): Task {
  const now = new Date().toISOString();
  const nextDueDate = calculateNextDueDate(completed.dueDate, completed.recurrence);
  const { dueDate: _dueDate, completedAt: _completedAt, lastNotificationAt: _last, snoozedUntil: _snoozed, ...carried } = completed;
  return {
    ...carried,
    id: generateTaskId(),
    completed: false,
    ...(nextDueDate && { dueDate: nextDueDate }),
    subtasks: completed.subtasks.map((subtask) => ({ ...subtask, completed: false })),
    notificationSent: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** The original is already saved as complete; say so if the next instance can't be saved. */
export async function createNextInstance(
  config: GsdConfig,
  instance: Task,
  ownerId: string,
  deviceId: string
): Promise<void> {
  try {
    await createTaskInPB(config, instance, ownerId, deviceId);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Task was marked complete, but the next recurring instance could not be created (${reason}). Create it manually or mark the task incomplete and retry.`
    );
  }
}
