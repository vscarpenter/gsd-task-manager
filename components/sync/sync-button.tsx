"use client";

import { CloudIcon, CloudOffIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSync } from '@/lib/hooks/use-sync';
import { useToast } from '@/components/ui/toast';
import { useState } from 'react';
import { SyncAuthDialog } from '@/components/sync/sync-auth-dialog';

const TOAST_DURATION = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 7000,
};

export function SyncButton() {
  const { sync, isSyncing, status, error, isEnabled } = useSync();
  const { showToast } = useToast();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const handleSync = async () => {
    if (!isEnabled) {
      // Open sync settings dialog to let user enable sync
      setAuthDialogOpen(true);
      return;
    }

    const result = await sync();

    if (!result) return;

    // Show toast notification based on result
    if (result.status === 'success') {
      showToast(
        `Sync complete: Pushed ${result.pushedCount || 0} changes, pulled ${result.pulledCount || 0} changes.`,
        undefined,
        TOAST_DURATION.SHORT
      );
    } else if (result.status === 'conflict') {
      showToast(
        `Sync conflicts detected: ${result.conflicts?.length || 0} conflicts were auto-resolved.`,
        undefined,
        TOAST_DURATION.MEDIUM
      );
    } else if (result.status === 'error') {
      showToast(
        `Sync failed: ${result.error || 'An error occurred during sync.'}`,
        undefined,
        TOAST_DURATION.LONG
      );
    }
  };

  // Determine icon and styling based on status
  const getIcon = () => {
    if (!isEnabled) {
      return <CloudOffIcon className="h-5 w-5" />;
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
        return 'Sync with cloud';
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleSync}
        disabled={isSyncing}
        title={getTooltip()}
        className="relative h-12 w-12 p-0"
        aria-label={getTooltip()}
      >
        {getIcon()}

        {/* Small indicator dot when sync is disabled */}
        {!isEnabled && (
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gray-400" />
        )}
      </Button>

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
