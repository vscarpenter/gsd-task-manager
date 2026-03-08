"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { XIcon, CloudIcon } from "lucide-react";
import { OAuthButtons } from "@/components/sync/oauth-buttons";
import { type AuthState } from "@/lib/sync/pb-auth";
import { getSyncStatus, disableSync } from "@/lib/sync/config";
import { getSyncQueue } from "@/lib/sync/queue";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import type { PBSyncConfig } from "@/lib/sync/types";

interface SyncAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SyncAuthDialog({ isOpen, onClose, onSuccess }: SyncAuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    enabled: boolean;
    email: string | null;
    provider?: string | null;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load sync status when dialog opens
  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      const db = getDb();
      const config = await db.syncMetadata.get("sync_config") as PBSyncConfig | undefined;

      if (cancelled) return;

      if (config) {
        setSyncStatus({
          enabled: !!config.enabled,
          email: config.email || null,
          provider: config.provider || undefined,
        });
      } else {
        setSyncStatus({ enabled: false, email: null });
      }
    };

    if (isOpen) {
      loadStatus();
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleOAuthSuccess = async (authState: AuthState) => {
    setIsLoading(false);
    setError(null);

    // Persist sync config to IndexedDB
    const db = getDb();
    const existingConfig = await db.syncMetadata.get("sync_config") as PBSyncConfig | undefined;
    const deviceId = existingConfig?.deviceId ?? crypto.randomUUID();

    const newConfig: PBSyncConfig = {
      key: "sync_config",
      enabled: true,
      userId: authState.userId,
      deviceId,
      deviceName: navigator.userAgent.substring(0, 50),
      email: authState.email,
      provider: authState.provider,
      lastSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 2,
    };

    await db.syncMetadata.put(newConfig);

    // Queue all existing tasks for initial push
    const queue = getSyncQueue();
    await queue.populateFromExistingTasks();

    setSyncStatus({
      enabled: true,
      email: authState.email,
      provider: authState.provider,
    });

    toast.success(`Signed in as ${authState.email}`);
    onSuccess?.();
  };

  const handleLogout = async () => {
    // Check for pending sync operations before logging out
    const status = await getSyncStatus();
    if (status.pendingCount > 0) {
      setPendingChanges(status.pendingCount);
      setShowLogoutConfirm(true);
      return;
    }

    await performLogout();
  };

  const performLogout = async () => {
    setIsLoading(true);
    try {
      await disableSync();

      setSyncStatus({ enabled: false, email: null });
      setError(null);
      setShowLogoutConfirm(false);
      toast.success("Logged out successfully");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto p-4"
        onClick={onClose}
      >
        <div
          className="relative my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CloudIcon className="h-6 w-6 text-accent" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">Sync Settings</h2>
                <p className="text-sm text-foreground-muted">
                  {syncStatus?.enabled ? "Manage your sync account" : "Enable cloud sync"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-foreground-muted hover:bg-background-muted hover:text-foreground"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {syncStatus?.enabled ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-background-muted p-4">
                <p className="mb-1 text-sm text-foreground-muted">Signed in as</p>
                <p className="font-medium text-foreground">{syncStatus.email}</p>
                {syncStatus.provider && (
                  <p className="mt-1 text-xs text-foreground-muted capitalize">
                    via {syncStatus.provider}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <Button
                onClick={handleLogout}
                disabled={isLoading}
                variant="subtle"
                className="w-full"
              >
                {isLoading ? "Logging out..." : "Logout"}
              </Button>

              {showLogoutConfirm && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                    You have {pendingChanges} unsynchronized {pendingChanges === 1 ? 'change' : 'changes'}.
                    Logging out will discard them.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="subtle"
                      onClick={() => setShowLogoutConfirm(false)}
                      disabled={isLoading}
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={performLogout}
                      disabled={isLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-xs"
                    >
                      Logout Anyway
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <OAuthButtons
                  onStart={() => {
                    setError(null);
                    setIsLoading(true);
                  }}
                  onSuccess={handleOAuthSuccess}
                  onError={(err) => {
                    setIsLoading(false);
                    setError(err.message);
                    toast.error(err.message);
                  }}
                />

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-lg bg-background-muted p-4 text-sm text-foreground-muted">
                <p className="mb-2 font-medium text-foreground">Cloud sync</p>
                <p>
                  Sign in to sync your tasks across devices. Your data is stored on
                  your self-hosted PocketBase server.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      )}
    </>
  );

  return createPortal(dialogContent, document.body);
}
