import { createLogger } from '@/lib/logger';

const logger = createLogger('SYNC_STATUS');

/** The sync-status reads that run on a timer. */
export type SyncStatusPoll = 'enabled' | 'coordinator' | 'pendingCount';

/**
 * Wrap a status poll so a failed read is logged and dropped. The caller keeps
 * the value it last published. Left unhandled, the rejection reaches the
 * window and the global listener shows the generic error toast for a read
 * the next tick will simply retry.
 */
export function guardPoll(poll: SyncStatusPoll, run: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await run();
    } catch (error) {
      logger.warn('Sync status poll failed', {
        poll,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
