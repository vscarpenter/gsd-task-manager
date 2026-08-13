/**
 * Auto-archive hook
 *
 * Automatically archives old completed tasks based on settings.
 * Runs on mount and periodically checks every hour.
 */

import { useEffect } from 'react';
import { getArchiveSettings, archiveOldTasks } from './archive';
import { purgeExpiredTrash } from './trash';
import { createLogger } from './logger';
import { TIME_MS } from './constants';

const logger = createLogger('AUTO_ARCHIVE');

export function useAutoArchive() {
  useEffect(() => {
    const checkAndArchive = async () => {
      // Retention runs unconditionally, before the archive check. Trash is a
      // safety floor rather than a workflow preference, so it is not gated on
      // the archive toggle — a user with auto-archive off still needs deleted
      // tasks to stop accumulating (ADR 0015).
      try {
        const purged = await purgeExpiredTrash();
        if (purged > 0) logger.info('Purged expired trash', { count: purged });
      } catch (error) {
        logger.error('Trash purge failed', error instanceof Error ? error : undefined);
      }

      try {
        const settings = await getArchiveSettings();

        if (!settings.enabled) {
          return;
        }

        logger.info('Running auto-archive check', {
          archiveAfterDays: settings.archiveAfterDays
        });

        const count = await archiveOldTasks(settings.archiveAfterDays);

        if (count > 0) {
          logger.info('Auto-archived tasks', { count });
        }
      } catch (error) {
        logger.error('Auto-archive failed', error instanceof Error ? error : undefined);
      }
    };

    // Run on mount
    checkAndArchive();

    // Run every hour
    const interval = setInterval(checkAndArchive, TIME_MS.HOUR);

    return () => clearInterval(interval);
  }, []);
}
