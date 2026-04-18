"use client";

import { useState } from "react";
import { AlertCircle, Check, Cloud, CloudOff, Clock, X as XIcon } from "lucide-react";
import { useSync } from "@/lib/hooks/use-sync";
import { useToast } from "@/components/ui/toast";
import { SyncAuthDialog } from "@/components/sync/sync-auth-dialog";
import { useSyncHealth } from "@/components/sync/use-sync-health";
import { useSyncStatus, type IconType } from "@/components/sync/use-sync-status";
import { SYNC_TOAST_DURATION } from "@/lib/constants/sync";

/**
 * Compact, editorial-styled sync button for the redesign topbar.
 * Reuses the same useSync + useSyncStatus + useSyncHealth hooks that
 * drive the legacy SyncButton — only the rendering differs. Sync lifecycle,
 * retry logic, and auth flow are unchanged.
 */
export function RedesignSyncButton() {
  const { sync, isSyncing, status, error, isEnabled, nextRetryAt } = useSync();
  const { showToast } = useToast();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useSyncHealth({
    isEnabled,
    onHealthIssue: showToast,
    onSync: handleSync,
  });

  const { iconType, tooltip, pendingCount, hasAuthError, retryCountdown } = useSyncStatus({
    isEnabled,
    status,
    error,
    nextRetryAt,
    onAuthError: (message, _action, duration) => {
      showToast(
        message,
        {
          label: "Re-login",
          onClick: () => setAuthDialogOpen(true),
        },
        duration
      );
    },
  });

  async function handleSync() {
    if (!isEnabled) {
      setAuthDialogOpen(true);
      return;
    }
    if (hasAuthError) {
      showToast("Please re-login to continue syncing", undefined, SYNC_TOAST_DURATION.MEDIUM);
      setAuthDialogOpen(true);
      return;
    }
    await sync();
  }

  const icon = getIcon(iconType);
  const dotColor = getDotColor(iconType, hasAuthError);
  const badgeText = hasAuthError ? "!" : pendingCount > 0 ? String(pendingCount) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        title={tooltip}
        aria-label={tooltip}
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "var(--paper)",
          color: "var(--ink-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isSyncing ? "default" : "pointer",
          transition: "background .15s, border-color .15s",
        }}
        onMouseEnter={(e) => {
          if (!isSyncing) e.currentTarget.style.background = "var(--bg-inset)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--paper)";
        }}
      >
        {icon}

        {dotColor && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: dotColor,
              boxShadow: "0 0 0 2px var(--paper)",
            }}
          />
        )}

        {badgeText && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: hasAuthError ? "var(--q1)" : "var(--q2)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {badgeText}
          </span>
        )}

        {!hasAuthError && retryCountdown !== null && retryCountdown > 0 && (
          <span
            className="rd-mono"
            aria-hidden
            style={{
              position: "absolute",
              bottom: -14,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 10,
              color: "var(--q4)",
              fontWeight: 600,
            }}
          >
            {retryCountdown}s
          </span>
        )}
      </button>

      <SyncAuthDialog
        isOpen={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        onSuccess={() => setAuthDialogOpen(false)}
      />
    </>
  );
}

function getIcon(type: IconType) {
  const size = 16;
  switch (type) {
    case "cloud-off":
      return <CloudOff size={size} />;
    case "alert-auth":
      return <AlertCircle size={size} />;
    case "clock":
      return <Clock size={size} />;
    case "cloud-syncing":
      return <Cloud size={size} style={{ animation: "rd-fade-in 1.2s ease-in-out infinite alternate" }} />;
    case "check-success":
      return <Check size={size} />;
    case "x-error":
      return <XIcon size={size} />;
    case "alert-conflict":
      return <AlertCircle size={size} />;
    case "cloud-idle":
    default:
      return <Cloud size={size} />;
  }
}

function getDotColor(type: IconType, hasAuthError: boolean): string | null {
  if (hasAuthError) return null; // badge shows "!" instead
  switch (type) {
    case "cloud-off":
      return "var(--ink-4)";
    case "check-success":
      return "var(--q3)";
    case "x-error":
      return "var(--q1)";
    case "alert-conflict":
      return "var(--q4)";
    case "clock":
      return "var(--q4)";
    default:
      return null;
  }
}
