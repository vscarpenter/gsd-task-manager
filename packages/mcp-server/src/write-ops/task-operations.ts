/**
 * Individual task CRUD operations
 * Handles create, update, complete, and delete for single tasks
 */

import type { GsdConfig, Task } from '../types.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import { listTasks } from '../tools/list-tasks.js';
import {
  generateTaskId,
  deriveQuadrant,
  createTaskInPB,
  updateTaskInPB,
  deleteTaskInPB,
  getAuthInfo,
} from './helpers.js';
import {
  validateDependencies,
  getAffectedByDeletion,
  formatDependencyError,
} from '../dependencies.js';

/**
 * Create task result with dry-run information
 */
export interface CreateTaskResult {
  task: Task;
  dryRun: boolean;
  validation: { valid: boolean; warnings: string[] };
}

/**
 * Create a new task
 */
export async function createTask(
  config: GsdConfig,
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  const warnings: string[] = [];
  const allTasks = input.dependencies?.length ? await listTasks(config) : [];

  // Validate dependencies if provided
  if (input.dependencies && input.dependencies.length > 0) {
    const validation = validateDependencies(null, input.dependencies, allTasks);
    if (!validation.valid) {
      throw new Error(formatDependencyError(validation.error!));
    }
  }

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

  const subtasksWithIds = input.subtasks
    ? input.subtasks.map((st) => ({
        id: generateTaskId(),
        title: st.title,
        completed: st.completed,
      }))
    : [];

  const newTask: Task = {
    id: taskId,
    title: input.title,
    description: input.description || '',
    urgent: input.urgent,
    important: input.important,
    quadrant,
    completed: false,
    ...(input.dueDate && { dueDate: input.dueDate }),
    tags: input.tags || [],
    subtasks: subtasksWithIds,
    recurrence: input.recurrence || 'none',
    dependencies: input.dependencies || [],
    createdAt: now,
    updatedAt: now,
  };

  if (input.dryRun) {
    return {
      task: newTask,
      dryRun: true,
      validation: { valid: true, warnings },
    };
  }

  const { ownerId, deviceId } = await getAuthInfo(config);
  await createTaskInPB(config, newTask, ownerId, deviceId);

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
  task: Task;
  dryRun: boolean;
  changes: string[];
  validation: { valid: boolean; warnings: string[] };
}

/**
 * Update an existing task
 */
export async function updateTask(
  config: GsdConfig,
  input: UpdateTaskInput
): Promise<UpdateTaskResult> {
  const warnings: string[] = [];
  const changes: string[] = [];

  const tasks = await listTasks(config);
  const currentTask = tasks.find((t) => t.id === input.id);

  if (!currentTask) {
    throw new Error(`Task not found: ${input.id}\n\nThe task may have been deleted.`);
  }

  // Validate dependencies if changing
  if (input.dependencies !== undefined) {
    const validation = validateDependencies(input.id, input.dependencies, tasks);
    if (!validation.valid) {
      throw new Error(formatDependencyError(validation.error!));
    }
  }

  // Track changes
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
  if (input.tags !== undefined) changes.push(`tags: updated`);
  if (input.dependencies !== undefined) changes.push(`dependencies: updated`);

  if (input.dueDate) {
    const dueDate = new Date(input.dueDate);
    if (dueDate < new Date()) {
      warnings.push('Due date is in the past');
    }
  }

  const updatedTask: Task = {
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

  if (input.dueDate !== undefined) {
    if (input.dueDate) {
      updatedTask.dueDate = input.dueDate;
    } else {
      delete updatedTask.dueDate;
    }
  }

  if (input.completed === true && !currentTask.completed) {
    updatedTask.completedAt = new Date().toISOString();
  } else if (input.completed === false) {
    delete updatedTask.completedAt;
  }

  if (input.urgent !== undefined || input.important !== undefined) {
    updatedTask.quadrant = deriveQuadrant(updatedTask.urgent, updatedTask.important);
    if (updatedTask.quadrant !== currentTask.quadrant) {
      changes.push(`quadrant: ${currentTask.quadrant} → ${updatedTask.quadrant}`);
    }
  }

  if (input.dryRun) {
    return {
      task: updatedTask,
      dryRun: true,
      changes,
      validation: { valid: true, warnings },
    };
  }

  const { ownerId, deviceId } = await getAuthInfo(config);
  await updateTaskInPB(config, updatedTask, ownerId, deviceId);

  return {
    task: updatedTask,
    dryRun: false,
    changes,
    validation: { valid: true, warnings },
  };
}

/**
 * Toggle task completion status
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
 */
export async function deleteTask(
  config: GsdConfig,
  taskId: string,
  options?: { dryRun?: boolean }
): Promise<DeleteTaskResult> {
  const tasks = await listTasks(config);
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}\n\nThe task may have already been deleted.`);
  }

  const affectedTasks = getAffectedByDeletion(taskId, tasks);
  const affectedTitles = affectedTasks.map((t) => t.title);

  if (options?.dryRun) {
    return {
      taskId,
      taskTitle: task.title,
      dryRun: true,
      affectedTasks: affectedTitles,
    };
  }

  await deleteTaskInPB(config, taskId);

  return {
    taskId,
    taskTitle: task.title,
    dryRun: false,
    affectedTasks: affectedTitles,
  };
}
