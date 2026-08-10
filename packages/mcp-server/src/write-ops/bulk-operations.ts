/**
 * Bulk update operations for multiple tasks.
 *
 * Performance: pre-fetches PocketBase record ids for the whole batch in a
 * single request (avoids N+1 lookups), applies independent records with
 * bounded concurrency, and invalidates the task cache once at the end.
 */

import type { GsdConfig, Task } from '../types.js';
import { pbTaskToTask } from '../types.js';
import type { BulkOperation } from './types.js';
import { listTasks } from '../tools/list-tasks.js';
import { getTaskCache } from '../cache.js';
import { createMcpLogger } from '../utils/logger.js';
import {
  deriveQuadrant,
  getAuthInfo,
  fetchPBSnapshotForTasks,
  fetchSinglePBTaskFresh,
  updateTaskInPBById,
  deleteTaskInPBById,
} from './helpers.js';
import { sanitizePocketBaseWriteError, WriteRateLimiter } from './write-rate-limiter.js';

const logger = createMcpLogger('BULK_WRITE');

function applyCompletion(task: Task, completed: boolean, now: string): Task {
  const updated: Task = { ...task, completed, updatedAt: now };
  if (completed && !task.completed) updated.completedAt = now;
  if (!completed) delete updated.completedAt;
  return updated;
}

function applyDueDate(task: Task, dueDate: string | null | undefined, now: string): Task {
  const updated: Task = { ...task, updatedAt: now };
  if (dueDate) updated.dueDate = dueDate;
  else delete updated.dueDate;
  return updated;
}

function applyOperation(task: Task, operation: BulkOperation, now: string): Task {
  switch (operation.type) {
    case 'complete':
      return applyCompletion(task, operation.completed, now);
    case 'move_quadrant':
      return {
        ...task,
        urgent: operation.urgent,
        important: operation.important,
        quadrant: deriveQuadrant(operation.urgent, operation.important),
        updatedAt: now,
      };
    case 'add_tags':
      return { ...task, tags: [...new Set([...task.tags, ...operation.tags])], updatedAt: now };
    case 'remove_tags': {
      const remove = new Set(operation.tags);
      return { ...task, tags: task.tags.filter((tag) => !remove.has(tag)), updatedAt: now };
    }
    case 'set_due_date':
      return applyDueDate(task, operation.dueDate, now);
    default:
      throw new Error(`Unknown operation type: ${(operation as { type: string }).type}`);
  }
}

/**
 * Server-side policy ceilings for bulk operations. Not caller-controllable
 * (see input-schemas.ts — `maxTasks` is intentionally absent from the input
 * schema so an over-eager LLM cannot raise the limit).
 */
const BULK_MAX_TASKS = 50;
const BULK_MAX_DELETES = 10;
export const BULK_WRITE_CONCURRENCY = 4;

export interface BulkUpdateResult {
  updated: number;
  deleted: number;
  errors: string[];
  /**
   * Task ids whose `client_updated_at` changed between the batch snapshot and
   * the per-item preflight check, so the write was skipped. Distinct from
   * `errors`: conflicts are an expected LWW outcome, not failures. Always
   * present (empty when nothing was skipped).
   */
  conflicts: string[];
  dryRun: boolean;
}

interface BulkTaskInput {
  task: Task;
  snapshotTimestamp: string;
}

