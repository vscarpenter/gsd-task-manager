/**
 * Individual task CRUD operations
 * Handles create, update, complete, and delete for single tasks
 */

import type { GsdConfig, DecryptedTask } from '../tools.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import { getCryptoManager } from '../crypto.js';
import { listTasks } from '../tools.js';
import { generateTaskId, deriveQuadrant, ensureEncryption, pushToSync } from './helpers.js';

/**
 * Create a new task
 */
export async function createTask(
  config: GsdConfig,
  input: CreateTaskInput
): Promise<DecryptedTask> {
  await ensureEncryption(config);

  const now = new Date().toISOString();
  const taskId = generateTaskId();
  const quadrant = deriveQuadrant(input.urgent, input.important);

  // Generate IDs for subtasks if provided
  const subtasksWithIds = input.subtasks
    ? input.subtasks.map((st) => ({
        id: generateTaskId(),
        title: st.title,
        completed: st.completed,
      }))
    : [];

  const newTask: DecryptedTask = {
    id: taskId,
    title: input.title,
    description: input.description || '',
    urgent: input.urgent,
    important: input.important,
    quadrant,
    completed: false,
    ...(input.dueDate && { dueDate: input.dueDate }), // Only include if set
    tags: input.tags || [],
    subtasks: subtasksWithIds,
    recurrence: input.recurrence || 'none',
    dependencies: input.dependencies || [],
    createdAt: now,
    updatedAt: now,
    vectorClock: {}, // Initialize with empty vector clock
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

  // Merge updates (handle optional fields carefully)
  const updatedTask: DecryptedTask = {
    ...currentTask,
    title: input.title ?? currentTask.title,
    description: input.description ?? currentTask.description,
    urgent: input.urgent ?? currentTask.urgent,
    important: input.important ?? currentTask.important,
    tags: input.tags ?? currentTask.tags,
    subtasks: input.subtasks ?? currentTask.subtasks,
    recurrence: input.recurrence ?? currentTask.recurrence,
    dependencies: input.dependencies ?? currentTask.dependencies,
    completed: input.completed ?? currentTask.completed,
    updatedAt: new Date().toISOString(),
  };

  // Handle dueDate separately (can be set or cleared)
  if (input.dueDate !== undefined) {
    if (input.dueDate) {
      updatedTask.dueDate = input.dueDate;
    } else {
      delete updatedTask.dueDate; // Remove field if clearing
    }
  }

  // Set completedAt when marking complete
  if (input.completed === true && !currentTask.completed) {
    updatedTask.completedAt = new Date().toISOString();
  } else if (input.completed === false) {
    delete updatedTask.completedAt; // Clear when uncompleting
  }

  // Recalculate quadrant if urgent/important changed
  if (input.urgent !== undefined || input.important !== undefined) {
    updatedTask.quadrant = deriveQuadrant(updatedTask.urgent, updatedTask.important);
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
