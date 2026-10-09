"use client";

import { useEffect, useRef } from 'react';
import { useRetryCountdown } from '@/lib/hooks/use-retry-countdown';
import { isAuthError } from '@/lib/sync/error-categorizer';
import { SYNC_TOAST_DURATION } from '@/lib/constants/sync';

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
  /** Queue operations waiting to be pushed, from the sync status store. */
  pendingCount: number;
  onAuthError: (message: string, action?: { label: string; onClick: () => void }, duration?: number) => void;
  /**
   * Timestamp of the most recent successful sync. When provided alongside
   * `isEnabled` and idle status, the tooltip communicates the healthy
   * steady-state so the visual green dot has matching copy.
   */
  lastSuccessfulSyncAt?: string | null;
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
 * Handles the retry countdown and auth error detection, and derives the icon
 * and tooltip from the sync state the button hands it.
 */
export function useSyncStatus({
  isEnabled,
  status,
  error,
  nextRetryAt,
  pendingCount,
  onAuthError,
  lastSuccessfulSyncAt = null,
}: SyncStatusOptions): SyncStatusResult {
  const retryCountdown = useRetryCountdown(nextRetryAt);
  const previousAuthErrorRef = useRef(false);

  // Detect authentication errors - derive from error state
  const hasAuthError = error ? isAuthError(new Error(error)) : false;

  // Trigger callback once when we transition into an auth error state
  useEffect(() => {
    if (hasAuthError && !previousAuthErrorRef.current && error) {
      // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent -- one-shot toast on an external-state transition; no event source
      onAuthError(error, undefined, SYNC_TOAST_DURATION.LONG);
    }
    previousAuthErrorRef.current = hasAuthError;
  }, [hasAuthError, error, onAuthError]);

  const iconType = getIconType({ isEnabled, hasAuthError, retryCountdown, status, error });

  const tooltip = getTooltip({
    isEnabled,
    hasAuthError,
    retryCountdown,
    status,
    error,
    pendingCount,
    lastSuccessfulSyncAt,
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
  error: string | null;
}

function getIconType({ isEnabled, hasAuthError, retryCountdown, status, error }: IconOptions): IconType {
  if (!isEnabled) return 'cloud-off';
  if (hasAuthError) return 'alert-auth';
  if (retryCountdown !== null && retryCountdown > 0) return 'clock';
  if (error && status !== 'syncing' && status !== 'success') return 'x-error';

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
  lastSuccessfulSyncAt: string | null;
}

function getTooltip({
  isEnabled,
  hasAuthError,
  retryCountdown,
  status,
  error,
  pendingCount,
  lastSuccessfulSyncAt,
}: TooltipOptions): string {
  if (!isEnabled) return 'Sync not enabled';
  if (hasAuthError) return 'Authentication expired - Click to re-login';
  if (retryCountdown !== null && retryCountdown > 0) return `Retrying in ${retryCountdown}s...`;

  // A background failure sets `error` without leaving `status` on "error",
  // and a manual failure returns `status` to idle after a few seconds.
  if (error && status !== 'syncing' && status !== 'success') {
    return 'Last sync failed · Click to sync now';
  }

  // Healthy steady-state: mirror the green-dot affordance with matching copy.
  if (status === 'idle' && pendingCount === 0 && lastSuccessfulSyncAt) {
    return 'Synced · Click to sync now';
  }

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
