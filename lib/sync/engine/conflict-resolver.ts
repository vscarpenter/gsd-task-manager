/**
 * Conflict resolver - auto-resolves conflicts using timestamp-based LWW strategy
 * Compares updatedAt timestamps and writes the winner to IndexedDB.
 * Remote wins on tie to maintain consistency across devices.
 */

import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { ConflictInfo } from '../types';

const logger = createLogger('SYNC_CONFLICT');

/**
 * Auto-resolve conflicts using last-write-wins (LWW) strategy.
 * Compares localUpdatedAt vs remoteUpdatedAt from each ConflictInfo.
 * Remote wins on tie to ensure deterministic resolution across devices.
 *
 * @param conflicts - Array of conflicts to resolve
 * @returns Number of conflicts successfully resolved
 */
export async function autoResolveConflicts(conflicts: ConflictInfo[]): Promise<number> {
  const db = getDb();
  let resolved = 0;

  for (const conflict of conflicts) {
    try {
      if (!conflict.local || !conflict.remote) {
        logger.error('Cannot auto-resolve conflict: missing task data', undefined, {
          taskId: conflict.taskId,
          hasLocal: !!conflict.local,
          hasRemote: !!conflict.remote,
        });
        continue;
      }

      // Remote wins on tie (>= comparison) for deterministic resolution
      const winner = conflict.remoteUpdatedAt >= conflict.localUpdatedAt
        ? conflict.remote
        : conflict.local;

      const winnerLabel = winner === conflict.remote ? 'remote' : 'local';

      logger.debug('Resolving conflict', {
        taskId: conflict.taskId,
        localTime: new Date(conflict.localUpdatedAt).toISOString(),
        remoteTime: new Date(conflict.remoteUpdatedAt).toISOString(),
        winner: winnerLabel,
      });

      await db.tasks.put(winner);
      resolved++;
    } catch (error) {
      const resolveError = error instanceof Error ? error : new Error('Conflict resolution failed');
      logger.error('Failed to resolve conflict', resolveError, {
        taskId: conflict.taskId,
      });
    }
  }

  return resolved;
}