type BulkTaskOutcome =
  | { kind: 'updated'; taskId: string }
  | { kind: 'deleted'; taskId: string }
  | { kind: 'conflict'; taskId: string }
  | { kind: 'error'; taskId: string; message: string; rateLimited: boolean };

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      // Each worker is sequential; the worker pool supplies bounded parallelism.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bounded worker queue
      results[index] = await operation(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function processBulkTask(
  config: GsdConfig,
  input: BulkTaskInput,
  operation: BulkOperation,
  ownerId: string,
  deviceId: string,
  writeLimiter: WriteRateLimiter
): Promise<BulkTaskOutcome> {
  const { task, snapshotTimestamp } = input;
  try {
    const updated = operation.type === 'delete'
      ? null
      : applyOperation(task, operation, new Date().toISOString());
    return await writeLimiter.run(async () => {
      const preflight = await fetchSinglePBTaskFresh(config, task.id);
      if (!preflight || preflight.clientUpdatedAt !== snapshotTimestamp) {
        return { kind: 'conflict', taskId: task.id };
      }
      if (operation.type === 'delete') {
        await deleteTaskInPBById(config, preflight.pbRecordId);
        return { kind: 'deleted', taskId: task.id };
      }
      await updateTaskInPBById(config, preflight.pbRecordId, updated!, ownerId, deviceId);
      return { kind: 'updated', taskId: task.id };
    });
  } catch (error) {
    const safe = sanitizePocketBaseWriteError(error);
    return {
      kind: 'error',
      taskId: task.id,
      message: safe.code,
      rateLimited: safe.rateLimited,
    };
  }
}

function summarizeOutcomes(outcomes: BulkTaskOutcome[]): Omit<BulkUpdateResult, 'dryRun'> & {
  rateLimitCount: number;
} {
  const summary = {
    updated: 0,
    deleted: 0,
    errors: [] as string[],
    conflicts: [] as string[],
    rateLimitCount: 0,
  };
  for (const outcome of outcomes) {
    if (outcome.kind === 'updated') summary.updated++;
    if (outcome.kind === 'deleted') summary.deleted++;
    if (outcome.kind === 'conflict') summary.conflicts.push(outcome.taskId);
    if (outcome.kind === 'error') {
      summary.errors.push(`Task ${outcome.taskId}: ${outcome.message}`);
      if (outcome.rateLimited) summary.rateLimitCount++;
    }
  }
  return summary;
}

function validateBulkRequest(taskIds: string[], operation: BulkOperation): void {
  if (taskIds.length > BULK_MAX_TASKS) {
    throw new Error(
      `Bulk operation limit exceeded\n\nRequested: ${taskIds.length} tasks\n` +
      `Maximum: ${BULK_MAX_TASKS} tasks\n\n` +
      `Please reduce the number of tasks or split into multiple operations.`
    );
  }
  if (operation.type !== 'delete' || taskIds.length <= BULK_MAX_DELETES) return;
  throw new Error(
    `Bulk delete limit exceeded\n\nRequested: ${taskIds.length} deletes\n` +
    `Maximum: ${BULK_MAX_DELETES} deletes per call\n\n` +
    `Delete operations are capped lower than other bulk operations to limit ` +
    `accidental data loss from an LLM-driven call. Split into multiple ` +
    `delete calls of ${BULK_MAX_DELETES} or fewer task ids each.`
  );
}

function emptyBulkResult(dryRun: boolean, error?: string): BulkUpdateResult {
  return {
    updated: 0,
    deleted: 0,
    errors: error ? [error] : [],
    conflicts: [],
    dryRun,
  };
}

async function previewBulkUpdate(
  config: GsdConfig,
  taskIds: string[],
  operation: BulkOperation
): Promise<BulkUpdateResult> {
  const allTasks = await listTasks(config);
  const tasks = allTasks.filter((task) => taskIds.includes(task.id));
  if (tasks.length === 0) return emptyBulkResult(true, 'No matching tasks found');
  const deleting = operation.type === 'delete';
  return {
    updated: deleting ? 0 : tasks.length,
    deleted: deleting ? tasks.length : 0,
    errors: [],
    conflicts: [],
    dryRun: true,
  };
}

function collectBulkInputs(
  taskIds: string[],
  snapshot: Awaited<ReturnType<typeof fetchPBSnapshotForTasks>>
): BulkTaskInput[] {
  const inputs: BulkTaskInput[] = [];
  for (const id of taskIds) {
    const entry = snapshot.get(id);
    if (!entry) continue;
    inputs.push({
      task: pbTaskToTask(entry.record),
      snapshotTimestamp: entry.clientUpdatedAt,
    });
  }
  return inputs;
}

function appendMissingTaskErrors(
  taskIds: string[],
  snapshot: Awaited<ReturnType<typeof fetchPBSnapshotForTasks>>,
  errors: string[]
): void {
  for (const id of taskIds) {
    if (!snapshot.has(id)) errors.push(`Task ${id}: not found in PocketBase`);
  }
}

async function executeBulkWrite(
  config: GsdConfig,
  taskIds: string[],
  operation: BulkOperation
): Promise<BulkUpdateResult> {
  const [{ ownerId, deviceId }, snapshot] = await Promise.all([
    getAuthInfo(config),
    fetchPBSnapshotForTasks(config, taskIds),
  ]);
  if (snapshot.size === 0) return emptyBulkResult(false, 'No matching tasks found');
  const inputs = collectBulkInputs(taskIds, snapshot);
  const startedAt = Date.now();
  const writeLimiter = new WriteRateLimiter();
  const outcomes = await mapWithConcurrency(inputs, BULK_WRITE_CONCURRENCY, (input) =>
    processBulkTask(config, input, operation, ownerId, deviceId, writeLimiter)
  );
  const summary = summarizeOutcomes(outcomes);
  summary.rateLimitCount += writeLimiter.getRateLimitCount();
  appendMissingTaskErrors(taskIds, snapshot, summary.errors);
  getTaskCache().invalidate();
  logger.info('Bulk write completed', {
    requestedCount: taskIds.length,
    processedCount: inputs.length,
    concurrency: BULK_WRITE_CONCURRENCY,
    durationMs: Date.now() - startedAt,
    errorCount: summary.errors.length,
    conflictCount: summary.conflicts.length,
    rateLimitCount: summary.rateLimitCount,
  });
  return {
    updated: summary.updated,
    deleted: summary.deleted,
    errors: summary.errors,
    conflicts: summary.conflicts,
    dryRun: false,
  };
}

export async function bulkUpdateTasks(
  config: GsdConfig,
  taskIds: string[],
  operation: BulkOperation,
  options?: { dryRun?: boolean }
): Promise<BulkUpdateResult> {
  // Destructive deletes default to dryRun=true. Callers must pass
  // `dryRun: false` explicitly to actually delete.
  const isDryRun =
    operation.type === 'delete' ? options?.dryRun !== false : options?.dryRun ?? false;

  validateBulkRequest(taskIds, operation);
  if (taskIds.length === 0) return emptyBulkResult(isDryRun);
  if (isDryRun) return previewBulkUpdate(config, taskIds, operation);
  return executeBulkWrite(config, taskIds, operation);
}
