"use client";

import { useEffect, useRef } from 'react';
import type { HealthIssue, HealthReport } from '@/lib/sync/health-monitor';
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
  /** The latest report from the sync status store's health poll. Null while sync is off. */
  healthReport: HealthReport | null;
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
 * Hook for surfacing sync health as notifications.
 *
 * The sync status store runs the health check (10 s after sync comes on, then
 * every 5 min) and publishes each report. This hook turns a report into a toast
 * per issue, once per report. The cooldown and the consumer callbacks live in
 * refs, so frequent status-poll re-renders (which hand the hook fresh callback
 * identities) never replay a notification.
 */
export function useSyncHealth({ healthReport, onHealthIssue, onSync }: SyncHealthOptions) {
  const lastNotificationTimeRef = useRef(0);
  const onHealthIssueRef = useRef(onHealthIssue);
  const onSyncRef = useRef(onSync);

  // Keep the latest callbacks without retriggering the report effect below.
  useEffect(() => {
    onHealthIssueRef.current = onHealthIssue;
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    if (!healthReport || healthReport.healthy || healthReport.issues.length === 0) {
      return;
    }

    // Avoid notification spam. Reading/writing a ref keeps this immune to the
    // re-render churn that an effect-dependency state value would suffer.
    const now = Date.now();
    if (now - lastNotificationTimeRef.current < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) {
      return;
    }

    for (const issue of healthReport.issues) {
      const notification = buildNotification(issue, onSyncRef.current);
      if (notification) {
        onHealthIssueRef.current(notification);
        lastNotificationTimeRef.current = now;
      }
    }
  }, [healthReport]);
}
