/**
 * Individual task CRUD operations
 * Handles create, update, complete, and delete for single tasks
 */

import type { GsdConfig, Task } from '../types.js';
import { pbTaskToTask } from '../types.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import { listTasks } from '../tools/list-tasks.js';
import {
  generateTaskId,
  deriveQuadrant,
  createTaskInPB,
  updateTaskInPB,
  updateTaskInPBById,
  deleteTaskInPB,
  fetchSinglePBTaskFresh,
  getAuthInfo,
} from './helpers.js';
import {
  validateDependencies,
  getAffectedByDeletion,
  formatDependencyError,
} from '../dependencies.js';
import { extractUrlsFromTitle, buildDescription } from '../text/capture-parser.js';
import { ConflictError } from '../errors.js';
import { getTaskCache } from '../cache.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('TASK_OPS');

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

  // Mirror the webapp capture flow: pull http(s) URLs out of the title and
  // append them to the description. See lib/capture-parser.ts (canonical) and
  // packages/mcp-server/src/text/capture-parser.ts (vendored mirror).
  const { cleanTitle, urls } = extractUrlsFromTitle(input.title);
  const mergedDescription = buildDescription(input.description ?? '', urls);

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
    title: cleanTitle,
    description: mergedDescription,
    urgent: input.urgent,
    important: input.important,
    quadrant,
    completed: false,
    ...(input.dueDate && { dueDate: input.dueDate }),
    tags: input.tags || [],
    subtasks: subtasksWithIds,
    recurrence: input.recurrence || 'none',
    dependencies: input.dependencies || [],
    ...(input.notifyBefore !== undefined && { notifyBefore: input.notifyBefore }),
    ...(input.notificationEnabled !== undefined && {
      notificationEnabled: input.notificationEnabled,
    }),
    ...(input.estimatedMinutes !== undefined && { estimatedMinutes: input.estimatedMinutes }),
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
 *
 * LWW conflict detection (Codex finding #2): the current task snapshot is read
 * directly from PocketBase (cache bypassed) so we never spread a stale value
 * back over a concurrent writer's change. Immediately before the PUT we
 * re-read the same record and compare `client_updated_at` against the value
 * captured at first read — on mismatch we throw `ConflictError`.
 */
export async function updateTask(
  config: GsdConfig,
  input: UpdateTaskInput
): Promise<UpdateTaskResult> {
  const warnings: string[] = [];
  const changes: string[] = [];

  const fresh = await fetchSinglePBTaskFresh(config, input.id);
  if (!fresh) {
    throw new Error(`Task not found: ${input.id}\n\nThe task may have been deleted.`);
  }
  const currentTask = pbTaskToTask(fresh.record);
  const readClientUpdatedAt = fresh.clientUpdatedAt;

  // Validate dependencies if changing. Cache is acceptable here: cycle-checking
  // is a non-mutating read and the cache invalidates on writes, so a slightly
  // stale dependency graph is safe.
  if (input.dependencies !== undefined) {
    const allTasks = await listTasks(config);
    const validation = validateDependencies(input.id, input.dependencies, allTasks);
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
    notifyBefore: input.notifyBefore ?? currentTask.notifyBefore,
    notificationEnabled: input.notificationEnabled ?? currentTask.notificationEnabled,
    estimatedMinutes: input.estimatedMinutes ?? currentTask.estimatedMinutes,
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

  // Preflight LWW check: re-read the record and confirm `client_updated_at`
  // hasn't moved between the initial read and now. If it has, a concurrent
  // writer changed the task — abort with ConflictError rather than overwriting
  // their change.
  const preflight = await fetchSinglePBTaskFresh(config, input.id);
  if (!preflight) {
    throw new Error(`Task ${input.id} was deleted between read and write.`);
  }
  if (preflight.clientUpdatedAt !== readClientUpdatedAt) {
    throw new ConflictError(input.id, readClientUpdatedAt, preflight.clientUpdatedAt);
  }

  const { ownerId, deviceId } = await getAuthInfo(config);
  await updateTaskInPBById(config, preflight.pbRecordId, updatedTask, ownerId, deviceId);
  // updateTaskInPBById skips the cache invalidation done in updateTaskInPB, so
  // invalidate here explicitly (matches the contract callers expect).
  getTaskCache().invalidate();

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
  dependenciesCleaned: number;
}

/**
 * Delete a task and strip its id from any other task's dependencies array.
 *
 * Without this cleanup, deleting a blocker leaves dangling references in the
 * tasks that depended on it — mirrors the behaviour of the webapp's
 * removeDependencyReferences(). Cleanup failures are logged as warnings but do
 * not roll back the primary delete (the task is gone either way).
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
  const isDryRun = options?.dryRun !== false;

  if (isDryRun) {
    return {
      taskId,
      taskTitle: task.title,
      dryRun: true,
      affectedTasks: affectedTitles,
      dependenciesCleaned: affectedTasks.length,
    };
  }

  await deleteTaskInPB(config, taskId);

  let dependenciesCleaned = 0;
  if (affectedTasks.length > 0) {
    const { ownerId, deviceId } = await getAuthInfo(config);
    const now = new Date().toISOString();
    for (const affected of affectedTasks) {
      try {
        const cleaned: Task = {
          ...affected,
          dependencies: affected.dependencies.filter((dep) => dep !== taskId),
          updatedAt: now,
        };
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- intentionally sequential/throttled (rate-limit); parallelizing risks 429s
        await updateTaskInPB(config, cleaned, ownerId, deviceId);
        dependenciesCleaned++;
      } catch (error) {
        // Log but don't throw — the primary delete already succeeded.
        // PB 4xx messages can echo field values (task titles), so log only
        // content-free context: the affected task id and the HTTP status.
        const status = (error as { status?: unknown }).status;
        logger.warn('Failed to clean dependency reference after delete', {
          taskId: affected.id,
          ...(typeof status === 'number' ? { status } : {}),
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
    }
  }

  return {
    taskId,
    taskTitle: task.title,
    dryRun: false,
    affectedTasks: affectedTitles,
    dependenciesCleaned,
  };
}
