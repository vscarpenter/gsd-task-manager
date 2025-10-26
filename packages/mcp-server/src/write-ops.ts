/**
 * Write operations for creating, updating, and deleting tasks
 * Handles encryption and sync push to Worker API
 */

import { z } from 'zod';
import type { GsdConfig, DecryptedTask } from './tools.js';
import { getCryptoManager } from './crypto.js';
import { getDeviceIdFromToken } from './jwt.js';
import { listTasks } from './tools.js';

/**
 * Task creation input
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  urgent: boolean;
  important: boolean;
  dueDate?: number | null;
  tags?: string[];
  subtasks?: Array<{ text: string; completed: boolean }>;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies?: string[];
}

/**
 * Task update input (partial)
 */
export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  urgent?: boolean;
  important?: boolean;
  dueDate?: number | null;
  tags?: string[];
  subtasks?: Array<{ id: string; text: string; completed: boolean }>;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies?: string[];
  completed?: boolean;
}

/**
 * Bulk update operation types
 */
export type BulkOperation =
  | { type: 'complete'; completed: boolean }
  | { type: 'move_quadrant'; urgent: boolean; important: boolean }
  | { type: 'add_tags'; tags: string[] }
  | { type: 'remove_tags'; tags: string[] }
  | { type: 'set_due_date'; dueDate: number | null }
  | { type: 'delete' };

/**
 * Generate unique ID for new tasks
 */
function generateTaskId(): string {
  // Use crypto.randomUUID() for secure random IDs
  const uuid = crypto.randomUUID();
  // Remove hyphens to match frontend format
  return uuid.replace(/-/g, '');
}

/**
 * Derive quadrant ID from urgent/important flags
 */
function deriveQuadrantId(urgent: boolean, important: boolean): string {
  if (urgent && important) return 'urgent-important';
  if (!urgent && important) return 'not-urgent-important';
  if (urgent && !important) return 'urgent-not-important';
  return 'not-urgent-not-important';
}

/**
 * Initialize encryption for write operations
 */
