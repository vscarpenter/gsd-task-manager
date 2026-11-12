"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import {
  getOAuthErrorMessage,
  isOAuthCancellation,
  type AuthState,
  refreshAuth,
} from "@/lib/sync/pb-auth";
import { clearPocketBase, isAuthenticated } from "@/lib/sync/pocketbase-client";
import { getSyncQueue } from "@/lib/sync/queue";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import type { PBSyncConfig } from "@/lib/sync/types";
import { useLogout } from "./use-logout";
import { useSignOutEverywhere } from "./use-sign-out-everywhere";

export interface SyncStatusInfo {
  enabled: boolean;
  email: string | null;
  provider?: string | null;
}

interface UseSyncAuthDialogProps {
  isOpen: boolean;
  onSuccess?: () => void;
  syncEnabled?: boolean;
}

interface CancellationToken {
  cancelled: boolean;
}

/**
 * Hydration gate for client-only rendering. `getServerSnapshot` returns false
 * (server / first client render), `getSnapshot` returns true (post-hydration),
 * so React re-renders once mounted without a setState-in-effect.
 */
const subscribeMounted = (): (() => void) => () => {};
const getMountedSnapshot = (): boolean => true;
const getMountedServerSnapshot = (): boolean => false;

export function useSyncAuthDialog({ isOpen, onSuccess, syncEnabled }: UseSyncAuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const signOutCallbacks = {
    onSuccess,
    onSignedOut: () => setSyncStatus({ enabled: false, email: null }),
    setIsLoading,
    setError,
  };
  const logout = useLogout(signOutCallbacks);
  const signOutEverywhere = useSignOutEverywhere(signOutCallbacks);

  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getMountedServerSnapshot
  );

  // Reset transient dialog state when the dialog transitions open. Done during
  // render via React's documented "previous prop in state" pattern rather than
  // in an effect, so we never adjust state on a prop change inside useEffect.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      logout.cancelLogout();
      signOutEverywhere.onCancel();
      setSessionExpired(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const cancellation: CancellationToken = { cancelled: false };

    loadSyncStatus(cancellation, {
      setIsRefreshing,
      setSessionExpired,
      setSyncStatus,
    });

    return () => {
      cancellation.cancelled = true;
    };
    // `syncEnabled` isn't read here. It changes when any tab signs in or out,
    // and that's when the account on screen has to be read again.
  }, [isOpen, syncEnabled]);

  const handleOAuthSuccess = async (authState: AuthState) => {
    setError(null);

    try {
      await persistSyncConfig(authState);
    } catch (err) {
      const setupError = err instanceof Error ? err.message : "Please try again.";
      clearPocketBase();
      setSyncStatus({ enabled: false, email: null });
      throw new Error(`Signed in, but sync setup failed. ${setupError}`, {
        cause: err,
      });
    }

    setSyncStatus({
      enabled: true,
      email: authState.email,
      provider: authState.provider,
    });

    toast.success(`Signed in as ${authState.email}`);
    onSuccess?.();
  };

  // The provider buttons show their own waiting state with a Cancel, so a
  // sign-in never sets `isLoading`: that draws a spinner over the whole dialog.
  const handleOAuthStart = () => {
    setError(null);
  };

  const handleOAuthError = (err: Error) => {
    setError(isOAuthCancellation(err) ? null : getOAuthErrorMessage(err));
  };

  return {
    isLoading,
    error,
    syncStatus,
    mounted,
    logout,
    sessionExpired,
    isRefreshing,
    handleOAuthSuccess,
    handleOAuthStart,
    handleOAuthError,
    signOutEverywhere,
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

  if (cancellation.cancelled) return;
  // react-doctor-disable-next-line react-doctor/async-defer-await -- awaited value/side-effect needed before the guard; cannot defer
  const config = (await db.syncMetadata.get("sync_config")) as PBSyncConfig | undefined;
  if (cancellation.cancelled) return;

  if (!config?.enabled) {
    setters.setSyncStatus({ enabled: false, email: null });
    setters.setSessionExpired(false);
    return;
  }

  if (cancellation.cancelled) return;
  // react-doctor-disable-next-line react-doctor/async-defer-await -- awaited value/side-effect needed before the guard; cannot defer
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
  if (cancellation.cancelled) return;
  // react-doctor-disable-next-line react-doctor/async-defer-await -- awaited value/side-effect needed before the guard; cannot defer
  const refreshed = await refreshAuth();
  if (cancellation.cancelled) return;
  setters.setIsRefreshing(false);

  setters.setSessionExpired(!refreshed);
}

function buildSyncConfig(
  authState: AuthState,
  existingConfig: PBSyncConfig | undefined,
): PBSyncConfig {
  return {
    key: "sync_config",
    enabled: true,
    userId: authState.userId,
    deviceId: existingConfig?.deviceId ?? crypto.randomUUID(),
    deviceName: navigator.userAgent.substring(0, 50),
    email: authState.email,
    provider: authState.provider,
    lastSyncAt: null,
    lastClientUpdatedAt: null,
    // Only a completed pull may stamp the contract. A literal value here would
    // tell the next sync either that a backfill is owed when it isn't, or that
    // it isn't when it is (ADR 0019).
    pullCursorVersion: existingConfig?.pullCursorVersion,
    lastServerUpdatedAt: null,
    lastSuccessfulSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
    autoSyncEnabled: true,
    autoSyncIntervalMinutes: 2,
    localTaskOwnerUserId: authState.userId,
  };
}

/** Persist sync config to IndexedDB after successful OAuth */
export async function persistSyncConfig(authState: AuthState) {
  // Every sync is fenced to the config's userId, so a config without one would
  // cancel each sync without saying why. Refuse to enable it instead.
  if (!authState.userId) {
    throw new Error("The sign-in response did not include an account ID. Please try again.");
  }

  const db = getDb();
  // Resolved before the transaction opens, so nothing but Dexie is awaited inside it.
  const queue = getSyncQueue();
  await db.transaction(
    "rw",
    db.tasks,
    db.archivedTasks,
    db.deletedTasks,
    db.syncMetadata,
    db.syncQueue,
    async () => {
      const existingConfig = (await db.syncMetadata.get("sync_config")) as
        | PBSyncConfig
        | undefined;
      const lifecycleCounts = await Promise.all([
        db.tasks.count(),
        db.archivedTasks.count(),
        db.deletedTasks.count(),
      ]);
      const localTaskOwnerUserId =
        existingConfig?.localTaskOwnerUserId ?? existingConfig?.userId ?? null;

      if (
        lifecycleCounts.some((count) => count > 0) &&
        localTaskOwnerUserId &&
        localTaskOwnerUserId !== authState.userId
      ) {
        throw new Error(
          "Local tasks belong to a different sync account. Reset local data or sign in with the original account before enabling sync. To end that account's sessions on its other devices, sign in with it and choose Sign out of all devices."
        );
      }

      await db.syncMetadata.put(buildSyncConfig(authState, existingConfig));

      // Queue the local tasks in the same transaction. Queued after it commits,
      // a reset could erase the device between the read and the enqueues, and
      // this account's tasks would sit queued for the next account to push.
      await queue.populateFromExistingTasks();
    },
  );
}
