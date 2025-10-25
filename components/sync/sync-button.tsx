"use client";

import { CloudIcon, CloudOffIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, ClockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSync } from '@/lib/hooks/use-sync';
import { useToast } from '@/components/ui/toast';
import { useState, useEffect } from 'react';
import { SyncAuthDialog } from '@/components/sync/sync-auth-dialog';
import { getCryptoManager } from '@/lib/sync/crypto';
import { getSyncQueue } from '@/lib/sync/queue';
import { getHealthMonitor } from '@/lib/sync/health-monitor';

const TOAST_DURATION = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 7000,
};

export function SyncButton() {
  const { sync, isSyncing, status, error, isEnabled, lastResult, nextRetryAt } = useSync();
  const { showToast } = useToast();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

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

    // Poll every 2 seconds
    const interval = setInterval(updatePendingCount, 2000);
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

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  // Monitor health and show toast notifications for issues
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let lastNotificationTime = 0;
    const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes between notifications

    const checkHealthAndNotify = async () => {
      const now = Date.now();
      
      // Avoid notification spam
      if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
        return;
      }

      const healthMonitor = getHealthMonitor();
      const report = await healthMonitor.check();

      // Show toast for health issues
      if (!report.healthy && report.issues.length > 0) {
        for (const issue of report.issues) {
          // Only show error severity issues as toasts
          if (issue.severity === 'error') {
            showToast(
              `${issue.message}. ${issue.suggestedAction}`,
              undefined,
              TOAST_DURATION.LONG
            );
            lastNotificationTime = now;
          } else if (issue.severity === 'warning' && issue.type === 'stale_queue') {
            // Show stale queue warnings
            showToast(
              issue.message,
              {
                label: 'Sync Now',
                onClick: handleSync,
              },
              TOAST_DURATION.LONG
            );
            lastNotificationTime = now;
          }
        }
      }
    };

    // Check health every 5 minutes
    const interval = setInterval(checkHealthAndNotify, 5 * 60 * 1000);
    
    // Run initial check after 10 seconds (give time for sync to initialize)
    const initialTimeout = setTimeout(checkHealthAndNotify, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [isEnabled, showToast]);

  const handleSync = async () => {
    if (!isEnabled) {
      // Open sync settings dialog to let user enable sync
      setAuthDialogOpen(true);
      return;
    }

    // Check if encryption is initialized
    const crypto = getCryptoManager();

    if (!crypto.isInitialized()) {
      // Encryption not initialized - need to re-enter passphrase
      showToast(
        'Please enter your encryption passphrase to sync',
        undefined,
        TOAST_DURATION.MEDIUM
      );
      setAuthDialogOpen(true);
      return;
    }

    // Coordinator handles queuing and execution
    await sync();

    // Show toast notification based on result
    if (lastResult) {
      if (lastResult.status === 'success') {
        showToast(
          `Sync complete: Pushed ${lastResult.pushedCount || 0} changes, pulled ${lastResult.pulledCount || 0} changes.`,
          undefined,
          TOAST_DURATION.SHORT
        );
      } else if (lastResult.status === 'conflict') {
        showToast(
          `Sync conflicts detected: ${lastResult.conflicts?.length || 0} conflicts were auto-resolved.`,
          undefined,
          TOAST_DURATION.MEDIUM
        );
      } else if (lastResult.status === 'error') {
        showToast(
          `Sync failed: ${lastResult.error || 'An error occurred during sync.'}`,
          undefined,
          TOAST_DURATION.LONG
        );
      }
    }
  };

  // Determine icon and styling based on status
  const getIcon = () => {
    if (!isEnabled) {
      return <CloudOffIcon className="h-5 w-5" />;
    }

    // Show retry countdown icon when in backoff
    if (retryCountdown !== null && retryCountdown > 0) {
      return <ClockIcon className="h-5 w-5 text-orange-500" />;
    }

    switch (status) {
      case 'syncing':
        return <CloudIcon className="h-5 w-5 animate-pulse" />;
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'conflict':
        return <AlertCircleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <CloudIcon className="h-5 w-5" />;
    }
  };

  const getTooltip = () => {
    if (!isEnabled) {
      return 'Sync not enabled';
    }

    // Show retry countdown in tooltip
    if (retryCountdown !== null && retryCountdown > 0) {
      return `Retrying in ${retryCountdown}s...`;
    }

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
        return pendingCount > 0 
          ? `${pendingCount} pending operation${pendingCount !== 1 ? 's' : ''}`
          : 'Sync with cloud';
    }
  };

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
              aria-label={getTooltip()}
            >
              {getIcon()}

              {/* Badge overlay showing pending operation count */}
              {isEnabled && pendingCount > 0 && (
                <Badge 
                  variant="default" 
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-blue-500 text-white text-xs"
                >
                  {pendingCount}
                </Badge>
              )}

              {/* Small indicator dot when sync is disabled */}
              {!isEnabled && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gray-400" />
              )}

              {/* Retry countdown overlay */}
              {retryCountdown !== null && retryCountdown > 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-orange-500">
                  {retryCountdown}s
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltip()}</p>
            {status === 'error' && error && (
              <p className="text-xs text-red-400 mt-1">{error}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Sync Auth Dialog */}
      <SyncAuthDialog
        isOpen={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        onSuccess={() => {
          // Dialog will close automatically, and useSync hook will detect the change
          setAuthDialogOpen(false);
        }}
      />
    </>
  );
}
