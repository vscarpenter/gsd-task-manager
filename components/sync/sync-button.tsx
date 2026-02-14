"use client";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSync } from '@/lib/hooks/use-sync';
import { useToast } from '@/components/ui/toast';
import { useState } from 'react';
import { SyncAuthDialog } from '@/components/sync/sync-auth-dialog';
import { getCryptoManager } from '@/lib/sync/crypto';
import { SYNC_TOAST_DURATION } from '@/lib/constants/sync';
import { useSyncHealth } from '@/components/sync/use-sync-health';
import { useSyncStatus, type IconType } from '@/components/sync/use-sync-status';
import {
  CloudIcon,
  CloudOffIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  ClockIcon,
} from 'lucide-react';

export function SyncButton() {
  const { sync, isSyncing, status, error, isEnabled, lastResult, nextRetryAt } = useSync();
  const { showToast } = useToast();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Extract health monitoring logic
  useSyncHealth({
    isEnabled,
    onHealthIssue: showToast,
    onSync: handleSync,
  });

  // Extract status display logic
  const { iconType, tooltip, pendingCount, hasAuthError, retryCountdown } = useSyncStatus({
    isEnabled,
    status,
    error,
    nextRetryAt,
    onAuthError: (message, _action, duration) => {
      showToast(
        message,
        {
          label: 'Re-login',
          onClick: () => setAuthDialogOpen(true),
        },
        duration
      );
    },
  });

  const icon = getIconComponent(iconType);

  async function handleSync() {
    if (!isEnabled) {
      setAuthDialogOpen(true);
      return;
    }

    if (hasAuthError) {
      showToast(
        'Please re-login to continue syncing',
        undefined,
        SYNC_TOAST_DURATION.MEDIUM
      );
      setAuthDialogOpen(true);
      return;
    }

    const crypto = getCryptoManager();
    if (!crypto.isInitialized()) {
      showToast(
        'Please enter your encryption passphrase to sync',
        undefined,
        SYNC_TOAST_DURATION.MEDIUM
      );
      setAuthDialogOpen(true);
      return;
    }

    await sync();
    showSyncResultToast(lastResult);
  }

  function showSyncResultToast(result: typeof lastResult) {
    if (!result) return;

    if (result.status === 'success') {
      showToast(
        `Sync complete: Pushed ${result.pushedCount || 0} changes, pulled ${result.pulledCount || 0} changes.`,
        undefined,
        SYNC_TOAST_DURATION.SHORT
      );
    } else if (result.status === 'conflict') {
      showToast(
        `Sync conflicts detected: ${result.conflicts?.length || 0} conflicts were auto-resolved.`,
        undefined,
        SYNC_TOAST_DURATION.MEDIUM
      );
    } else if (result.status === 'error') {
      showToast(
        `Sync failed: ${result.error || 'An error occurred during sync.'}`,
        undefined,
        SYNC_TOAST_DURATION.LONG
      );
    }
  }

  function handleAuthSuccess() {
    setAuthDialogOpen(false);
  }

  function getIconComponent(type: IconType) {
    switch (type) {
      case 'cloud-off':
        return <CloudOffIcon className="h-5 w-5" />;
      case 'alert-auth':
        return <AlertCircleIcon className="h-5 w-5 text-red-600 animate-pulse" />;
      case 'clock':
        return <ClockIcon className="h-5 w-5 text-orange-500" />;
      case 'cloud-syncing':
        return <CloudIcon className="h-5 w-5 animate-pulse" />;
      case 'check-success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'x-error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'alert-conflict':
        return <AlertCircleIcon className="h-5 w-5 text-yellow-500" />;
      case 'cloud-idle':
        return <CloudIcon className="h-5 w-5" />;
    }
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={handleSync}
              disabled={isSyncing}
              className="relative h-12 w-12 p-0"
              aria-label={tooltip}
            >
              {icon}

              {hasAuthError && (
                <Badge
                  variant="default"
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-600 text-white text-xs"
                >
                  !
                </Badge>
              )}

              {isEnabled && !hasAuthError && pendingCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-blue-500 text-white text-xs"
                >
                  {pendingCount}
                </Badge>
              )}

              {!isEnabled && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gray-400" />
              )}

              {!hasAuthError && retryCountdown !== null && retryCountdown > 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-orange-500">
                  {retryCountdown}s
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
            {status === 'error' && error && (
              <p className="text-xs text-red-400 mt-1">{error}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SyncAuthDialog
        isOpen={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
