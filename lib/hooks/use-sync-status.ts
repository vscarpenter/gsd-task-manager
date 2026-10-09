"use client";

import { useState, useEffect } from "react";
import { useSync } from "@/lib/hooks/use-sync";
import { useRetryCountdown } from "@/lib/hooks/use-retry-countdown";
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
  error: string | null;
  formatRelativeTime: (timestamp: string | null) => string;
}

/**
 * Sync status for the header: the last sync time, the pending operation
 * count, and the retry countdown. The values come from the sync status store
 * through the sync context, so this hook reads nothing on its own.
 */
export function useSyncStatus(): SyncStatusResult {
  const { isEnabled, nextRetryAt, retryCount, pendingCount, lastSuccessfulSyncAt, error } = useSync();
  const [, setTick] = useState(0);
  const retryCountdown = useRetryCountdown(nextRetryAt);

  // Force re-render every 30 seconds to update relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, UI_TIMING.RELATIVE_TIME_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  return {
    isEnabled,
    retryCount,
    lastSyncTime: isEnabled ? lastSuccessfulSyncAt : null,
    pendingCount,
    retryCountdown,
    error,
    formatRelativeTime,
  };
}
