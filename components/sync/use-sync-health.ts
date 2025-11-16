"use client";

import { useEffect, useState } from 'react';
import { getHealthMonitor } from '@/lib/sync/health-monitor';
import { SYNC_CONFIG, SYNC_TOAST_DURATION } from '@/lib/constants/sync';

interface SyncHealthOptions {
  isEnabled: boolean;
  onHealthIssue: (message: string, action?: { label: string; onClick: () => void }, duration?: number) => void;
  onSync: () => void;
}

/**
 * Hook for monitoring sync health and showing notifications
 * Checks health periodically and displays toasts for issues
 */
export function useSyncHealth({ isEnabled, onHealthIssue, onSync }: SyncHealthOptions) {
  const [lastNotificationTime, setLastNotificationTime] = useState(0);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const checkHealthAndNotify = async () => {
      const now = Date.now();

      // Avoid notification spam
      if (now - lastNotificationTime < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) {
        return;
      }

      const healthMonitor = getHealthMonitor();
      const report = await healthMonitor.check();

      // Show toast for health issues
      if (!report.healthy && report.issues.length > 0) {
        handleHealthIssues(report.issues, now);
      }
    };

    const handleHealthIssues = (issues: any[], now: number) => {
      for (const issue of issues) {
        if (shouldShowErrorIssue(issue)) {
          showErrorIssue(issue);
          setLastNotificationTime(now);
        } else if (shouldShowStaleQueueWarning(issue)) {
          showStaleQueueWarning(issue);
          setLastNotificationTime(now);
        }
      }
    };

    const shouldShowErrorIssue = (issue: any) => {
      return issue.severity === 'error';
    };

    const shouldShowStaleQueueWarning = (issue: any) => {
      return issue.severity === 'warning' && issue.type === 'stale_queue';
    };

    const showErrorIssue = (issue: any) => {
      const message = `${issue.message}. ${issue.suggestedAction}`;
      onHealthIssue(message, undefined, SYNC_TOAST_DURATION.LONG);
    };

    const showStaleQueueWarning = (issue: any) => {
      onHealthIssue(
        issue.message,
        {
          label: 'Sync Now',
          onClick: onSync,
        },
        SYNC_TOAST_DURATION.LONG
      );
    };

    // Check health periodically
    const interval = setInterval(checkHealthAndNotify, SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS);

    // Run initial check after delay
    const initialTimeout = setTimeout(
      checkHealthAndNotify,
      SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS
    );

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [isEnabled, lastNotificationTime, onHealthIssue, onSync]);
}
