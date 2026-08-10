"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { XIcon, CloudIcon } from "lucide-react";
import { useDialogFocus } from "@/components/matrix-simplified/use-dialog-focus";
import { useSyncAuthDialog } from "./use-sync-auth-dialog";
import {
  RefreshingSection,
  SessionExpiredSection,
  AuthenticatedSection,
  UnauthenticatedSection,
} from "./sync-auth-dialog-sections";

interface SyncAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SyncAuthDialog({ isOpen, onClose, onSuccess }: SyncAuthDialogProps) {
  const state = useSyncAuthDialog({ isOpen, onSuccess });
  const { dialogRef, handleKeyDown } = useSyncDialogFocus(isOpen && state.mounted, onClose);

  if (!isOpen || !state.mounted) return null;

  const oauthCallbacks = getOAuthCallbacks(state);

  const dialogContent = (
    <>
      <DialogBackdrop onClose={onClose} />

      <div
        className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-auth-dialog-title"
          className="relative my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-[var(--shadow-lg)]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <DialogHeader
            syncStatus={state.syncStatus}
            sessionExpired={state.sessionExpired}
            onClose={onClose}
          />

          <DialogBody
            state={state}
            oauthCallbacks={oauthCallbacks}
          />
        </div>
      </div>

      {state.isLoading && <LoadingOverlay />}
    </>
  );

  return createPortal(dialogContent, document.body);
}

function getOAuthCallbacks(state: ReturnType<typeof useSyncAuthDialog>) {
  return {
    onStart: state.handleOAuthStart,
    onSuccess: state.handleOAuthSuccess,
    onError: state.handleOAuthError,
  };
}

function useSyncDialogFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapTab = useDialogFocus(open, dialogRef);

  useEffect(() => {
    if (open) {
      dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    }
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    trapTab(event);
  };

  return { dialogRef, handleKeyDown };
}

function DialogBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

interface DialogHeaderProps {
  syncStatus: ReturnType<typeof useSyncAuthDialog>["syncStatus"];
  sessionExpired: boolean;
  onClose: () => void;
}

function DialogHeader({ syncStatus, sessionExpired, onClose }: DialogHeaderProps) {
  const subtitle = getSubtitle(syncStatus, sessionExpired);

  return (
    <div className="mb-6 flex items-start justify-between">
      <div className="flex items-center gap-3">
        <CloudIcon className="h-6 w-6 text-accent" aria-hidden="true" />
        <div>
          <h2 id="sync-auth-dialog-title" className="text-xl font-semibold text-foreground">
            Sync Settings
          </h2>
          <p className="text-sm text-foreground-muted">{subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        data-dialog-initial-focus
        className="rounded-md p-1 text-foreground-muted hover:bg-background-muted hover:text-foreground"
        aria-label="Close"
      >
        <XIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function getSubtitle(
  syncStatus: ReturnType<typeof useSyncAuthDialog>["syncStatus"],
  sessionExpired: boolean
): string {
  if (syncStatus?.enabled && sessionExpired) return "Session expired";
  if (syncStatus?.enabled) return "Manage your sync account";
  return "Enable cloud sync";
}

interface DialogBodyProps {
  state: ReturnType<typeof useSyncAuthDialog>;
  oauthCallbacks: {
    onStart: (provider: "google" | "github") => void;
    onSuccess: ReturnType<typeof useSyncAuthDialog>["handleOAuthSuccess"];
    onError: (err: Error) => void;
  };
}

function DialogBody({ state, oauthCallbacks }: DialogBodyProps) {
  if (state.isRefreshing) {
    return <RefreshingSection />;
  }

  if (state.syncStatus?.enabled && state.sessionExpired) {
    return (
      <SessionExpiredSection
        syncStatus={state.syncStatus}
        error={state.error}
        isLoading={state.isLoading}
        oauthCallbacks={oauthCallbacks}
        onLogout={state.handleLogout}
      />
    );
  }

  if (state.syncStatus?.enabled) {
    return (
      <AuthenticatedSection
        syncStatus={state.syncStatus}
        error={state.error}
        isLoading={state.isLoading}
        showLogoutConfirm={state.showLogoutConfirm}
        pendingChanges={state.pendingChanges}
        onLogout={state.handleLogout}
        onPerformLogout={state.performLogout}
        onCancelLogout={state.cancelLogout}
      />
    );
  }

  return (
    <UnauthenticatedSection
      error={state.error}
      oauthCallbacks={oauthCallbacks}
    />
  );
}

function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading sync settings</span>
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
