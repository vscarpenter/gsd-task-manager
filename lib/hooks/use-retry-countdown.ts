"use client";

import { useEffect, useState } from 'react';
import { SYNC_CONFIG } from '@/lib/constants/sync';

function secondsUntil(nextRetryAt: number | null): number | null {
  if (!nextRetryAt || nextRetryAt <= Date.now()) return null;
  return Math.ceil((nextRetryAt - Date.now()) / 1000);
}

/**
 * Seconds until the next sync retry, ticking once a second, or null while no
 * retry is scheduled. Shared by the header and the sync button so the two
 * displays count down in step.
 */
export function useRetryCountdown(nextRetryAt: number | null): number | null {
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  useEffect(() => {
    const updateCountdown = () => setRetryCountdown(secondsUntil(nextRetryAt));
    updateCountdown();
    const interval = setInterval(updateCountdown, SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  return retryCountdown;
}
