"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getSyncStatus } from "@/lib/sync/config";
import { LocalSignOutIncompleteError, signOutEverywhere } from "@/lib/sync/sign-out-everywhere";
import type { SignOutCallbacks } from "./use-logout";

/** The fallback notice is security information, so it stays up longer than a toast. */
const FALLBACK_NOTICE_MS = 10_000;

export interface SignOutEverywhereControls {
  showConfirm: boolean;
  pendingChanges: number;
  onRequest: () => Promise<void>;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * "Sign out of all devices" (SEC-002). It always asks first, because it signs
 * out every other device and any AI assistant using a token from this account.
 */
export function useSignOutEverywhere({
  onSuccess,
  onSignedOut,
  setIsLoading,
  setError,
}: SignOutCallbacks): SignOutEverywhereControls {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);

  const onRequest = async () => {
    const status = await getSyncStatus();
    setPendingChanges(status.pendingCount);
    setShowConfirm(true);
  };

  const onConfirm = async () => {
    setIsLoading(true);
    try {
      const { otherSessionsEnded } = await signOutEverywhere();
      onSignedOut();
      setError(null);
      if (otherSessionsEnded) {
        toast.success("Signed out of all devices");
      } else {
        toast.warning("Signed out on this device. This server can't end your other sessions.", {
          duration: FALLBACK_NOTICE_MS,
        });
      }
      onSuccess?.();
    } catch (err) {
      setError(signOutEverywhereFailure(err));
    } finally {
      setShowConfirm(false);
      setIsLoading(false);
    }
  };

  const onCancel = () => setShowConfirm(false);

  return { showConfirm, pendingChanges, onRequest, onConfirm, onCancel };
}

function signOutEverywhereFailure(err: unknown): string {
  if (err instanceof LocalSignOutIncompleteError) {
    const prefix = err.otherSessionsEnded ? "Your other devices are signed out, but this" : "This";
    return `${prefix} device couldn't finish signing out. Choose Logout to finish.`;
  }
  const reason = err instanceof Error ? err.message : "Unknown error";
  return `Couldn't sign out of all devices (${reason}). You're still signed in.`;
}
