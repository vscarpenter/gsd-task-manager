/**
 * Individual task CRUD operations
 * Handles create, update, complete, and delete for single tasks
 */

import type { GsdConfig, Task } from '../types.js';
import { pbTaskToTask } from '../types.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import { listTasks, listTasksFresh } from '../tools/list-tasks.js';
import {
  generateTaskId,
  deriveQuadrant,
  createTaskInPB,
  updateTaskInPBById,
  updateTaskDependenciesInPBById,
  deleteTaskInPBById,
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
import { sanitizePocketBaseWriteError, WriteRateLimiter } from './write-rate-limiter.js';

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

async function validateUpdateDependencies(
  config: GsdConfig,
  input: UpdateTaskInput
): Promise<void> {
  if (input.dependencies === undefined) return;
  const allTasks = await listTasks(config);
  const validation = validateDependencies(input.id, input.dependencies, allTasks);
  if (!validation.valid) {
    throw new Error(formatDependencyError(validation.error!));
  }
}

function describeTaskChanges(current: Task, input: UpdateTaskInput): string[] {
  const changes: string[] = [];
  const comparisons: Array<[unknown, unknown, string]> = [
    [input.title, current.title, `title: "${current.title}" → "${input.title}"`],
    [input.description, current.description, 'description: updated'],
    [input.urgent, current.urgent, `urgent: ${current.urgent} → ${input.urgent}`],
    [input.important, current.important, `important: ${current.important} → ${input.important}`],
    [input.completed, current.completed, `completed: ${current.completed} → ${input.completed}`],
    [
      input.dueDate,
      current.dueDate,
      `dueDate: ${current.dueDate || 'none'} → ${input.dueDate || 'cleared'}`,
    ],
  ];
  for (const [next, previous, description] of comparisons) {
    if (next !== undefined && next !== previous) changes.push(description);
  }
  if (input.tags !== undefined) changes.push('tags: updated');
  if (input.dependencies !== undefined) changes.push('dependencies: updated');
  return changes;
}

function applyDueDateUpdate(task: Task, dueDate: string | null | undefined): void {
  if (dueDate === undefined) return;
  if (dueDate) task.dueDate = dueDate;
  else delete task.dueDate;
}

function applyCompletionUpdate(task: Task, input: UpdateTaskInput, current: Task): void {
  if (input.completed === true && !current.completed) {
    task.completedAt = new Date().toISOString();
  } else if (input.completed === false) {
    delete task.completedAt;
  }
}

function applyQuadrantUpdate(task: Task, input: UpdateTaskInput, current: Task, changes: string[]): void {
  if (input.urgent === undefined && input.important === undefined) return;
  task.quadrant = deriveQuadrant(task.urgent, task.important);
  if (task.quadrant !== current.quadrant) {
    changes.push(`quadrant: ${current.quadrant} → ${task.quadrant}`);
  }
}

function buildUpdatedTask(current: Task, input: UpdateTaskInput, changes: string[]): Task {
  const updated: Task = {
    ...current,
    updatedAt: new Date().toISOString(),
  };
  const assignableFields = [
    'title', 'description', 'urgent', 'important', 'tags', 'subtasks',
    'recurrence', 'dependencies', 'completed', 'notifyBefore',
    'notificationEnabled', 'estimatedMinutes',
  ] as const;
  for (const field of assignableFields) {
    const value = input[field];
    if (value !== undefined) Object.assign(updated, { [field]: value });
  }
  applyDueDateUpdate(updated, input.dueDate);
  applyCompletionUpdate(updated, input, current);
  applyQuadrantUpdate(updated, input, current, changes);
  return updated;
}

function updateWarnings(input: UpdateTaskInput): string[] {
  if (input.dueDate && new Date(input.dueDate) < new Date()) {
    return ['Due date is in the past'];
  }
  return [];
}

async function assertFreshUpdatePreflight(
  config: GsdConfig,
  input: UpdateTaskInput,
  readClientUpdatedAt: string
) {
  const preflight = await fetchSinglePBTaskFresh(config, input.id);
  if (!preflight) {
    throw new Error(`Task ${input.id} was deleted between read and write.`);
  }
  if (preflight.clientUpdatedAt !== readClientUpdatedAt) {
    throw new ConflictError(input.id, readClientUpdatedAt, preflight.clientUpdatedAt);
  }
  return preflight;
}

async function loadTaskForUpdate(config: GsdConfig, taskId: string) {
  const fresh = await fetchSinglePBTaskFresh(config, taskId);
  if (!fresh) {
    throw new Error(`Task not found: ${taskId}\n\nThe task may have been deleted.`);
  }
  return fresh;
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
  const fresh = await loadTaskForUpdate(config, input.id);
  const currentTask = pbTaskToTask(fresh.record);
  await validateUpdateDependencies(config, input);
  const changes = describeTaskChanges(currentTask, input);
  const warnings = updateWarnings(input);
  const updatedTask = buildUpdatedTask(currentTask, input, changes);

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
  const { ownerId, deviceId } = await getAuthInfo(config);
  const preflight = await assertFreshUpdatePreflight(config, input, fresh.clientUpdatedAt);
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
  partial: boolean;
  errors: string[];
  conflicts: string[];
}

interface DependencySnapshot {
  taskId: string;
  clientUpdatedAt: string;
}

type CleanupOutcome =
  | { kind: 'cleaned'; taskId: string }
  | { kind: 'conflict'; taskId: string }
  | { kind: 'error'; taskId: string; code: string; status?: number };

async function loadDependencySnapshot(
  config: GsdConfig,
  taskId: string
): Promise<DependencySnapshot | CleanupOutcome> {
  try {
    const fresh = await fetchSinglePBTaskFresh(config, taskId);
    if (!fresh) return { kind: 'error', taskId, code: 'not_found' };
    return { taskId, clientUpdatedAt: fresh.clientUpdatedAt };
  } catch (error) {
    const safe = sanitizePocketBaseWriteError(error);
    return { kind: 'error', taskId, code: safe.code, ...(safe.status ? { status: safe.status } : {}) };
  }
}

async function cleanDependencySnapshot(
  config: GsdConfig,
  taskId: string,
  snapshot: DependencySnapshot,
  deviceId: string,
  limiter: WriteRateLimiter
): Promise<CleanupOutcome> {
  try {
    return await limiter.run(async () => {
      const fresh = await fetchSinglePBTaskFresh(config, snapshot.taskId);
      if (!fresh) return { kind: 'error', taskId: snapshot.taskId, code: 'not_found' };
      if (fresh.clientUpdatedAt !== snapshot.clientUpdatedAt) {
        return { kind: 'conflict', taskId: snapshot.taskId };
      }
      const current = pbTaskToTask(fresh.record);
      const dependencies = current.dependencies.filter((id) => id !== taskId);
      if (dependencies.length !== current.dependencies.length) {
        await updateTaskDependenciesInPBById(
          config, fresh.pbRecordId, dependencies, new Date().toISOString(), deviceId
        );
      }
      return { kind: 'cleaned', taskId: snapshot.taskId };
    });
  } catch (error) {
    const safe = sanitizePocketBaseWriteError(error);
    return { kind: 'error', taskId: snapshot.taskId, code: safe.code, ...(safe.status ? { status: safe.status } : {}) };
  }
}

function summarizeCleanup(outcomes: CleanupOutcome[]) {
  const errors = outcomes
    .filter((outcome): outcome is Extract<CleanupOutcome, { kind: 'error' }> => outcome.kind === 'error')
    .map((outcome) => `Task ${outcome.taskId}: ${outcome.code}`);
  const conflicts = outcomes
    .filter((outcome) => outcome.kind === 'conflict')
    .map((outcome) => outcome.taskId);
  const dependenciesCleaned = outcomes.filter((outcome) => outcome.kind === 'cleaned').length;
  return { errors, conflicts, dependenciesCleaned };
}

async function deletePrimaryTask(
  config: GsdConfig,
  task: Task,
  limiter: WriteRateLimiter
): Promise<void> {
  await limiter.run(async () => {
    const fresh = await fetchSinglePBTaskFresh(config, task.id);
    if (!fresh) throw new Error(`Task not found: ${task.id}`);
    if (fresh.clientUpdatedAt !== task.updatedAt) {
      throw new ConflictError(task.id, task.updatedAt, fresh.clientUpdatedAt);
    }
    await deleteTaskInPBById(config, fresh.pbRecordId);
  });
  getTaskCache().invalidate();
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
  const tasks = await listTasksFresh(config);
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
      partial: false,
      errors: [],
      conflicts: [],
    };
  }

  const limiter = new WriteRateLimiter();
  if (affectedTasks.length === 0) {
    await deletePrimaryTask(config, task, limiter);
    return { taskId, taskTitle: task.title, dryRun: false, affectedTasks: [],
      dependenciesCleaned: 0, partial: false, errors: [], conflicts: [] };
  }

  const { deviceId } = await getAuthInfo(config);
  const snapshots = await Promise.all(
    affectedTasks.map((affected) => loadDependencySnapshot(config, affected.id))
  );
  await deletePrimaryTask(config, task, limiter);
  const outcomes = await Promise.all(snapshots.map((snapshot) =>
    'kind' in snapshot
      ? snapshot
      : cleanDependencySnapshot(config, taskId, snapshot, deviceId, limiter)
  ));
  const summary = summarizeCleanup(outcomes);
  for (const outcome of outcomes) {
    if (outcome.kind === 'error') {
      logger.warn('Failed to clean dependency reference after delete', {
        taskId: outcome.taskId,
        ...(outcome.status ? { status: outcome.status } : {}),
        errorCode: outcome.code,
      });
    }
  }

  return {
    taskId,
    taskTitle: task.title,
    dryRun: false,
    affectedTasks: affectedTitles,
    dependenciesCleaned: summary.dependenciesCleaned,
    partial: summary.errors.length > 0 || summary.conflicts.length > 0,
    errors: summary.errors,
    conflicts: summary.conflicts,
  };
}
