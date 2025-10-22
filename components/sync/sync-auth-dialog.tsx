"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { XIcon, CloudIcon } from "lucide-react";
import { OAuthButtons } from "@/components/sync/oauth-buttons";
import { EncryptionPassphraseDialog } from "@/components/sync/encryption-passphrase-dialog";
import { isEncryptionConfigured, getCryptoManager, clearCryptoManager } from "@/lib/sync/crypto";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import { subscribeToOAuthHandshake, type OAuthHandshakeEvent } from "@/lib/sync/oauth-handshake";

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
  const [isNewUser, setIsNewUser] = useState(false);
  const [serverEncryptionSalt, setServerEncryptionSalt] = useState<string | null>(null);
  const [activeState, setActiveState] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load sync status when dialog opens
  useEffect(() => {
    const loadStatus = async () => {
      const db = getDb();
      const config = await db.syncMetadata.get("sync_config");

      if (config && config.key === "sync_config") {
        setSyncStatus({
          enabled: !!config.enabled,
          email: config.email || null,
          provider: config.provider || undefined,
        });

        if (config.enabled) {
          const crypto = getCryptoManager();
          const hasConfig = await isEncryptionConfigured();

          if (hasConfig && !crypto.isInitialized()) {
            setIsNewUser(false);
            setServerEncryptionSalt(null);
            setShowEncryptionDialog(true);
            toast.info("Please enter your encryption passphrase to unlock sync.");
          }
        }
      } else {
        setSyncStatus({ enabled: false, email: null });
      }
    };

    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  // Listen for OAuth handshake results while dialog is open
  useEffect(() => {
    if (!mounted) return;

    const unsubscribe = subscribeToOAuthHandshake(async (event: OAuthHandshakeEvent) => {
      if (!isOpen) {
        return;
      }

      if (event.status === "success") {
        setActiveState(event.state);
        setIsLoading(false);
        setError(null);

        setSyncStatus({
          enabled: true,
          email: event.authData.email,
          provider: event.authData.provider,
        });

        toast.success(`Signed in as ${event.authData.email}. Finishing setup...`);

        // Refresh status once global handler persists configuration
        setTimeout(async () => {
          const db = getDb();
          const config = await db.syncMetadata.get("sync_config");
          if (config && config.key === "sync_config") {
            setSyncStatus({
              enabled: !!config.enabled,
              email: config.email || null,
              provider: config.provider || undefined,
            });
          }
        }, 600);

        if (onSuccess) {
          onSuccess();
        }
      } else {
        if (activeState && activeState !== event.state) {
          return;
        }

        setIsLoading(false);
        setError(event.error);
        toast.error(event.error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeState, isOpen, mounted, onSuccess]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const db = getDb();

      await db.syncMetadata.delete("sync_config");
      await db.syncMetadata.delete("encryption_salt");

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

  const handleEncryptionComplete = async () => {
    setShowEncryptionDialog(false);

    const db = getDb();
    const config = await db.syncMetadata.get("sync_config");

    if (config && config.key === "sync_config") {
      setSyncStatus({
        enabled: !!config.enabled,
        email: config.email || null,
        provider: config.provider || undefined,
      });
    }

    toast.success("Encryption unlocked. You can close this dialog.");

    if (onSuccess) {
      onSuccess();
    }
  };

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto p-4"
        onClick={onClose}
      >
        <div
          className="relative my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
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
              <div className="space-y-4">
                <OAuthButtons
                  onStart={() => {
                    setError(null);
                    setIsLoading(true);
                  }}
                />

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-lg bg-background-muted p-4 text-sm text-foreground-muted">
                <p className="mb-2 font-medium text-foreground">🔐 End-to-end encrypted</p>
                <p>
                  Your tasks are encrypted on your device before syncing. After signing in,
                  you&apos;ll create a separate encryption passphrase for maximum security.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <EncryptionPassphraseDialog
        isOpen={showEncryptionDialog}
        isNewUser={isNewUser}
        onComplete={handleEncryptionComplete}
        onCancel={() => {
          setShowEncryptionDialog(false);
        }}
        serverEncryptionSalt={serverEncryptionSalt}
      />

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      )}
    </>
  );

  return createPortal(dialogContent, document.body);
}
