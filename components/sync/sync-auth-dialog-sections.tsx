"use client";

import { Button } from "@/components/ui/button";
import { OAuthButtons } from "@/components/sync/oauth-buttons";
import type { AuthState } from "@/lib/sync/pb-auth";
import type { SyncStatusInfo } from "./use-sync-auth-dialog";

interface OAuthCallbacks {
  onStart: () => void;
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="mb-1 text-sm font-medium text-amber-700 dark:text-amber-400">
          Session expired
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-300">
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
  showLogoutConfirm: boolean;
  pendingChanges: number;
  onLogout: () => void;
  onPerformLogout: () => void;
  onCancelLogout: () => void;
}

/** UI for when the user is authenticated and sync is active */
export function AuthenticatedSection({
  syncStatus,
  error,
  isLoading,
  showLogoutConfirm,
  pendingChanges,
  onLogout,
  onPerformLogout,
  onCancelLogout,
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
        onClick={onLogout}
        disabled={isLoading}
        variant="subtle"
        className="w-full"
      >
        {isLoading ? "Logging out..." : "Logout"}
      </Button>

      {showLogoutConfirm && (
        <LogoutConfirmation
          pendingChanges={pendingChanges}
          isLoading={isLoading}
          onCancel={onCancelLogout}
          onConfirm={onPerformLogout}
        />
      )}
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
function LogoutConfirmation({
  pendingChanges,
  isLoading,
  onCancel,
  onConfirm,
}: LogoutConfirmationProps) {
  const changeLabel = pendingChanges === 1 ? "change" : "changes";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
      <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        You have {pendingChanges} unsynchronized {changeLabel}.
        Logging out will discard them.
      </p>
      <div className="flex gap-2">
        <Button
          variant="subtle"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 text-xs"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 bg-red-600 hover:bg-red-700 text-xs"
        >
          Logout Anyway
        </Button>
      </div>
    </div>
  );
}

/** Inline error message banner */
function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
      {error}
    </div>
  );
}
