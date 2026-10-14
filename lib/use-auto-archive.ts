/**
 * Auto-archive hook
 *
 * Purges expired trash and archives old completed tasks based on settings.
 *
 * Archiving deletes each task's server copy, so with sync on it must work from
 * data at least as fresh as the last pull (parity backlog B-46). A sweep from a
 * stale local copy, on page load before the first sync or in a tab that sat in
 * the background, would archive a task someone reopened on another device, and
 * its delete would remove that task everywhere. So with sync on, archiving runs
 * right after a pull completes, at most once an hour. With sync off nothing
 * leaves the device, and it runs on mount and hourly. Trash purge never syncs,
 * so it always runs on mount and hourly.
 */

import { useEffect } from 'react';
import { getArchiveSettings, archiveOldTasks } from './archive';
import { purgeExpiredTrash } from './trash';
import { createLogger } from './logger';
import { TIME_MS } from './constants';
import { isSyncEnabled } from '@/lib/sync/config';
import { getSyncCoordinator } from '@/lib/sync/sync-coordinator';

const logger = createLogger('AUTO_ARCHIVE');

/**
 * Retention runs unconditionally, before the archive check. Trash is a
 * safety floor rather than a workflow preference, so it is not gated on
 * the archive toggle — a user with auto-archive off still needs deleted
 * tasks to stop accumulating (ADR 0015).
 */
async function purgeTrash(): Promise<void> {
  try {
    const purged = await purgeExpiredTrash();
    if (purged > 0) logger.info('Purged expired trash', { count: purged });
  } catch (error) {
    logger.error('Trash purge failed', error instanceof Error ? error : undefined);
  }
}

/** Archive old completed tasks when auto-archive is on. Never throws; returns whether it ran. */
async function archiveIfEnabled(): Promise<boolean> {
  try {
    const settings = await getArchiveSettings();
    if (!settings.enabled) return false;

    logger.info('Running auto-archive check', {
      archiveAfterDays: settings.archiveAfterDays
    });
    const count = await archiveOldTasks(settings.archiveAfterDays);
    if (count > 0) {
      logger.info('Auto-archived tasks', { count });
    }
    return true;
  } catch (error) {
    logger.error('Auto-archive failed', error instanceof Error ? error : undefined);
    return false;
  }
}

/** If sync state can't be read, assume it's on: archiving then waits for a pull. */
async function syncIsOn(): Promise<boolean> {
  try {
    return await isSyncEnabled();
  } catch {
    return true;
  }
}

/** The mount and hourly check: trash always, archive only while sync is off. */
async function runScheduledCheck(): Promise<void> {
  await purgeTrash();
  if (await syncIsOn()) return;
  await archiveIfEnabled();
}

/** Archive after a completed pull, at most once an hour and never twice at once. */
function createAfterPullArchiver(): () => Promise<void> {
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let running = false;
  return async () => {
    if (running || Date.now() - lastRunAt < TIME_MS.HOUR) return;
    running = true;
    if (await archiveIfEnabled()) lastRunAt = Date.now();
    running = false;
  };
}

export function useAutoArchive() {
  useEffect(() => {
    void runScheduledCheck();
    const interval = setInterval(() => void runScheduledCheck(), TIME_MS.HOUR);
    const unsubscribe = getSyncCoordinator().onPulled(createAfterPullArchiver());

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);
}
