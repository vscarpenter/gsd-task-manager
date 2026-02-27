/**
 * Bulk update operations for multiple tasks
 * Handles batch operations for complete, move, tag management, and delete
 */

import type { GsdConfig, DecryptedTask } from '../tools.js';
import type { BulkOperation, SyncOperation } from './types.js';
import { listTasks } from '../tools.js';
import { deriveQuadrant, ensureEncryption, pushToSync } from './helpers.js';

/**
 * Bulk update multiple tasks
 */
export async function bulkUpdateTasks(
  config: GsdConfig,
  taskIds: string[],
  operation: BulkOperation,
  options?: { maxTasks?: number; dryRun?: boolean }
): Promise<{ updated: number; deleted: number; errors: string[]; dryRun: boolean }> {
  const isDryRun = options?.dryRun ?? false;

  await ensureEncryption(config);

  const maxTasks = options?.maxTasks ?? 50;

  // Safety check: limit bulk operations
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

  // Fetch current tasks
  const allTasks = await listTasks(config);
  const tasksToUpdate = allTasks.filter((t) => taskIds.includes(t.id));

  if (tasksToUpdate.length === 0) {
    return { updated: 0, deleted: 0, errors: ['No matching tasks found'], dryRun: isDryRun };
  }

  const errors: string[] = [];
  const operations: SyncOperation[] = [];

  const now = new Date().toISOString();

  for (const task of tasksToUpdate) {
    try {
      const syncOp = applyBulkOperation(task, operation, now);
      operations.push(syncOp);
    } catch (error) {
      errors.push(
        `Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  const deleteCount = operations.filter((op) => op.type === 'delete').length;
  const updateCount = operations.length - deleteCount;

  // In dry-run mode, skip the actual push
  if (isDryRun) {
    return { updated: updateCount, deleted: deleteCount, errors, dryRun: true };
  }

  // Push all updates at once (pushToSync handles encryption)
  if (operations.length > 0) {
    try {
      await pushToSync(config, operations);
    } catch (error) {
      throw new Error(
        `Bulk update failed\n\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `None of the ${operations.length} tasks were updated.`
      );
    }
  }

  return {
    updated: updateCount,
    deleted: deleteCount,
    errors,
    dryRun: false,
  };
}

/**
 * Apply a bulk operation to a single task and return the sync operation
 */
function applyBulkOperation(
  task: DecryptedTask,
  operation: BulkOperation,
  now: string
): SyncOperation {
  switch (operation.type) {
    case 'complete': {
      const updatedTask: DecryptedTask = { ...task, completed: operation.completed, updatedAt: now };
      if (operation.completed && !task.completed) {
        updatedTask.completedAt = now;
      } else if (!operation.completed) {
        delete updatedTask.completedAt;
      }
      return { type: 'update', taskId: task.id, data: updatedTask };
    }

    case 'move_quadrant':
      return {
        type: 'update',
        taskId: task.id,
        data: {
          ...task,
          urgent: operation.urgent,
          important: operation.important,
          quadrant: deriveQuadrant(operation.urgent, operation.important),
          updatedAt: now,
        },
      };

    case 'add_tags': {
      const newTags = [...new Set([...task.tags, ...operation.tags])];
      return { type: 'update', taskId: task.id, data: { ...task, tags: newTags, updatedAt: now } };
    }

    case 'remove_tags': {
      const tagsToRemove = new Set(operation.tags);
      const filteredTags = task.tags.filter((tag) => !tagsToRemove.has(tag));
      return { type: 'update', taskId: task.id, data: { ...task, tags: filteredTags, updatedAt: now } };
    }

    case 'set_due_date': {
      const updatedTask: DecryptedTask = { ...task, updatedAt: now };
      if (operation.dueDate) {
        updatedTask.dueDate = operation.dueDate;
      } else {
        delete updatedTask.dueDate;
      }
      return { type: 'update', taskId: task.id, data: updatedTask };
    }

    case 'delete':
      return { type: 'delete', taskId: task.id };

    default:
      throw new Error(`Unknown operation type: ${(operation as { type: string }).type}`);
  }
}
