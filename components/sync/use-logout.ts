"use client";

import { useState } from "react";
import { toast } from "sonner";
import { disableSync, getSyncStatus } from "@/lib/sync/config";

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

  const performLogout = async () => {
    setIsLoading(true);
    try {
      await disableSync();
      onSignedOut();
      setError(null);
      setShowLogoutConfirm(false);
      toast.success("Logged out successfully");
      onSuccess?.();
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
      setIsLoading(false);
    }
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

  const cancelLogout = () => setShowLogoutConfirm(false);

  return { showLogoutConfirm, pendingChanges, handleLogout, performLogout, cancelLogout };
}
