/**
 * Bulk update operations for multiple tasks
 * Handles batch operations for complete, move, tag management, and delete
 */

import type { GsdConfig, DecryptedTask } from '../tools.js';
import type { BulkOperation, SyncOperation } from './types.js';
import { getCryptoManager } from '../crypto.js';
import { listTasks } from '../tools.js';
import { deriveQuadrant, ensureEncryption, pushToSync } from './helpers.js';

/**
 * Bulk update multiple tasks
 */
export async function bulkUpdateTasks(
  config: GsdConfig,
  taskIds: string[],
  operation: BulkOperation,
  options?: { maxTasks?: number }
): Promise<{ updated: number; errors: string[] }> {
  await ensureEncryption(config);

  const maxTasks = options?.maxTasks || 50;

  // Safety check: limit bulk operations
  if (taskIds.length > maxTasks) {
    throw new Error(
      `❌ Bulk operation limit exceeded\n\n` +
        `Requested: ${taskIds.length} tasks\n` +
        `Maximum: ${maxTasks} tasks\n\n` +
        `Please reduce the number of tasks or split into multiple operations.`
    );
  }

  if (taskIds.length === 0) {
    return { updated: 0, errors: [] };
  }

  // Fetch current tasks
  const allTasks = await listTasks(config);
  const tasksToUpdate = allTasks.filter((t) => taskIds.includes(t.id));

  if (tasksToUpdate.length === 0) {
    return { updated: 0, errors: ['No matching tasks found'] };
  }

  const errors: string[] = [];
  const operations: SyncOperation[] = [];

  const cryptoManager = getCryptoManager();
  const now = new Date().toISOString();

  for (const task of tasksToUpdate) {
    try {
      let updatedTask: DecryptedTask;

      switch (operation.type) {
        case 'complete':
          updatedTask = { ...task, completed: operation.completed, updatedAt: now };
          // Set/clear completedAt
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
          // Set or clear dueDate
          if (operation.dueDate) {
            updatedTask.dueDate = operation.dueDate;
          } else {
            delete updatedTask.dueDate;
          }
          break;

        case 'delete':
          // Delete operation
          operations.push({
            type: 'delete',
            taskId: task.id,
            vectorClock: {}, // Simplified: let server manage
          });
          continue;

        default:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          throw new Error(`Unknown operation type: ${(operation as any).type}`);
      }

      // Encrypt updated task and calculate checksum
      const taskJson = JSON.stringify(updatedTask);
      const { ciphertext, nonce } = await cryptoManager.encrypt(taskJson);
      const checksum = await cryptoManager.hash(taskJson);

      operations.push({
        type: 'update',
        taskId: task.id,
        encryptedBlob: ciphertext,
        nonce,
        vectorClock: {}, // Simplified: let server manage
        checksum,
      });
    } catch (error) {
      errors.push(
        `Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Push all updates at once
  if (operations.length > 0) {
    try {
      await pushToSync(config, operations);
    } catch (error) {
      throw new Error(
        `❌ Bulk update failed\n\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `None of the ${operations.length} tasks were updated.`
      );
    }
  }

  return {
    updated: operations.length,
    errors,
  };
}
