"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { OAuthButtons } from "@/components/sync/oauth-buttons";
import type { LogoutControls } from "@/components/sync/use-logout";
import type { SignOutEverywhereControls } from "@/components/sync/use-sign-out-everywhere";
import type { AuthState, OAuthProvider } from "@/lib/sync/pb-auth";
import type { SyncStatusInfo } from "./use-sync-auth-dialog";

interface OAuthCallbacks {
  onStart: (provider: OAuthProvider) => void;
  onSuccess: (authState: AuthState) => Promise<void>;
  onError: (err: Error) => void;
}

/** Spinner shown while checking session validity */
export function RefreshingSection() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      <span className="ml-3 text-sm text-foreground-muted">Checking session...</span>
    </div>
  );
}

interface SessionExpiredSectionProps {
  syncStatus: SyncStatusInfo;
  error: string | null;
  isLoading: boolean;
  oauthCallbacks: OAuthCallbacks;
  onLogout: () => void;
}

/** UI for when the session token has expired */
export function SessionExpiredSection({
  syncStatus,
  error,
  isLoading,
  oauthCallbacks,
  onLogout,
}: SessionExpiredSectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-status-blocked/45 bg-status-blocked-muted p-4">
        <p className="mb-1 text-sm font-medium text-status-blocked-ink">
          Session expired
        </p>
        <p className="text-sm text-status-blocked-ink">
          Your session for {syncStatus.email} has expired.
          Sign in again to continue syncing.
        </p>
      </div>

      <ErrorMessage error={error} />

      <OAuthButtons
        onStart={oauthCallbacks.onStart}
        onSuccess={oauthCallbacks.onSuccess}
        onError={oauthCallbacks.onError}
      />

      <div className="border-t border-card-border pt-3">
        <Button
          onClick={onLogout}
          disabled={isLoading}
          variant="ghost"
          className="w-full text-sm text-foreground-muted"
        >
          {isLoading ? "Logging out..." : "Disconnect account instead"}
        </Button>
      </div>
    </div>
  );
}

interface AuthenticatedSectionProps {
  syncStatus: SyncStatusInfo;
  error: string | null;
  isLoading: boolean;
  logout: LogoutControls;
  signOutEverywhere: SignOutEverywhereControls;
}

/** UI for when the user is authenticated and sync is active */
export function AuthenticatedSection({
  syncStatus,
  error,
  isLoading,
  logout,
  signOutEverywhere,
}: AuthenticatedSectionProps) {
  return (
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

      <ErrorMessage error={error} />

      <Button
        onClick={logout.handleLogout}
        disabled={isLoading}
        variant="subtle"
        className="w-full"
      >
        {isLoading ? "Logging out..." : "Logout"}
      </Button>

      {logout.showLogoutConfirm && (
        <LogoutConfirmation
          pendingChanges={logout.pendingChanges}
          isLoading={isLoading}
          onCancel={logout.cancelLogout}
          onConfirm={logout.performLogout}
        />
      )}

      <SignOutEverywhereSection controls={signOutEverywhere} isLoading={isLoading} />
    </div>
  );
}

interface UnauthenticatedSectionProps {
  error: string | null;
  oauthCallbacks: OAuthCallbacks;
}

/** UI for when no sync account is connected */
export function UnauthenticatedSection({
  error,
  oauthCallbacks,
}: UnauthenticatedSectionProps) {
  return (
    <>
      <div className="space-y-4">
        <OAuthButtons
          onStart={oauthCallbacks.onStart}
          onSuccess={oauthCallbacks.onSuccess}
          onError={oauthCallbacks.onError}
        />
        <ErrorMessage error={error} />
      </div>

      <div className="mt-6 rounded-lg bg-background-muted p-4 text-sm text-foreground-muted">
        <p className="mb-2 font-medium text-foreground">Cloud sync</p>
        <p>
          Sign in to sync your tasks across devices. Your data is stored on
          your self-hosted PocketBase server.
        </p>
      </div>
    </>
  );
}

