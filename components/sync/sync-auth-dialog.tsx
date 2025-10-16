"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { XIcon, CloudIcon } from "lucide-react";
import { OAuthButtons } from "@/components/sync/oauth-buttons";
import { EncryptionPassphraseDialog } from "@/components/sync/encryption-passphrase-dialog";
import { isEncryptionConfigured } from "@/lib/sync/crypto";
import { toast } from "sonner";

interface SyncAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SyncAuthDialog({ isOpen, onClose, onSuccess }: SyncAuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ enabled: boolean; email: string | null; provider?: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);
  const [pendingOAuthData, setPendingOAuthData] = useState<any>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Ensure we're mounted on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load sync status when dialog opens
  useEffect(() => {
    const loadStatus = async () => {
      // Get sync config from IndexedDB
      const { getDb } = await import('@/lib/db');
      const db = await getDb();
      const config = await db.syncMetadata.get('sync_config');

      setSyncStatus({
        enabled: !!config?.value?.enabled,
        email: config?.value?.email || null,
        provider: config?.value?.provider || null,
      });
    };
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const handleOAuthSuccess = async (authData: any) => {
    try {
      // Store auth data in IndexedDB
      const { getDb } = await import('@/lib/db');
      const db = await getDb();

      await db.syncMetadata.put({
        key: 'sync_config',
        value: {
          enabled: true,
          userId: authData.userId,
          deviceId: authData.deviceId,
          email: authData.email,
          token: authData.token,
          expiresAt: authData.expiresAt,
          provider: authData.provider,
        },
      });

      // Check if user needs to set up encryption
      const hasEncryption = await isEncryptionConfigured();

      if (authData.requiresEncryptionSetup || !hasEncryption) {
        // New user - show encryption passphrase dialog
        setIsNewUser(true);
        setPendingOAuthData(authData);
        setShowEncryptionDialog(true);
      } else {
        // Existing user - show encryption passphrase dialog to unlock
        setIsNewUser(false);
        setPendingOAuthData(authData);
        setShowEncryptionDialog(true);
      }
    } catch (err) {
      console.error("OAuth success handler error:", err);
      setError(err instanceof Error ? err.message : "Failed to save authentication");
    }
  };

  const handleOAuthError = (error: Error) => {
    setError(error.message);
    toast.error(`Sign in failed: ${error.message}`);
  };

  const handleEncryptionComplete = async () => {
    // Encryption setup complete
    setShowEncryptionDialog(false);
    setPendingOAuthData(null);

    // Reload sync status
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const config = await db.syncMetadata.get('sync_config');

    setSyncStatus({
      enabled: !!config?.value?.enabled,
      email: config?.value?.email || null,
      provider: config?.value?.provider || null,
    });

    toast.success("Sync enabled successfully!");

    if (onSuccess) {
      onSuccess();
    }

    onClose();
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      // Disable sync and clear data
      const { getDb } = await import('@/lib/db');
      const db = await getDb();

      await db.syncMetadata.delete('sync_config');
      await db.syncMetadata.delete('encryption_salt');

      // Clear crypto manager
      const { clearCryptoManager } = await import('@/lib/sync/crypto');
      clearCryptoManager();

      setSyncStatus({ enabled: false, email: null });
      setError(null);

      toast.success("Logged out successfully");

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Container */}
      <div
        className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto p-4"
        onClick={onClose}
      >
        {/* Dialog */}
        <div
          className="relative my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <CloudIcon className="h-6 w-6 text-accent" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Sync Settings</h2>
              <p className="text-sm text-foreground-muted">
                {syncStatus?.enabled ? "Manage your sync account" : "Enable cloud sync"}
              </p>
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

        {/* Already logged in */}
        {syncStatus?.enabled ? (
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

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <Button
              onClick={handleLogout}
              disabled={isLoading}
              variant="subtle"
              className="w-full"
            >
              {isLoading ? "Logging out..." : "Logout"}
            </Button>
          </div>
        ) : (
          <>
            {/* OAuth Buttons */}
            <div className="space-y-4">
              <OAuthButtons
                onSuccess={handleOAuthSuccess}
                onError={handleOAuthError}
              />

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-6 rounded-lg bg-background-muted p-4 text-sm text-foreground-muted">
              <p className="mb-2 font-medium text-foreground">🔐 End-to-end encrypted</p>
              <p>
                Your tasks are encrypted on your device before syncing. After signing in,
                you'll create a separate encryption passphrase for maximum security.
              </p>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Encryption Passphrase Dialog */}
      <EncryptionPassphraseDialog
        isOpen={showEncryptionDialog}
        isNewUser={isNewUser}
        onComplete={handleEncryptionComplete}
        onCancel={() => {
          setShowEncryptionDialog(false);
          setPendingOAuthData(null);
        }}
      />
    </>
  );

  return createPortal(dialogContent, document.body);
}
