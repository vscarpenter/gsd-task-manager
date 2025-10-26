"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDb } from '@/lib/db';
import { toast } from 'sonner';
import { EncryptionPassphraseDialog } from '@/components/sync/encryption-passphrase-dialog';
import { isEncryptionConfigured } from '@/lib/sync/crypto';
import {
  subscribeToOAuthHandshake,
  type OAuthHandshakeEvent,
  type OAuthAuthData,
} from '@/lib/sync/oauth-handshake';
import { normalizeTokenExpiration } from '@/lib/sync/utils';

/**
 * OAuth callback handler - processes OAuth success data from sessionStorage
 * This component runs on every page load and checks for the oauth_complete query param
 */
export function OAuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [serverEncryptionSalt, setServerEncryptionSalt] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<string | null>(null);

  useEffect(() => {
    // Clean query param if present
    if (searchParams.get('oauth_complete') === 'true') {
      router.replace('/');
    }
  }, [searchParams, router]);

  useEffect(() => {
    const unsubscribe = subscribeToOAuthHandshake(async (event: OAuthHandshakeEvent) => {
      if (event.status === 'success') {
        await processAuthData(event.authData, event.state);
      } else {
        console.error('[OAuthCallbackHandler] OAuth handshake error:', {
          state: event.state.substring(0, 8) + '...',
          error: event.error,
        });
        toast.error(event.error || 'Sign in failed. Please try again.');
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processAuthData = async (authData: OAuthAuthData, state: string) => {
    if (processingState === state) {
      return;
    }

    setProcessingState(state);

    try {
      console.log('[OAuthCallbackHandler] Processing OAuth handshake result:', {
        state: state.substring(0, 8) + '...',
        email: authData.email,
        provider: authData.provider,
      });

      toast.info(`Processing OAuth for ${authData.email}...`);

      const db = getDb();

      const existingConfig = await db.syncMetadata.get('sync_config');
      const existingSyncConfig =
        existingConfig && existingConfig.key === 'sync_config' ? existingConfig : null;

      const serverUrl =
        existingSyncConfig?.serverUrl ||
        (window.location.hostname === 'localhost'
          ? 'http://localhost:8787'
          : window.location.origin);

      // Normalize token expiration to milliseconds (handles both seconds and milliseconds)
      const tokenExpiresAt = normalizeTokenExpiration(authData.expiresAt);

      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: true,
        userId: authData.userId,
        deviceId: authData.deviceId,
        deviceName: existingSyncConfig?.deviceName || 'Device',
        email: authData.email,
        token: authData.token,
        tokenExpiresAt,
        lastSyncAt: existingSyncConfig?.lastSyncAt || null,
        vectorClock: existingSyncConfig?.vectorClock || {},
        conflictStrategy: existingSyncConfig?.conflictStrategy || 'last_write_wins',
        serverUrl,
        provider: authData.provider,
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      console.log('[OAuthCallbackHandler] Stored sync config in IndexedDB:', {
        userId: authData.userId,
        email: authData.email,
        serverUrl,
      });

      setServerEncryptionSalt(authData.encryptionSalt || null);

      const hasEncryption = await isEncryptionConfigured();

      if (authData.requiresEncryptionSetup || !hasEncryption) {
        console.log('[OAuthCallbackHandler] Showing encryption setup dialog (new user)');
        setIsNewUser(true);
        setShowEncryptionDialog(true);
      } else {
        console.log('[OAuthCallbackHandler] Showing encryption unlock dialog (existing user)');
        setIsNewUser(false);
        setShowEncryptionDialog(true);
      }

      toast.success('Sync enabled successfully! Finish encryption setup to start syncing.');
    } catch (err) {
      console.error('[OAuthCallbackHandler] Error storing sync config:', err);
      toast.error(
        `Failed to process OAuth callback: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    }
  };

  return (
    <>
      {/* Encryption Passphrase Dialog */}
      <EncryptionPassphraseDialog
        isOpen={showEncryptionDialog}
        isNewUser={isNewUser}
        onComplete={() => {
          console.log('[OAuthCallbackHandler] Encryption setup complete, closing dialog');
          setShowEncryptionDialog(false);
          toast.success('Sync enabled successfully! The sync button should update shortly.');
          router.replace('/');
        }}
        onCancel={() => {
          setShowEncryptionDialog(false);
        }}
        serverEncryptionSalt={serverEncryptionSalt}
      />
    </>
  );
}