interface LogoutConfirmationProps {
  pendingChanges: number;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Warning banner shown when user has unsynced changes */
export function LogoutConfirmation({
  pendingChanges,
  isLoading,
  onCancel,
  onConfirm,
}: LogoutConfirmationProps) {
  const changeLabel = pendingChanges === 1 ? "change" : "changes";

  return (
    <div className="rounded-lg border border-status-blocked/45 bg-status-blocked-muted p-3">
      <p className="mb-2 text-sm font-medium text-status-blocked-ink">
        You have {pendingChanges} unsynchronized {changeLabel}.
        Logging out will discard them.
      </p>
      <ConfirmButtons
        isLoading={isLoading}
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Logout Anyway"
      />
    </div>
  );
}

/** "Sign out of all devices" and its confirmation (SEC-002). */
function SignOutEverywhereSection({
  controls,
  isLoading,
}: {
  controls: SignOutEverywhereControls;
  isLoading: boolean;
}) {
  const panelId = useId();
  const triggerRef = useReturnFocusWhenClosed(controls.showConfirm);

  return (
    <>
      <Button
        ref={triggerRef}
        onClick={controls.onRequest}
        disabled={isLoading}
        variant="ghost"
        className="w-full"
        aria-expanded={controls.showConfirm}
        aria-controls={panelId}
      >
        Sign out of all devices
      </Button>
      {controls.showConfirm && (
        <SignOutEverywhereConfirmation
          id={panelId}
          pendingChanges={controls.pendingChanges}
          isLoading={isLoading}
          onCancel={controls.onCancel}
          onConfirm={controls.onConfirm}
        />
      )}
    </>
  );
}

/** Returns a ref for a trigger, and moves focus back to it when its panel closes. */
function useReturnFocusWhenClosed(open: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return triggerRef;
}

/** Shown every time: ending every session signs out other devices too. */
function SignOutEverywhereConfirmation({
  id,
  pendingChanges,
  isLoading,
  onCancel,
  onConfirm,
}: LogoutConfirmationProps & { id: string }) {
  const changeLabel = pendingChanges === 1 ? "change" : "changes";
  const descriptionId = `${id}-description`;

  return (
    <div
      id={id}
      role="group"
      aria-label="Confirm sign out of all devices"
      aria-describedby={descriptionId}
      className="rounded-lg border border-status-blocked/45 bg-status-blocked-muted p-3"
    >
      <div id={descriptionId} className="mb-2 space-y-2 text-sm text-status-blocked-ink">
        <p>
          This ends every session for this account, on this device and every
          other one, including AI assistants set up with a token from it. Each
          one will need to sign in again.
        </p>
        {pendingChanges > 0 && (
          <p className="font-medium">
            {pendingChanges} unsynchronized {changeLabel} will be discarded.
          </p>
        )}
      </div>
      <ConfirmButtons
        isLoading={isLoading}
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Sign out everywhere"
      />
    </div>
  );
}

/** Cancel and confirm buttons shared by the two sign-out confirmations. */
function ConfirmButtons({
  isLoading,
  onCancel,
  onConfirm,
  confirmLabel,
}: Omit<LogoutConfirmationProps, "pendingChanges"> & { confirmLabel: string }) {
  // A destructive choice opens on its safe answer, so screen readers announce it.
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div className="flex gap-2">
      <Button
        ref={cancelRef}
        variant="subtle"
        onClick={onCancel}
        disabled={isLoading}
        className="flex-1 text-xs"
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={isLoading}
        className="flex-1 text-xs"
      >
        {confirmLabel}
      </Button>
    </div>
  );
}

/** Inline error message banner */
function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div role="alert" className="rounded-lg bg-status-overdue-muted p-3 text-sm text-status-overdue-ink">
      {error}
    </div>
  );
}
