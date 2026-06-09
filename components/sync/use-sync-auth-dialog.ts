"use client";

import { useState, useEffect } from "react";
import { getOAuthErrorMessage, type AuthState, refreshAuth } from "@/lib/sync/pb-auth";
import { clearPocketBase, isAuthenticated } from "@/lib/sync/pocketbase-client";
import { getSyncStatus, disableSync } from "@/lib/sync/config";
import { getSyncQueue } from "@/lib/sync/queue";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import type { PBSyncConfig } from "@/lib/sync/types";

export interface SyncStatusInfo {
  enabled: boolean;
  email: string | null;
  provider?: string | null;
}

interface UseSyncAuthDialogProps {
  isOpen: boolean;
  onSuccess?: () => void;
}

interface CancellationToken {
  cancelled: boolean;
}

export function useSyncAuthDialog({ isOpen, onSuccess }: UseSyncAuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const cancellation: CancellationToken = { cancelled: false };

    if (isOpen) {
      setShowLogoutConfirm(false);
      setSessionExpired(false);
      loadSyncStatus(cancellation, {
        setIsRefreshing,
        setSessionExpired,
        setSyncStatus,
      });
    }

    return () => {
      cancellation.cancelled = true;
    };
  }, [isOpen]);

  const handleOAuthSuccess = async (authState: AuthState) => {
    setError(null);

    try {
      await persistSyncConfig(authState);
    } catch (err) {
      const setupError = err instanceof Error ? err.message : "Please try again.";
      clearPocketBase();
      setSyncStatus({ enabled: false, email: null });
      setIsLoading(false);
      throw new Error(`Signed in, but sync setup failed. ${setupError}`, {
        cause: err,
      });
    }

    setSyncStatus({
      enabled: true,
      email: authState.email,
      provider: authState.provider,
    });

    setIsLoading(false);
    toast.success(`Signed in as ${authState.email}`);
    onSuccess?.();
  };

  const handleOAuthStart = () => {
    setError(null);
    setIsLoading(true);
  };

  const handleOAuthError = (err: Error) => {
    const message = getOAuthErrorMessage(err);
    setIsLoading(false);
    setError(message);
    toast.error(message);
  };

  const handleLogout = async () => {
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

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  return {
    isLoading,
    error,
    syncStatus,
    mounted,
    showLogoutConfirm,
    pendingChanges,
    sessionExpired,
    isRefreshing,
    handleOAuthSuccess,
    handleOAuthStart,
    handleOAuthError,
    handleLogout,
    performLogout,
    cancelLogout,
  };
}

/** Load sync config from IndexedDB and validate token */
async function loadSyncStatus(
  cancellation: CancellationToken,
  setters: {
    setIsRefreshing: (v: boolean) => void;
    setSessionExpired: (v: boolean) => void;
    setSyncStatus: (v: SyncStatusInfo) => void;
  }
) {
  const db = getDb();
  const config = (await db.syncMetadata.get("sync_config")) as PBSyncConfig | undefined;

  if (cancellation.cancelled) return;

  if (!config?.enabled) {
    setters.setSyncStatus({ enabled: false, email: null });
    setters.setSessionExpired(false);
    return;
  }

  await validateTokenAndRefresh(cancellation, setters);
  if (cancellation.cancelled) return;

  setters.setSyncStatus({
    enabled: true,
    email: config.email || null,
    provider: config.provider || undefined,
  });
}

/** Check if token is valid; attempt silent refresh if expired */
async function validateTokenAndRefresh(
  cancellation: CancellationToken,
  setters: {
    setIsRefreshing: (v: boolean) => void;
    setSessionExpired: (v: boolean) => void;
  }
) {
  const tokenValid = isAuthenticated();

  if (tokenValid) {
    setters.setSessionExpired(false);
    return;
  }

  // Token expired — attempt silent refresh
  setters.setIsRefreshing(true);
  const refreshed = await refreshAuth();
  if (cancellation.cancelled) return;
  setters.setIsRefreshing(false);

  setters.setSessionExpired(!refreshed);
}

/** Persist sync config to IndexedDB after successful OAuth */
async function persistSyncConfig(authState: AuthState) {
  const db = getDb();
  const existingConfig = (await db.syncMetadata.get("sync_config")) as PBSyncConfig | undefined;
  const deviceId = existingConfig?.deviceId ?? crypto.randomUUID();
  const localTaskCount = await db.tasks.count();
  const localTaskOwnerUserId = existingConfig?.localTaskOwnerUserId ?? null;

  if (
    localTaskCount > 0 &&
    localTaskOwnerUserId &&
    localTaskOwnerUserId !== authState.userId
  ) {
    throw new Error(
      "Local tasks belong to a different sync account. Reset local data or sign in with the original account before enabling sync."
    );
  }

  const newConfig: PBSyncConfig = {
    key: "sync_config",
    enabled: true,
    userId: authState.userId,
    deviceId,
    deviceName: navigator.userAgent.substring(0, 50),
    email: authState.email,
    provider: authState.provider,
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
    autoSyncEnabled: true,
    autoSyncIntervalMinutes: 2,
    localTaskOwnerUserId: authState.userId,
  };

  await db.syncMetadata.put(newConfig);

  const queue = getSyncQueue();
  await queue.populateFromExistingTasks();
}
