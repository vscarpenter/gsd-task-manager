/**
 * Bulk update operations for multiple tasks
 */

import type { GsdConfig, Task } from '../types.js';
import type { BulkOperation } from './types.js';
import { listTasks } from '../tools/list-tasks.js';
import { deriveQuadrant, updateTaskInPB, deleteTaskInPB, getAuthInfo } from './helpers.js';

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

  const { ownerId, deviceId } = getAuthInfo(config);
  const errors: string[] = [];
  let updateCount = 0;
  let deleteCount = 0;
  const now = new Date().toISOString();

  for (const task of tasksToUpdate) {
    try {
      if (operation.type === 'delete') {
        if (!isDryRun) {
          await deleteTaskInPB(config, task.id);
        }
        deleteCount++;
        continue;
      }

      let updatedTask: Task;

      switch (operation.type) {
        case 'complete':
          updatedTask = { ...task, completed: operation.completed, updatedAt: now };
          if (operation.completed && !task.completed) {
            updatedTask.completedAt = now;
          } else if (!operation.completed) {
            delete updatedTask.completedAt;
          }
          break;

        case 'move_quadrant':
          updatedTask = {
            ...task,
            urgent: operation.urgent,
            important: operation.important,
            quadrant: deriveQuadrant(operation.urgent, operation.important),
            updatedAt: now,
          };
          break;

        case 'add_tags': {
          const newTags = [...new Set([...task.tags, ...operation.tags])];
          updatedTask = { ...task, tags: newTags, updatedAt: now };
          break;
        }

        case 'remove_tags': {
          const tagsToRemove = new Set(operation.tags);
          const filteredTags = task.tags.filter((tag) => !tagsToRemove.has(tag));
          updatedTask = { ...task, tags: filteredTags, updatedAt: now };
          break;
        }

        case 'set_due_date':
          updatedTask = { ...task, updatedAt: now };
          if (operation.dueDate) {
            updatedTask.dueDate = operation.dueDate;
          } else {
            delete updatedTask.dueDate;
          }
          break;

        default:
          throw new Error(`Unknown operation type: ${(operation as { type: string }).type}`);
      }

      if (!isDryRun) {
        await updateTaskInPB(config, updatedTask, ownerId, deviceId);
      }
      updateCount++;
    } catch (error) {
      errors.push(
        `Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    updated: updateCount,
    deleted: deleteCount,
    errors,
    dryRun: isDryRun,
  };
}
