/**
 * Bulk update operations for multiple tasks.
 *
 * Performance: pre-fetches PocketBase record ids for the whole batch in a
 * single request (avoids N+1 lookups), throttles writes to stay under PB's
 * rate limit, and invalidates the task cache once at the end instead of once
 * per record.
 */

import type { GsdConfig, Task } from '../types.js';
import type { BulkOperation } from './types.js';
import { listTasks } from '../tools/list-tasks.js';
import { getTaskCache } from '../cache.js';
import {
  deriveQuadrant,
  getAuthInfo,
  fetchPBRecordIdsForTasks,
  updateTaskInPBById,
  deleteTaskInPBById,
  sleep,
  PB_BULK_WRITE_DELAY_MS,
} from './helpers.js';

function applyOperation(task: Task, operation: BulkOperation, now: string): Task {
  if (operation.type === 'complete') {
    const updated: Task = { ...task, completed: operation.completed, updatedAt: now };
    if (operation.completed && !task.completed) {
      updated.completedAt = now;
    } else if (!operation.completed) {
      delete updated.completedAt;
    }
    return updated;
  }

  if (operation.type === 'move_quadrant') {
    return {
      ...task,
      urgent: operation.urgent,
      important: operation.important,
      quadrant: deriveQuadrant(operation.urgent, operation.important),
      updatedAt: now,
    };
  }

  if (operation.type === 'add_tags') {
    return {
      ...task,
      tags: [...new Set([...task.tags, ...operation.tags])],
      updatedAt: now,
    };
  }

  if (operation.type === 'remove_tags') {
    const remove = new Set(operation.tags);
    return {
      ...task,
      tags: task.tags.filter((tag) => !remove.has(tag)),
      updatedAt: now,
    };
  }

  if (operation.type === 'set_due_date') {
    const updated: Task = { ...task, updatedAt: now };
    if (operation.dueDate) {
      updated.dueDate = operation.dueDate;
    } else {
      delete updated.dueDate;
    }
    return updated;
  }

  throw new Error(`Unknown operation type: ${(operation as { type: string }).type}`);
}

export async function bulkUpdateTasks(
  config: GsdConfig,
  taskIds: string[],
  operation: BulkOperation,
  options?: { maxTasks?: number; dryRun?: boolean }
): Promise<{ updated: number; deleted: number; errors: string[]; dryRun: boolean }> {
  const isDryRun = options?.dryRun ?? false;
  const maxTasks = options?.maxTasks ?? 50;

  if (taskIds.length > maxTasks) {
    throw new Error(
      `Bulk operation limit exceeded\n\n` +
        `Requested: ${taskIds.length} tasks\n` +
        `Maximum: ${maxTasks} tasks\n\n` +
        `Please reduce the number of tasks or split into multiple operations.`
    );
  }

  if (taskIds.length === 0) {
    return { updated: 0, deleted: 0, errors: [], dryRun: isDryRun };
  }

  const allTasks = await listTasks(config);
  const tasksToUpdate = allTasks.filter((t) => taskIds.includes(t.id));

  if (tasksToUpdate.length === 0) {
    return { updated: 0, deleted: 0, errors: ['No matching tasks found'], dryRun: isDryRun };
  }

  if (isDryRun) {
    const deletes = operation.type === 'delete' ? tasksToUpdate.length : 0;
    const updates = operation.type === 'delete' ? 0 : tasksToUpdate.length;
    return { updated: updates, deleted: deletes, errors: [], dryRun: true };
  }

  // Pre-fetch PB record ids for the whole batch in one request.
  const [{ ownerId, deviceId }, recordIdMap] = await Promise.all([
    getAuthInfo(config),
    fetchPBRecordIdsForTasks(
      config,
      tasksToUpdate.map((t) => t.id)
    ),
  ]);

  const errors: string[] = [];
  let updateCount = 0;
  let deleteCount = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < tasksToUpdate.length; i++) {
    const task = tasksToUpdate[i];
    const pbRecordId = recordIdMap.get(task.id);

    if (!pbRecordId) {
      errors.push(`Task ${task.id}: not found in PocketBase`);
      continue;
    }

    try {
      if (operation.type === 'delete') {
        await deleteTaskInPBById(config, pbRecordId);
        deleteCount++;
      } else {
        const updated = applyOperation(task, operation, now);
        await updateTaskInPBById(config, pbRecordId, updated, ownerId, deviceId);
        updateCount++;
      }
    } catch (error) {
      errors.push(
        `Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Throttle between writes to avoid PocketBase 429s.
    if (i < tasksToUpdate.length - 1) {
      await sleep(PB_BULK_WRITE_DELAY_MS);
    }
  }

  // Single cache invalidation after the full batch rather than once per write.
  getTaskCache().invalidate();

  return {
    updated: updateCount,
    deleted: deleteCount,
    errors,
    dryRun: false,
  };
}
