"use client";

import { createPortal } from "react-dom";
import { XIcon, CloudIcon } from "lucide-react";
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

  if (!isOpen || !state.mounted) return null;

  const oauthCallbacks = {
    onStart: state.handleOAuthStart,
    onSuccess: state.handleOAuthSuccess,
    onError: state.handleOAuthError,
  };

  const dialogContent = (
    <>
      <DialogBackdrop onClose={onClose} />

      <div
        className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto p-4"
        onClick={onClose}
      >
        <div
          className="relative my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
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

function DialogBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
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
        <CloudIcon className="h-6 w-6 text-accent" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Sync Settings</h2>
          <p className="text-sm text-foreground-muted">{subtitle}</p>
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
    onStart: () => void;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>
  );
}
