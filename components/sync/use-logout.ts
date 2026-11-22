"use client";

import { useState } from "react";
import { toast } from "sonner";
import { disableSync, getSyncStatus } from "@/lib/sync/config";
import { UnsyncedChangesError } from "@/lib/sync/config/disable";

export interface LogoutControls {
  showLogoutConfirm: boolean;
  pendingChanges: number;
  handleLogout: () => Promise<void>;
  performLogout: () => Promise<void>;
  cancelLogout: () => void;
}

export interface SignOutCallbacks {
  onSuccess?: () => void;
  onSignedOut: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/** Sign out on this device. Asks first only when unsynced changes would be lost. */
export function useLogout({
  onSuccess,
  onSignedOut,
  setIsLoading,
  setError,
}: SignOutCallbacks): LogoutControls {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);

  const askFirst = (count: number) => {
    setError(null);
    setPendingChanges(count);
    setShowLogoutConfirm(true);
  };

  const signOut = async (agreedToLose: number) => {
    setIsLoading(true);
    try {
      await disableSync(agreedToLose);
      onSignedOut();
      setError(null);
      setShowLogoutConfirm(false);
      toast.success("Logged out successfully");
      onSuccess?.();
      setIsLoading(false);
    } catch (err) {
      if (err instanceof UnsyncedChangesError) askFirst(err.count);
      else setError(err instanceof Error ? err.message : "Logout failed");
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const status = await getSyncStatus();
    if (status.pendingCount > 0) askFirst(status.pendingCount);
    else await signOut(0);
  };

  const performLogout = () => signOut(pendingChanges);

  const cancelLogout = () => setShowLogoutConfirm(false);

  return { showLogoutConfirm, pendingChanges, handleLogout, performLogout, cancelLogout };
}
