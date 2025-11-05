"use client";

import { ChangeEvent, useRef, useState, useEffect } from "react";
import { SettingsIcon, UploadIcon, DownloadIcon, CloudIcon, LogOutIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SyncAuthDialog } from "@/components/sync/sync-auth-dialog";
import { getSyncStatus, disableSync } from "@/lib/sync/config";
import { getDb } from "@/lib/db";
import { toast } from "sonner";

interface SettingsMenuProps {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export function SettingsMenu({ onExport, onImport, isLoading }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check sync status on mount and when dialog closes
  useEffect(() => {
    const checkSyncStatus = async () => {
      const status = await getSyncStatus();
      setSyncEnabled(status.enabled);
      setUserEmail(status.email);
    };
    checkSyncStatus();
  }, [syncDialogOpen]);

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await onImport(file);
    event.target.value = "";
    setIsOpen(false);
  };

  const handleExport = async () => {
    await onExport();
    setIsOpen(false);
  };

  const handleOpenSyncDialog = () => {
    setSyncDialogOpen(true);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    // Check for pending sync operations
    const status = await getSyncStatus();
    if (status.pendingCount > 0) {
      setPendingChanges(status.pendingCount);
      setShowLogoutConfirm(true);
      return;
    }

    // No pending changes, proceed with logout
    await performLogout();
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Use disableSync for proper cleanup:
      // - Stops health monitor (background sync)
      // - Clears API token from client
      // - Clears crypto manager
      // - Resets sync config (preserves deviceId)
      // - Clears sync queue (removes pending operations)
      await disableSync();

      // Also delete encryption salt (disableSync doesn't handle this)
      const db = getDb();
      await db.syncMetadata.delete("encryption_salt");

      setSyncEnabled(false);
      setUserEmail(null);
      setIsOpen(false);
      setShowLogoutConfirm(false);

      toast.success("Logged out successfully");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      toast.error(errorMsg);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="h-10 w-10 p-0"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Settings"
            aria-expanded={isOpen}
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Import / Export</p>
        </TooltipContent>
      </Tooltip>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-card-border bg-card shadow-lg">
            <div className="p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportChange}
                aria-hidden
              />

              {syncEnabled && userEmail ? (
                <>
                  <div className="px-3 py-2 mb-2">
                    <p className="text-xs text-foreground-muted mb-1">Signed in as</p>
                    <p className="text-sm font-medium text-foreground truncate">{userEmail}</p>
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-muted disabled:opacity-50"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>

                  <div className="my-2 h-px bg-border" />
                </>
              ) : (
                <>
                  <button
                    onClick={handleOpenSyncDialog}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-muted"
                  >
                    <span className="flex items-center gap-3">
                      <CloudIcon className="h-4 w-4" />
                      Enable Sync
                    </span>
                  </button>

                  <div className="my-2 h-px bg-border" />
                </>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-muted disabled:opacity-50"
              >
                <UploadIcon className="h-4 w-4" />
                Import JSON
              </button>

              <button
                onClick={handleExport}
                disabled={isLoading}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-muted disabled:opacity-50"
              >
                <DownloadIcon className="h-4 w-4" />
                Export JSON
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sync Auth Dialog */}
      <SyncAuthDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onSuccess={() => {
          // Refresh sync status
          getSyncStatus().then((status) => setSyncEnabled(status.enabled));
        }}
      />

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
              Unsynchronized Changes
            </DialogTitle>
            <DialogDescription>
              You have {pendingChanges} unsynchronized {pendingChanges === 1 ? 'change' : 'changes'}.
              If you logout now, these changes will be lost and cannot be recovered.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-foreground-muted">
              <strong>Recommendation:</strong> Wait for sync to complete or ensure you have a recent backup.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="subtle"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={performLogout}
                disabled={isLoggingOut}
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoggingOut ? "Logging out..." : "Logout Anyway"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
