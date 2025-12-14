"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon, LockIcon, AlertTriangleIcon } from "lucide-react";
import {
  generateEncryptionSalt,
  storeEncryptionConfig,
  initializeEncryptionFromPassphrase,
} from "@/lib/sync/crypto";
import { ENCRYPTION_CONFIG } from "@/lib/constants/sync";

// ============================================================================
// Validation & Error Handling Helpers
// ============================================================================

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate passphrase meets requirements */
function validatePassphrase(
  passphrase: string,
  confirmPassphrase: string,
  isNewUser: boolean
): ValidationResult {
  if (isNewUser && passphrase !== confirmPassphrase) {
    return { valid: false, error: "Passphrases do not match" };
  }
  if (passphrase.length < ENCRYPTION_CONFIG.PASSPHRASE_MIN_LENGTH) {
    return { valid: false, error: `Passphrase must be at least ${ENCRYPTION_CONFIG.PASSPHRASE_MIN_LENGTH} characters` };
  }
  return { valid: true };
}

/** Get appropriate error message for encryption setup failure */
function getEncryptionErrorMessage(isNewUser: boolean): string {
  return isNewUser
    ? "Failed to create encryption passphrase"
    : "Incorrect passphrase";
}

// ============================================================================
// Salt Management Helpers
// ============================================================================

/** Parse salt from server string or generate new salt */
function getOrCreateSalt(serverEncryptionSalt?: string | null): Uint8Array {
  if (serverEncryptionSalt) {
    const saltArray = serverEncryptionSalt.split(',').map(Number);
    return new Uint8Array(saltArray);
  }
  return generateEncryptionSalt();
}

/** Build API URL for encryption salt endpoint */
function buildSaltApiUrl(): string {
  return window.location.hostname === 'localhost'
    ? 'http://localhost:8787/api/auth/encryption-salt'
    : `${window.location.origin}/api/auth/encryption-salt`;
}

/** Upload salt to server for new users */
async function uploadSaltToServer(salt: Uint8Array): Promise<void> {
  const { getDb } = await import('@/lib/db');
  const db = getDb();
  const config = await db.syncMetadata.get('sync_config');

  if (config && config.key === 'sync_config' && config.token) {
    const saltString = Array.from(salt).join(',');
    await fetch(buildSaltApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
      body: JSON.stringify({ encryptionSalt: saltString }),
    });
  }
}

// ============================================================================
// Post-Setup Sync Helpers
// ============================================================================

/** Queue existing tasks for sync and trigger auto-sync */
async function queueAndTriggerSync(syncTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>): Promise<void> {
  const { getSyncEngine } = await import('@/lib/sync/engine');
  const engine = getSyncEngine();
  const queuedCount = await engine.queueExistingTasks();

  if (queuedCount > 0) {
    console.log(`[SYNC] Queued ${queuedCount} existing tasks for initial sync`);

    const { toast } = await import('sonner');
    toast.success(`${queuedCount} task${queuedCount === 1 ? '' : 's'} queued for sync`);

    // Trigger automatic sync after dialog close animation
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const { getSyncCoordinator } = await import('@/lib/sync/sync-coordinator');
        const coordinator = getSyncCoordinator();
        await coordinator.requestSync('auto');
      } catch (err) {
        console.error('[SYNC] Auto-sync after encryption setup failed:', err);
      }
    }, ENCRYPTION_CONFIG.AUTO_SYNC_DELAY_MS);
  }
}

/** Handle task queueing errors gracefully */
async function handleQueueError(err: unknown): Promise<void> {
  console.error('[SYNC] Failed to queue existing tasks:', err);
  const { toast } = await import('sonner');
  toast.error('Failed to queue tasks for sync. You can manually sync from Settings.', {
    duration: 5000,
  });
}

interface EncryptionPassphraseDialogProps {
  isOpen: boolean;
  isNewUser: boolean; // true = create new passphrase, false = enter existing
  onComplete: () => void;
  onCancel?: () => void;
  serverEncryptionSalt?: string | null; // Salt from server (existing user on new device)
}

