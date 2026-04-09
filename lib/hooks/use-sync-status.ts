"use client";

import { useState, useEffect } from "react";
import { useSync } from "@/lib/hooks/use-sync";
import { getSyncQueue } from "@/lib/sync/queue";
import { SYNC_CONFIG } from "@/lib/constants/sync";
import { UI_TIMING } from "@/lib/constants/ui";

/**
 * Format timestamp to human-readable relative time
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Never";

  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60)
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

interface SyncStatusResult {
  isEnabled: boolean;
  retryCount: number;
  lastSyncTime: string | null;
  pendingCount: number;
  retryCountdown: number | null;
  formatRelativeTime: (timestamp: string | null) => string;
}

/**
 * Custom hook that polls sync status (last sync time, pending count,
 * retry countdown) and exposes the results for display.
 */
export function useSyncStatus(): SyncStatusResult {
  const { isEnabled, nextRetryAt, retryCount } = useSync();
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // Poll last sync time from coordinator
  useEffect(() => {
    const updateLastSync = async () => {
      if (!isEnabled) {
        setLastSyncTime(null);
        return;
      }

      const { getSyncCoordinator } = await import(
        "@/lib/sync/sync-coordinator"
      );
      const coordinator = getSyncCoordinator();
      const status = await coordinator.getStatus();
      setLastSyncTime(status.lastSuccessfulSyncAt);
    };

    updateLastSync();

    const interval = setInterval(updateLastSync, SYNC_CONFIG.SYNC_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [isEnabled]);

  // Force re-render every 30 seconds to update relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, UI_TIMING.RELATIVE_TIME_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  // Poll pending operation count
  useEffect(() => {
    const updatePendingCount = async () => {
      if (!isEnabled) {
        setPendingCount(0);
        return;
      }

      const queue = getSyncQueue();
      const count = await queue.getPendingCount();
      setPendingCount(count);
    };

    updatePendingCount();

    const interval = setInterval(
      updatePendingCount,
      SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [isEnabled]);

  // Update retry countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (nextRetryAt && nextRetryAt > Date.now()) {
        const secondsRemaining = Math.ceil(
          (nextRetryAt - Date.now()) / 1000
        );
        setRetryCountdown(secondsRemaining);
      } else {
        setRetryCountdown(null);
      }
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  return {
    isEnabled,
    retryCount,
    lastSyncTime,
    pendingCount,
    retryCountdown,
    formatRelativeTime,
  };
}
