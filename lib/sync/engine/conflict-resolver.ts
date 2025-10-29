/**
 * Conflict resolver - auto-resolves conflicts using last-write-wins strategy
 * Compares timestamps and applies the most recent version
 */

import { getDb } from '@/lib/db';
import { mergeVectorClocks } from '../vector-clock';
import { createLogger } from '@/lib/logger';
import type { ConflictInfo } from '../types';

const logger = createLogger('SYNC_CONFLICT');

/**
 * Auto-resolve conflicts using last-write-wins strategy
 * @param conflicts - Array of conflicts to resolve
 * @returns Number of conflicts successfully resolved
 */
export async function autoResolveConflicts(conflicts: ConflictInfo[]): Promise<number> {
  const db = getDb();
  let resolved = 0;

  for (const conflict of conflicts) {
    try {
      // Defensive check: ensure conflict has required task data
      if (!conflict.local || !conflict.remote) {
        logger.error('Cannot auto-resolve conflict: missing task data', undefined, {
          taskId: conflict.taskId,
          hasLocal: !!conflict.local,
          hasRemote: !!conflict.remote,
        });
        continue;
      }

      // Compare updatedAt timestamps
      const localTime = new Date(conflict.local.updatedAt).getTime();
      const remoteTime = new Date(conflict.remote.updatedAt).getTime();

      const winner = remoteTime > localTime ? conflict.remote : conflict.local;

      logger.debug('Resolving conflict', {
        taskId: conflict.taskId,
        localTime: new Date(localTime).toISOString(),
        remoteTime: new Date(remoteTime).toISOString(),
        winner: winner === conflict.remote ? 'remote' : 'local',
      });

      await db.tasks.put({
        ...winner,
        vectorClock: mergeVectorClocks(conflict.localClock, conflict.remoteClock),
      });

      resolved++;
    } catch (error) {
      const resolveError = error instanceof Error ? error : new Error('Conflict resolution failed');
      logger.error('Failed to resolve conflict', resolveError, { taskId: conflict.taskId });
    }
  }

  return resolved;
}
