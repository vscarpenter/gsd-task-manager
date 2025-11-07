/**
 * Auto-archive hook
 *
 * Automatically archives old completed tasks based on settings.
 * Runs on mount and periodically checks every hour.
 */

import { useEffect } from 'react';
import { getArchiveSettings, archiveOldTasks } from './archive';
import { createLogger } from './logger';

const logger = createLogger('AUTO_ARCHIVE');

export function useAutoArchive() {
  useEffect(() => {
    const checkAndArchive = async () => {
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
    const interval = setInterval(checkAndArchive, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
}
