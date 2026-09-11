/**
 * Strips deleted task ids from the dependencies of the tasks that pointed at
 * them. delete_task and bulk_update_tasks both call it, so neither delete path
 * leaves dangling references. It mirrors the web client's
 * removeDependencyReferencesInTransaction (lib/tasks/dependencies).
 */

import type { GsdConfig, Task } from '../types.js';
import { pbTaskToTask } from '../types.js';
import { fetchSinglePBTaskFresh, updateTaskDependenciesInPBById } from './helpers.js';
import { createMcpLogger } from '../utils/logger.js';
import { sanitizePocketBaseWriteError, type WriteRateLimiter } from './write-rate-limiter.js';

const logger = createMcpLogger('DEPENDENCY_CLEANUP');

interface DependencySnapshot {
  taskId: string;
  clientUpdatedAt: string;
}

export type CleanupOutcome =
  | { kind: 'cleaned'; taskId: string }
  | { kind: 'conflict'; taskId: string }
  | { kind: 'error'; taskId: string; code: string; status?: number };

/** A dependent's captured version, or the outcome of a read that already failed. */
export type PendingCleanup = DependencySnapshot | CleanupOutcome;

async function loadDependencySnapshot(
  config: GsdConfig,
  taskId: string
): Promise<PendingCleanup> {
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
  deletedIds: ReadonlySet<string>,
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
      const dependencies = current.dependencies.filter((id) => !deletedIds.has(id));
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

/** Capture each dependent's version, so cleanup can skip a task edited since. */
export function snapshotDependents(
  config: GsdConfig,
  dependents: Task[]
): Promise<PendingCleanup[]> {
  return Promise.all(dependents.map((dependent) => loadDependencySnapshot(config, dependent.id)));
}

/**
 * Remove the deleted ids from each captured dependent, one write at a time
 * through the limiter. Failures come back as outcomes, and the log records
 * only ids and status codes, never task content.
 */
export async function cleanDependents(
  config: GsdConfig,
  deletedIds: ReadonlySet<string>,
  pending: PendingCleanup[],
  deviceId: string,
  limiter: WriteRateLimiter
): Promise<CleanupOutcome[]> {
  const outcomes = await Promise.all(pending.map((entry) =>
    'kind' in entry
      ? entry
      : cleanDependencySnapshot(config, deletedIds, entry, deviceId, limiter)
  ));
  for (const outcome of outcomes) {
    if (outcome.kind === 'error') {
      logger.warn('Failed to clean dependency reference after delete', {
        taskId: outcome.taskId,
        ...(outcome.status ? { status: outcome.status } : {}),
        errorCode: outcome.code,
      });
    }
  }
  return outcomes;
}
