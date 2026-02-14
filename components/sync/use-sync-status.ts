"use client";

import { useEffect, useRef, useState } from 'react';
import { getSyncQueue } from '@/lib/sync/queue';
import { isAuthError } from '@/lib/sync/error-categorizer';
import { SYNC_CONFIG, SYNC_TOAST_DURATION } from '@/lib/constants/sync';

export type SyncStatus = 'syncing' | 'success' | 'error' | 'conflict' | 'idle';

export type IconType =
  | 'cloud-off'
  | 'alert-auth'
  | 'clock'
  | 'cloud-syncing'
  | 'check-success'
  | 'x-error'
  | 'alert-conflict'
  | 'cloud-idle';

interface SyncStatusOptions {
  isEnabled: boolean;
  status: SyncStatus;
  error: string | null;
  nextRetryAt: number | null;
  onAuthError: (message: string, action?: { label: string; onClick: () => void }, duration?: number) => void;
}

interface SyncStatusResult {
  iconType: IconType;
  tooltip: string;
  pendingCount: number;
  hasAuthError: boolean;
  retryCountdown: number | null;
}

/**
 * Hook for managing sync status display logic
 * Handles pending count, retry countdown, and auth error detection
 */
export function useSyncStatus({
  isEnabled,
  status,
  error,
  nextRetryAt,
  onAuthError,
}: SyncStatusOptions): SyncStatusResult {
  const [pendingCount, setPendingCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const previousAuthErrorRef = useRef(false);

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

    const interval = setInterval(updatePendingCount, SYNC_CONFIG.PENDING_COUNT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isEnabled]);

  // Update retry countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (nextRetryAt && nextRetryAt > Date.now()) {
        const secondsRemaining = Math.ceil((nextRetryAt - Date.now()) / 1000);
        setRetryCountdown(secondsRemaining);
      } else {
        setRetryCountdown(null);
      }
    };

    updateCountdown();

    const interval = setInterval(updateCountdown, SYNC_CONFIG.COUNTDOWN_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  // Detect authentication errors - derive from error state
  const authErrorDetected = error ? isAuthError(new Error(error)) : false;
  const hasAuthError = authErrorDetected;

  // Trigger callback once when we transition into an auth error state
  useEffect(() => {
    if (authErrorDetected && !previousAuthErrorRef.current && error) {
      onAuthError(error, undefined, SYNC_TOAST_DURATION.LONG);
    }
    previousAuthErrorRef.current = authErrorDetected;
  }, [authErrorDetected, error, onAuthError]);

  const iconType = getIconType({
    isEnabled,
    hasAuthError,
    retryCountdown,
    status,
  });

  const tooltip = getTooltip({
    isEnabled,
    hasAuthError,
    retryCountdown,
    status,
    error,
    pendingCount,
  });

  return {
    iconType,
    tooltip,
    pendingCount,
    hasAuthError,
    retryCountdown,
  };
}

interface IconOptions {
  isEnabled: boolean;
  hasAuthError: boolean;
  retryCountdown: number | null;
  status: SyncStatus;
}

function getIconType({ isEnabled, hasAuthError, retryCountdown, status }: IconOptions): IconType {
  if (!isEnabled) return 'cloud-off';
  if (hasAuthError) return 'alert-auth';
  if (retryCountdown !== null && retryCountdown > 0) return 'clock';

  return getStatusIcon(status);
}

function getStatusIcon(status: SyncStatus): IconType {
  switch (status) {
    case 'syncing':
      return 'cloud-syncing';
    case 'success':
      return 'check-success';
    case 'error':
      return 'x-error';
    case 'conflict':
      return 'alert-conflict';
    default:
      return 'cloud-idle';
  }
}

interface TooltipOptions {
  isEnabled: boolean;
  hasAuthError: boolean;
  retryCountdown: number | null;
  status: SyncStatus;
  error: string | null;
  pendingCount: number;
}

function getTooltip({
  isEnabled,
  hasAuthError,
  retryCountdown,
  status,
  error,
  pendingCount,
}: TooltipOptions): string {
  if (!isEnabled) return 'Sync not enabled';
  if (hasAuthError) return 'Authentication expired - Click to re-login';
  if (retryCountdown !== null && retryCountdown > 0) return `Retrying in ${retryCountdown}s...`;

  return getStatusTooltip(status, error, pendingCount);
}

function getStatusTooltip(status: SyncStatus, error: string | null, pendingCount: number): string {
  switch (status) {
    case 'syncing':
      return 'Syncing...';
    case 'success':
      return 'Sync successful';
    case 'error':
      return error || 'Sync failed';
    case 'conflict':
      return 'Conflicts resolved';
    default:
      return getPendingCountMessage(pendingCount);
  }
}

function getPendingCountMessage(count: number): string {
  if (count === 0) return 'Sync with cloud';
  const plural = count !== 1 ? 's' : '';
  return `${count} pending operation${plural}`;
}