async function ensureEncryption(config: GsdConfig): Promise<void> {
  if (!config.encryptionPassphrase) {
    throw new Error(
      `❌ Encryption passphrase required for write operations\n\n` +
        `Write operations require encryption to be enabled.\n` +
        `Add GSD_ENCRYPTION_PASSPHRASE to your Claude Desktop config.\n\n` +
        `Run: npx gsd-mcp-server --setup`
    );
  }

  const cryptoManager = getCryptoManager();
  if (!cryptoManager.isInitialized()) {
    // Fetch salt and initialize (same as read operations)
    const response = await fetch(`${config.apiBaseUrl}/api/auth/encryption-salt`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch encryption salt: ${response.status}`);
    }

    const data = (await response.json()) as { encryptionSalt: string };
    if (!data.encryptionSalt) {
      throw new Error('Encryption not set up for this account');
    }

    await cryptoManager.deriveKey(config.encryptionPassphrase, data.encryptionSalt);
  }
}

/**
 * Sync operation for push request
 */
interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  taskId: string;
  encryptedBlob?: string;
  nonce?: string;
  vectorClock: Record<string, number>;
  checksum?: string; // SHA-256 hash of plaintext JSON (required for create/update)
}

/**
 * Push encrypted task data to sync API
 */
async function pushToSync(
  config: GsdConfig,
  operations: SyncOperation[]
): Promise<void> {
  const deviceId = getDeviceIdFromToken(config.authToken);

  const response = await fetch(`${config.apiBaseUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId,
      operations,
      clientVectorClock: {}, // Simplified: let server handle vector clock
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `❌ Failed to push task changes (${response.status})\n\n` +
        `Error: ${errorText}\n\n` +
        `Your changes were not saved to the server.`
    );
  }

  // Check response for rejected operations and conflicts
  const result = (await response.json()) as {
    accepted?: string[];
    rejected?: Array<{ taskId: string; reason: string; details: string }>;
    conflicts?: Array<unknown>;
    serverVectorClock?: Record<string, number>;
  };

  // Check for rejected operations
  if (result.rejected && result.rejected.length > 0) {
    const rejectionDetails = result.rejected
      .map((r) => `  - Task ${r.taskId}: ${r.reason} - ${r.details}`)
      .join('\n');
    throw new Error(
      `❌ Worker rejected ${result.rejected.length} operation(s)\n\n` +
        `${rejectionDetails}\n\n` +
        `Your changes were not saved to the server.`
    );
  }

  // Check for conflicts
  if (result.conflicts && result.conflicts.length > 0) {
    console.warn(`⚠️  Warning: ${result.conflicts.length} conflict(s) detected`);
    console.warn('Last-write-wins strategy applied - your changes took precedence');
  }
}

/**
 * Create a new task
 */
export async function createTask(
  config: GsdConfig,
  input: CreateTaskInput
): Promise<DecryptedTask> {
  await ensureEncryption(config);

  const now = Date.now();
  const taskId = generateTaskId();
  const quadrantId = deriveQuadrantId(input.urgent, input.important);

  // Generate IDs for subtasks if provided
  const subtasksWithIds = input.subtasks
    ? input.subtasks.map((st) => ({
        id: generateTaskId(),
        text: st.text,
        completed: st.completed,
      }))
    : [];

  const newTask: DecryptedTask = {
    id: taskId,
    title: input.title,
    description: input.description || '',
    urgent: input.urgent,
    important: input.important,
    quadrantId,
    completed: false,
    dueDate: input.dueDate ?? null,
    tags: input.tags || [],
    subtasks: subtasksWithIds,
    recurrence: input.recurrence || 'none',
    dependencies: input.dependencies || [],
    createdAt: now,
    updatedAt: now,
  };

  // Encrypt task and calculate checksum
  const cryptoManager = getCryptoManager();
  const taskJson = JSON.stringify(newTask);
  const { ciphertext, nonce } = await cryptoManager.encrypt(taskJson);
  const checksum = await cryptoManager.hash(taskJson);

  // Push to sync
  await pushToSync(config, [
    {
      type: 'create',
      taskId,
      encryptedBlob: ciphertext,
      nonce,
      vectorClock: {}, // Simplified: let server manage
      checksum,
    },
  ]);

  return newTask;
}

/**
 * Update an existing task
 */
export async function updateTask(
  config: GsdConfig,
  input: UpdateTaskInput
): Promise<DecryptedTask> {
  await ensureEncryption(config);

  // Fetch current task
  const tasks = await listTasks(config);
  const currentTask = tasks.find((t) => t.id === input.id);

  if (!currentTask) {
    throw new Error(`❌ Task not found: ${input.id}\n\nThe task may have been deleted.`);
  }

  // Merge updates
  const updatedTask: DecryptedTask = {
    ...currentTask,
    title: input.title ?? currentTask.title,
    description: input.description ?? currentTask.description,
    urgent: input.urgent ?? currentTask.urgent,
    important: input.important ?? currentTask.important,
    dueDate: input.dueDate !== undefined ? input.dueDate : currentTask.dueDate,
    tags: input.tags ?? currentTask.tags,
    subtasks: input.subtasks ?? currentTask.subtasks,
    recurrence: input.recurrence ?? currentTask.recurrence,
    dependencies: input.dependencies ?? currentTask.dependencies,
    completed: input.completed ?? currentTask.completed,
    updatedAt: Date.now(),
  };

  // Recalculate quadrant if urgent/important changed
  if (input.urgent !== undefined || input.important !== undefined) {
    updatedTask.quadrantId = deriveQuadrantId(updatedTask.urgent, updatedTask.important);
  }

  // Encrypt task and calculate checksum
  const cryptoManager = getCryptoManager();
  const taskJson = JSON.stringify(updatedTask);
  const { ciphertext, nonce } = await cryptoManager.encrypt(taskJson);
  const checksum = await cryptoManager.hash(taskJson);

  // Push to sync
  await pushToSync(config, [
    {
      type: 'update',
      taskId: updatedTask.id,
      encryptedBlob: ciphertext,
      nonce,
      vectorClock: {}, // Simplified: let server manage
      checksum,
    },
  ]);

  return updatedTask;
}

/**
 * Toggle task completion status
 */
export async function completeTask(
  config: GsdConfig,
  taskId: string,
  completed: boolean
): Promise<DecryptedTask> {
  return updateTask(config, {
    id: taskId,
    completed,
  });
}

/**
 * Delete a task
 */
export async function deleteTask(config: GsdConfig, taskId: string): Promise<void> {
  await ensureEncryption(config);

  // Verify task exists
  const tasks = await listTasks(config);
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    throw new Error(`❌ Task not found: ${taskId}\n\nThe task may have already been deleted.`);
  }

  // Push deletion
  await pushToSync(config, [
    {
      type: 'delete',
      taskId,
      vectorClock: {}, // Simplified: let server manage
    },
  ]);
}

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
  const now = Date.now();

  for (const task of tasksToUpdate) {
    try {
      let updatedTask: DecryptedTask;

      switch (operation.type) {
        case 'complete':
          updatedTask = { ...task, completed: operation.completed, updatedAt: now };
          break;

        case 'move_quadrant':
          updatedTask = {
            ...task,
            urgent: operation.urgent,
            important: operation.important,
            quadrantId: deriveQuadrantId(operation.urgent, operation.important),
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
          updatedTask = { ...task, dueDate: operation.dueDate, updatedAt: now };
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
