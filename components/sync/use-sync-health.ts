"use client";

import { useEffect, useState } from 'react';
import { SYNC_CONFIG, SYNC_TOAST_DURATION } from '@/lib/constants/sync';
import { getSyncQueue } from '@/lib/sync/queue';
import { getConnectionState } from '@/lib/sync/realtime-listener';

interface SyncHealthOptions {
  isEnabled: boolean;
  onHealthIssue: (message: string, action?: { label: string; onClick: () => void }, duration?: number) => void;
  onSync: () => void;
}

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hook for monitoring sync health and showing notifications
 * Checks for stale queue operations and connection issues
 */
export function useSyncHealth({ isEnabled, onHealthIssue, onSync }: SyncHealthOptions) {
  const [lastNotificationTime, setLastNotificationTime] = useState(0);

  useEffect(() => {
    if (!isEnabled) return;

    const checkHealth = async () => {
      const now = Date.now();

      // Avoid notification spam
      if (now - lastNotificationTime < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS) return;

      // Check for stale queue operations
      const queue = getSyncQueue();
      const pending = await queue.getPending();
      const staleOps = pending.filter(op => now - op.timestamp > STALE_THRESHOLD_MS);

      if (staleOps.length > 0) {
        onHealthIssue(
          `${staleOps.length} sync operation${staleOps.length > 1 ? 's' : ''} pending for over an hour`,
          { label: 'Sync Now', onClick: onSync },
          SYNC_TOAST_DURATION.LONG
        );
        setLastNotificationTime(now);
        return;
      }

      // Check Realtime connection
      const connectionState = getConnectionState();
      if (connectionState === 'disconnected') {
        onHealthIssue(
          'Real-time sync is disconnected. Changes may not sync automatically.',
          undefined,
          SYNC_TOAST_DURATION.LONG
        );
        setLastNotificationTime(now);
      }
    };

    const interval = setInterval(checkHealth, SYNC_CONFIG.HEALTH_CHECK_INTERVAL_MS);
    const initialTimeout = setTimeout(checkHealth, SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [isEnabled, lastNotificationTime, onHealthIssue, onSync]);
}
