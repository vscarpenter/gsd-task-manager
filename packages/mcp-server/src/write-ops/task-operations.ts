/**
 * Individual task CRUD operations
 * Handles create, update, complete, and delete for single tasks
 */

import type { GsdConfig, DecryptedTask } from '../tools.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import { getCryptoManager } from '../crypto.js';
import { listTasks } from '../tools.js';
import { generateTaskId, deriveQuadrant, ensureEncryption, pushToSync } from './helpers.js';
import {
  validateDependencies,
  getAffectedByDeletion,
  formatDependencyError,
} from '../dependencies.js';

/**
 * Create task result with dry-run information
 */
export interface CreateTaskResult {
  task: DecryptedTask;
  dryRun: boolean;
  validation: { valid: boolean; warnings: string[] };
}

/**
 * Create a new task
 * Supports dry-run mode to preview without saving
 */
export async function createTask(
  config: GsdConfig,
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  await ensureEncryption(config);

  const warnings: string[] = [];
  const allTasks = input.dependencies?.length ? await listTasks(config) : [];

  // Validate dependencies if provided
  if (input.dependencies && input.dependencies.length > 0) {
    const validation = validateDependencies(null, input.dependencies, allTasks);
    if (!validation.valid) {
      throw new Error(formatDependencyError(validation.error!));
    }
  }

  // Add warnings for potential issues
  if (input.dueDate) {
    const dueDate = new Date(input.dueDate);
    if (dueDate < new Date()) {
      warnings.push('Due date is in the past');
    }
  }

  if (input.tags && input.tags.length > 10) {
    warnings.push('Task has more than 10 tags, consider simplifying');
  }

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

  // If dry-run, return without saving
  if (input.dryRun) {
    return {
      task: newTask,
      dryRun: true,
      validation: { valid: true, warnings },
    };
  }

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

  return {
    task: newTask,
    dryRun: false,
    validation: { valid: true, warnings },
  };
}

/**
 * Update task result with dry-run information
 */
export interface UpdateTaskResult {
  task: DecryptedTask;
  dryRun: boolean;
  changes: string[];
  validation: { valid: boolean; warnings: string[] };
}

/**
 * Update an existing task
 * Supports dry-run mode to preview changes without saving
 */
export async function updateTask(
  config: GsdConfig,
  input: UpdateTaskInput
): Promise<UpdateTaskResult> {
  await ensureEncryption(config);

  const warnings: string[] = [];
  const changes: string[] = [];

  // Fetch current task
  const tasks = await listTasks(config);
  const currentTask = tasks.find((t) => t.id === input.id);

  if (!currentTask) {
    throw new Error(`❌ Task not found: ${input.id}\n\nThe task may have been deleted.`);
  }

  // Validate dependencies if changing
  if (input.dependencies !== undefined) {
    const validation = validateDependencies(input.id, input.dependencies, tasks);
    if (!validation.valid) {
      throw new Error(formatDependencyError(validation.error!));
    }
  }

  // Track changes for dry-run output
  if (input.title !== undefined && input.title !== currentTask.title) {
    changes.push(`title: "${currentTask.title}" → "${input.title}"`);
  }
  if (input.description !== undefined && input.description !== currentTask.description) {
    changes.push(`description: updated`);
  }
  if (input.urgent !== undefined && input.urgent !== currentTask.urgent) {
    changes.push(`urgent: ${currentTask.urgent} → ${input.urgent}`);
  }
  if (input.important !== undefined && input.important !== currentTask.important) {
    changes.push(`important: ${currentTask.important} → ${input.important}`);
  }
  if (input.completed !== undefined && input.completed !== currentTask.completed) {
    changes.push(`completed: ${currentTask.completed} → ${input.completed}`);
  }
  if (input.dueDate !== undefined && input.dueDate !== currentTask.dueDate) {
    changes.push(`dueDate: ${currentTask.dueDate || 'none'} → ${input.dueDate || 'cleared'}`);
  }
  if (input.tags !== undefined) {
    changes.push(`tags: updated`);
  }
  if (input.dependencies !== undefined) {
    changes.push(`dependencies: updated`);
  }

  // Add warnings
  if (input.dueDate) {
    const dueDate = new Date(input.dueDate);
    if (dueDate < new Date()) {
      warnings.push('Due date is in the past');
    }
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
    if (updatedTask.quadrant !== currentTask.quadrant) {
      changes.push(`quadrant: ${currentTask.quadrant} → ${updatedTask.quadrant}`);
    }
  }

  // If dry-run, return without saving
  if (input.dryRun) {
    return {
      task: updatedTask,
      dryRun: true,
      changes,
      validation: { valid: true, warnings },
    };
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

  return {
    task: updatedTask,
    dryRun: false,
    changes,
    validation: { valid: true, warnings },
  };
}

/**
 * Toggle task completion status
 * Supports dry-run mode to preview changes without saving
 */
export async function completeTask(
  config: GsdConfig,
  taskId: string,
  completed: boolean,
  options?: { dryRun?: boolean }
): Promise<UpdateTaskResult> {
  return updateTask(config, {
    id: taskId,
    completed,
    dryRun: options?.dryRun,
  });
}

/**
 * Delete task result with dry-run information
 */
export interface DeleteTaskResult {
  taskId: string;
  taskTitle: string;
  dryRun: boolean;
  affectedTasks: string[];
}

/**
 * Delete a task
 * Returns information about affected tasks (those that depended on deleted task)
 * Supports dry-run mode to preview what would be deleted
 */
export async function deleteTask(
  config: GsdConfig,
  taskId: string,
  options?: { dryRun?: boolean }
): Promise<DeleteTaskResult> {
  await ensureEncryption(config);

  // Verify task exists
  const tasks = await listTasks(config);
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    throw new Error(`❌ Task not found: ${taskId}\n\nThe task may have already been deleted.`);
  }

  // Check for tasks that depend on this one
  const affectedTasks = getAffectedByDeletion(taskId, tasks);
  const affectedTitles = affectedTasks.map((t) => t.title);

  // If dry-run, return without deleting
  if (options?.dryRun) {
    return {
      taskId,
      taskTitle: task.title,
      dryRun: true,
      affectedTasks: affectedTitles,
    };
  }

  // Push deletion
  await pushToSync(config, [
    {
      type: 'delete',
      taskId,
      vectorClock: {}, // Simplified: let server manage
    },
  ]);

  return {
    taskId,
    taskTitle: task.title,
    dryRun: false,
    affectedTasks: affectedTitles,
  };
}
