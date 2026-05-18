/**
 * Bulk update operations for multiple tasks.
 *
 * Performance: pre-fetches PocketBase record ids for the whole batch in a
 * single request (avoids N+1 lookups), throttles writes to stay under PB's
 * rate limit, and invalidates the task cache once at the end instead of once
 * per record.
 */

import type { GsdConfig, Task } from '../types.js';
import { pbTaskToTask } from '../types.js';
import type { BulkOperation } from './types.js';
import { listTasks } from '../tools/list-tasks.js';
import { getTaskCache } from '../cache.js';
import {
  deriveQuadrant,
  getAuthInfo,
  fetchPBSnapshotForTasks,
  fetchSinglePBTaskFresh,
  updateTaskInPBById,
  deleteTaskInPBById,
  sleep,
  PB_BULK_WRITE_DELAY_MS,
} from './helpers.js';

function applyOperation(task: Task, operation: BulkOperation, now: string): Task {
  if (operation.type === 'complete') {
    const updated: Task = { ...task, completed: operation.completed, updatedAt: now };
    if (operation.completed && !task.completed) {
      updated.completedAt = now;
    } else if (!operation.completed) {
      delete updated.completedAt;
    }
    return updated;
  }

  if (operation.type === 'move_quadrant') {
    return {
      ...task,
      urgent: operation.urgent,
      important: operation.important,
      quadrant: deriveQuadrant(operation.urgent, operation.important),
      updatedAt: now,
    };
  }

  if (operation.type === 'add_tags') {
    return {
      ...task,
      tags: [...new Set([...task.tags, ...operation.tags])],
      updatedAt: now,
    };
  }

  if (operation.type === 'remove_tags') {
    const remove = new Set(operation.tags);
    return {
      ...task,
      tags: task.tags.filter((tag) => !remove.has(tag)),
      updatedAt: now,
    };
  }

  if (operation.type === 'set_due_date') {
    const updated: Task = { ...task, updatedAt: now };
    if (operation.dueDate) {
      updated.dueDate = operation.dueDate;
    } else {
      delete updated.dueDate;
    }
    return updated;
  }

  throw new Error(`Unknown operation type: ${(operation as { type: string }).type}`);
}

/**
 * Server-side policy ceilings for bulk operations. Not caller-controllable
 * (see input-schemas.ts — `maxTasks` is intentionally absent from the input
 * schema so an over-eager LLM cannot raise the limit).
 */
const BULK_MAX_TASKS = 50;
const BULK_MAX_DELETES = 10;

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

  if (taskIds.length > BULK_MAX_TASKS) {
    throw new Error(
      `Bulk operation limit exceeded\n\n` +
        `Requested: ${taskIds.length} tasks\n` +
        `Maximum: ${BULK_MAX_TASKS} tasks\n\n` +
        `Please reduce the number of tasks or split into multiple operations.`
    );
  }

  if (operation.type === 'delete' && taskIds.length > BULK_MAX_DELETES) {
    throw new Error(
      `Bulk delete limit exceeded\n\n` +
        `Requested: ${taskIds.length} deletes\n` +
        `Maximum: ${BULK_MAX_DELETES} deletes per call\n\n` +
        `Delete operations are capped lower than other bulk operations to limit ` +
        `accidental data loss from an LLM-driven call. Split into multiple ` +
        `delete calls of ${BULK_MAX_DELETES} or fewer task ids each.`
    );
  }

  if (taskIds.length === 0) {
    return { updated: 0, deleted: 0, errors: [], conflicts: [], dryRun: isDryRun };
  }

  // Dry-run path: cached listTasks is fine — no PUTs will happen, so a stale
  // snapshot only affects the preview counts.
  if (isDryRun) {
    const allTasks = await listTasks(config);
    const tasksToUpdate = allTasks.filter((t) => taskIds.includes(t.id));
    if (tasksToUpdate.length === 0) {
      return {
        updated: 0,
        deleted: 0,
        errors: ['No matching tasks found'],
        conflicts: [],
        dryRun: true,
      };
    }
    const deletes = operation.type === 'delete' ? tasksToUpdate.length : 0;
    const updates = operation.type === 'delete' ? 0 : tasksToUpdate.length;
    return { updated: updates, deleted: deletes, errors: [], conflicts: [], dryRun: true };
  }

  // Write path: read fresh PB records (one request) so both content and the
  // snapshot timestamps come from PocketBase, never from the cache. Closes the
  // stale-spread hole from Codex finding #2.
  const [{ ownerId, deviceId }, snapshot] = await Promise.all([
    getAuthInfo(config),
    fetchPBSnapshotForTasks(config, taskIds),
  ]);

  if (snapshot.size === 0) {
    return {
      updated: 0,
      deleted: 0,
      errors: ['No matching tasks found'],
      conflicts: [],
      dryRun: false,
    };
  }

  // Iterate in the caller's requested order so the result is predictable.
  // Note: we only carry the snapshot timestamp forward — `pbRecordId` comes
  // from the preflight read below to avoid drifting from the freshest record.
  const tasksToProcess: Array<{ task: Task; snapshotTimestamp: string }> = [];
  for (const id of taskIds) {
    const entry = snapshot.get(id);
    if (entry) {
      tasksToProcess.push({
        task: pbTaskToTask(entry.record),
        snapshotTimestamp: entry.clientUpdatedAt,
      });
    }
  }

  const errors: string[] = [];
  const conflicts: string[] = [];
  let updateCount = 0;
  let deleteCount = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < tasksToProcess.length; i++) {
    const { task, snapshotTimestamp } = tasksToProcess[i];

    try {
      // Per-item preflight: re-read the record and compare client_updated_at
      // against the snapshot taken at the start of the batch. If the record
      // changed underneath us, surface the id in `conflicts` and skip the
      // write — bulk operations are continue-on-conflict, not abort-on-first.
      const preflight = await fetchSinglePBTaskFresh(config, task.id);
      if (!preflight) {
        conflicts.push(task.id);
        continue;
      }
      if (preflight.clientUpdatedAt !== snapshotTimestamp) {
        conflicts.push(task.id);
        continue;
      }

      if (operation.type === 'delete') {
        await deleteTaskInPBById(config, preflight.pbRecordId);
        deleteCount++;
      } else {
        const updated = applyOperation(task, operation, now);
        await updateTaskInPBById(config, preflight.pbRecordId, updated, ownerId, deviceId);
        updateCount++;
      }
    } catch (error) {
      errors.push(
        `Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Throttle between writes to avoid PocketBase 429s.
    if (i < tasksToProcess.length - 1) {
      await sleep(PB_BULK_WRITE_DELAY_MS);
    }
  }

  // Report tasks the caller asked for but PocketBase didn't return (deleted on
  // another device between the request and the snapshot fetch).
  for (const id of taskIds) {
    if (!snapshot.has(id)) {
      errors.push(`Task ${id}: not found in PocketBase`);
    }
  }

  // Single cache invalidation after the full batch rather than once per write.
  getTaskCache().invalidate();

  return {
    updated: updateCount,
    deleted: deleteCount,
    errors,
    conflicts,
    dryRun: false,
  };
}
