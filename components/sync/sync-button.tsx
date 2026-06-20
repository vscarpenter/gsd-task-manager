"use client";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useSync } from '@/lib/hooks/use-sync';
import { useState } from 'react';
import { SyncAuthDialog } from '@/components/sync/sync-auth-dialog';
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
  const { sync, isSyncing, status, error, isEnabled, nextRetryAt } = useSync();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useSyncHealth({
    isEnabled,
    onHealthIssue: ({ id, message, action, duration }) => {
      // The stable `id` lets sonner replace a recurring health toast in place
      // instead of stacking duplicates (e.g. after a wake-from-sleep burst).
      toast(message, {
        id,
        duration,
        action: action ? { label: action.label, onClick: action.onClick } : undefined,
      });
    },
    onSync: handleSync,
  });

  const { iconType, tooltip, pendingCount, hasAuthError, retryCountdown } = useSyncStatus({
    isEnabled,
    status,
    error,
    nextRetryAt,
    onAuthError: (message, _action, duration) => {
      toast(message, {
        duration,
        action: {
          label: 'Re-login',
          onClick: () => setAuthDialogOpen(true),
        },
      });
    },
  });

  const icon = getIconComponent(iconType);

  async function handleSync() {
    if (!isEnabled) {
      setAuthDialogOpen(true);
      return;
    }

    if (hasAuthError) {
      toast('Please re-login to continue syncing', {
        duration: SYNC_TOAST_DURATION.MEDIUM,
      });
      setAuthDialogOpen(true);
      return;
    }

    // sync() returns the result directly — no stale closure.
    // Toasts are handled by fullSync() via notifications.ts; no duplicate toast here.
    await sync();
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
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-accent text-white text-xs"
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
