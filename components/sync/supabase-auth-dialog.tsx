"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { XIcon, CloudIcon } from "lucide-react";
import { SupabaseOAuthButtons } from "@/components/sync/supabase-oauth-buttons";
import { EncryptionPassphraseDialog } from "@/components/sync/encryption-passphrase-dialog";
import { isEncryptionConfigured, getCryptoManager, clearCryptoManager } from "@/lib/sync/crypto";
import { getEncryptionSalt } from "@/lib/sync/supabase-sync-client";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { SyncConfig } from "@/lib/sync/types";

interface SupabaseAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SupabaseAuthDialog({ isOpen, onClose, onSuccess }: SupabaseAuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    enabled: boolean;
    email: string | null;
    provider?: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [serverEncryptionSalt, setServerEncryptionSalt] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load sync status when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadStatus = async () => {
      const db = getDb();
      const config = await db.syncMetadata.get("sync_config");

      if (cancelled) return;

      if (config && config.key === "sync_config") {
        setSyncStatus({
          enabled: !!config.enabled,
          email: config.email || null,
          provider: config.provider || undefined,
        });

        // If sync is enabled but crypto isn't initialized, prompt for passphrase
        if (config.enabled) {
          const cryptoMgr = getCryptoManager();
          if (cryptoMgr.isInitialized()) return; // Already good

          const hasLocalConfig = await isEncryptionConfigured();

          if (hasLocalConfig) {
            // Returning user on same device — just need passphrase
            await new Promise(resolve => setTimeout(resolve, 300));
            if (cancelled || cryptoMgr.isInitialized()) return;

            setIsNewUser(false);
            setServerEncryptionSalt(null);
            setShowEncryptionDialog(true);
            toast.info("Please enter your encryption passphrase to unlock sync.");
          } else {
            // No local encryption config — check server for existing salt
            const userId = config.userId;
            if (!userId) return;

            const remoteSalt = await getEncryptionSalt(userId);
            if (cancelled) return;

            if (remoteSalt) {
              // Returning user on new device — need passphrase + salt from server
              setIsNewUser(false);
              setServerEncryptionSalt(remoteSalt);
            } else {
              // Brand new user — need to create passphrase + salt
              setIsNewUser(true);
              setServerEncryptionSalt(null);
            }
            setShowEncryptionDialog(true);
          }
        }
      } else {
        setSyncStatus({ enabled: false, email: null });
      }
    };

    loadStatus();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!mounted || !isOpen || !isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user;
          const provider = user.app_metadata?.provider ?? 'unknown';
          const email = user.email ?? '';

          setIsLoading(false);
          setError(null);
          setSyncStatus({ enabled: true, email, provider });

          // Persist to IndexedDB sync config
          const db = getDb();
          const existing = await db.syncMetadata.get("sync_config") as SyncConfig | undefined;
          const deviceId = existing?.deviceId ?? crypto.randomUUID();
          const deviceName = existing?.deviceName ?? (navigator?.userAgent?.includes('Mac') ? 'Mac' : 'Desktop');

          await db.syncMetadata.put({
            key: "sync_config",
            enabled: true,
            userId: user.id,
            deviceId,
            deviceName,
            email,
            lastSyncAt: null,
            conflictStrategy: "last_write_wins",
            provider,
            consecutiveFailures: 0,
            lastFailureAt: null,
            lastFailureReason: null,
            nextRetryAt: null,
            autoSyncEnabled: true,
            autoSyncIntervalMinutes: 2,
          } satisfies SyncConfig);

          toast.success(`Signed in as ${email}. Setting up encryption...`);

          // Check server for existing encryption salt
          const remoteSalt = await getEncryptionSalt(user.id);
          const hasLocalConfig = await isEncryptionConfigured();

          if (remoteSalt && hasLocalConfig) {
            // Returning user on same device — just need passphrase
            setIsNewUser(false);
            setServerEncryptionSalt(remoteSalt);
          } else if (remoteSalt && !hasLocalConfig) {
            // Returning user on new device — need passphrase + download salt
            setIsNewUser(false);
            setServerEncryptionSalt(remoteSalt);
          } else {
            // Brand new user — need to create passphrase + salt
            setIsNewUser(true);
            setServerEncryptionSalt(null);
          }

          setShowEncryptionDialog(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [mounted, isOpen]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();

      const db = getDb();
      await db.syncMetadata.delete("sync_config");
      await db.syncMetadata.delete("encryption_salt");
      clearCryptoManager();

      setSyncStatus({ enabled: false, email: null });
      setError(null);
      toast.success("Logged out successfully");
      onSuccess?.();
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

    toast.success("Encryption unlocked. Sync is ready.");
    onSuccess?.();
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

          {!isSupabaseConfigured() ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                <p className="mb-2 font-medium">Supabase not configured</p>
                <p>
                  Cloud sync requires Supabase environment variables. Add the following
                  to your <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">.env.local</code> file:
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-yellow-100 p-2 text-xs dark:bg-yellow-900/40">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here`}
                </pre>
                <p className="mt-2">Then restart the dev server.</p>
              </div>
            </div>
          ) : syncStatus?.enabled ? (
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
                <SupabaseOAuthButtons
                  onStart={() => {
                    setError(null);
                    setIsLoading(true);
                  }}
                  onError={(err) => {
                    setIsLoading(false);
                    setError(err.message);
                  }}
                />

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-lg bg-background-muted p-4 text-sm text-foreground-muted">
                <p className="mb-2 font-medium text-foreground">End-to-end encrypted</p>
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
        onCancel={() => setShowEncryptionDialog(false)}
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