export function EncryptionPassphraseDialog({
  isOpen,
  isNewUser,
  onComplete,
  onCancel,
  serverEncryptionSalt,
}: EncryptionPassphraseDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure we're mounted on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passphrase
    const validation = validatePassphrase(passphrase, confirmPassphrase, isNewUser);
    if (!validation.valid) {
      setError(validation.error ?? "Validation failed");
      return;
    }

    setIsLoading(true);

    try {
      if (isNewUser) {
        await setupNewUserEncryption();
      } else {
        const success = await initializeEncryptionFromPassphrase(passphrase);
        if (!success) {
          setError("Incorrect passphrase or encryption not set up");
          setIsLoading(false);
          return;
        }
      }

      // Queue existing tasks for initial sync (new users only)
      if (isNewUser) {
        try {
          await queueAndTriggerSync(syncTimeoutRef);
        } catch (err) {
          await handleQueueError(err);
        }
      }

      setPassphrase("");
      setConfirmPassphrase("");
      onComplete();
    } catch (err) {
      console.error("Encryption setup error:", err);
      setError(getEncryptionErrorMessage(isNewUser));
    } finally {
      setIsLoading(false);
    }
  };

  /** Set up encryption for new users - creates or fetches salt, uploads if needed */
  const setupNewUserEncryption = async (): Promise<void> => {
    const salt = getOrCreateSalt(serverEncryptionSalt);

    // Upload salt to server if this is a truly new user (no existing salt)
    if (!serverEncryptionSalt) {
      await uploadSaltToServer(salt);
    }

    await storeEncryptionConfig(passphrase, salt);
  };

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog Container */}
      <div
        className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto p-4"
        onClick={onCancel}
      >
        {/* Dialog */}
        <div
          className="relative my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <LockIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {isNewUser
                    ? "Create Encryption Passphrase"
                    : "Enter Encryption Passphrase"}
                </h2>
                <p className="text-sm text-foreground-muted">
                  {isNewUser
                    ? "Secure your synced tasks"
                    : "Unlock your encrypted tasks"}
                </p>
              </div>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="rounded-md p-1 text-foreground-muted hover:bg-background-muted hover:text-foreground"
                aria-label="Close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="passphrase"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                {isNewUser ? "Create Passphrase" : "Enter Passphrase"}
              </label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={`Minimum ${ENCRYPTION_CONFIG.PASSPHRASE_MIN_LENGTH} characters`}
                disabled={isLoading}
                required
                minLength={ENCRYPTION_CONFIG.PASSPHRASE_MIN_LENGTH}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            {isNewUser && (
              <div>
                <label
                  htmlFor="confirmPassphrase"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Confirm Passphrase
                </label>
                <Input
                  id="confirmPassphrase"
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter your passphrase"
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Warning */}
            <div className="rounded-lg bg-amber-50 p-4 text-sm dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                <div className="space-y-1 text-amber-900 dark:text-amber-100">
                  <p className="font-medium">Important:</p>
                  <ul className="list-inside list-disc space-y-1 text-amber-700 dark:text-amber-200">
                    <li>
                      {isNewUser
                        ? "Store this passphrase in a safe place (password manager recommended)"
                        : "Your passphrase decrypts your tasks on this device"}
                    </li>
                    <li>
                      {isNewUser
                        ? "If you forget it, your encrypted data cannot be recovered"
                        : "You'll need to enter it each time you sign in on a new device"}
                    </li>
                    <li>This passphrase never leaves your device</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {onCancel && (
                <Button
                  type="button"
                  onClick={onCancel}
                  variant="subtle"
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading
                  ? isNewUser
                    ? "Creating..."
                    : "Unlocking..."
                  : isNewUser
                  ? "Create Passphrase"
                  : "Unlock"}
              </Button>
            </div>
          </form>

          {/* Info */}
          {isNewUser && (
            <div className="mt-6 rounded-lg bg-background-muted p-4 text-sm text-foreground-muted">
              <p className="mb-2 font-medium text-foreground">
                Why a separate passphrase?
              </p>
              <p>
                Your tasks are encrypted end-to-end. Since you&apos;re using Google/Apple
                Sign-In (no password), we need a separate passphrase to encrypt your
                data. This ensures true zero-knowledge encryption where only you can
                decrypt your tasks.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
}
