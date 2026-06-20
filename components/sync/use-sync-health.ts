"use client";

import { useEffect, useRef } from 'react';
import { getHealthMonitor, type HealthIssue } from '@/lib/sync/health-monitor';
import { SYNC_CONFIG, SYNC_TOAST_DURATION } from '@/lib/constants/sync';

/** A health notification ready to be handed to a toast. */
export interface HealthNotification {
  /** Stable per-issue-type id so repeat checks replace rather than stack the toast. */
  id: string;
  message: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface SyncHealthOptions {
  isEnabled: boolean;
  onHealthIssue: (notification: HealthNotification) => void;
  onSync: () => void;
}

/**
 * Build a toast notification for a health issue, or null if the issue should be
 * shown silently. The id is keyed on the issue type so that a recurring issue
 * (e.g. a stale queue surfaced on every periodic check) collapses to a single
 * toast instead of stacking duplicates.
 */
function buildNotification(
  issue: HealthIssue,
  onSync: () => void,
): HealthNotification | null {
  const id = `sync-health-${issue.type}`;

  if (issue.severity === 'error') {
    return {
      id,
      message: `${issue.message}. ${issue.suggestedAction}`,
      duration: SYNC_TOAST_DURATION.LONG,
    };
  }

  if (issue.type === 'stale_queue') {
    return {
      id,
      message: issue.message,
      action: { label: 'Sync Now', onClick: onSync },
      duration: SYNC_TOAST_DURATION.LONG,
    };
  }

  return null;
}

/**
 * Hook for monitoring sync health and showing notifications.
 *
 * Checks health periodically and surfaces a toast per issue. The cooldown and
 * the consumer callbacks live in refs, so frequent status-poll re-renders (which
 * hand the hook fresh callback identities) never re-arm the timers — a single
 * wake-from-sleep would otherwise fire several overlapping checks at once.
 */
export function useSyncHealth({ isEnabled, onHealthIssue, onSync }: SyncHealthOptions) {
  const lastNotificationTimeRef = useRef(0);
  const onHealthIssueRef = useRef(onHealthIssue);
  const onSyncRef = useRef(onSync);

  // Keep the latest callbacks without retriggering the timer effect below.
  useEffect(() => {
    onHealthIssueRef.current = onHealthIssue;
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const checkHealthAndNotify = async () => {
      const now = Date.now();

      // Avoid notification spam. Reading/writing a ref keeps this immune to the
      // re-render churn that an effect-dependency state value would suffer.
      if (now - lastNotificationTimeRef.current < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) {
        return;
      }

      const report = await getHealthMonitor().check();
      if (report.healthy || report.issues.length === 0) {
        return;
      }

      for (const issue of report.issues) {
        const notification = buildNotification(issue, onSyncRef.current);
        if (notification) {
          onHealthIssueRef.current(notification);
          lastNotificationTimeRef.current = now;
        }
      }
    };

    const interval = setInterval(
      checkHealthAndNotify,
      SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS,
    );
    const initialTimeout = setTimeout(
      checkHealthAndNotify,
      SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS,
    );

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [isEnabled]);
}
