"use client";

import { useEffect, useState, useRef } from 'react';
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
import { getEnvironmentConfig } from '@/lib/env-config';

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
  // Use ref instead of state for synchronous duplicate state prevention
  const processingStateRef = useRef<string | null>(null);

  async function processAuthData(authData: OAuthAuthData, state: string) {
    // Synchronous duplicate check using ref (React state updates are async/batched)
    if (processingStateRef.current === state) {
      return;
    }

    processingStateRef.current = state;

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

      const { apiBaseUrl } = getEnvironmentConfig();
      const serverUrl = existingSyncConfig?.serverUrl || apiBaseUrl;

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
  }

  useEffect(() => {
    // Handle OAuth error redirect (from worker when state is expired/invalid)
    const oauthError = searchParams.get('oauth_error');
    const oauthMessage = searchParams.get('oauth_message');

    if (oauthError === 'session_expired' && oauthMessage) {
      console.error('[OAuthCallbackHandler] OAuth session expired:', oauthMessage);

      // Check if we're in a popup window (OAuth flow that redirected to main app on error)
      const isPopup = window.opener !== null || window.name.includes('oauth');

      if (isPopup) {
        // Broadcast error to main window via BroadcastChannel
        try {
          const channel = new BroadcastChannel('oauth-handshake');
          channel.postMessage({
            type: 'oauth_handshake',
            success: false,
            error: 'Sign-in session expired. Please try again.',
            timestamp: Date.now(),
          });
          channel.close();
        } catch (e) {
          console.warn('[OAuthCallbackHandler] BroadcastChannel failed:', e);
        }

        // Try to close the popup - the main window will show the error
        try {
          window.close();
        } catch (e) {
          console.warn('[OAuthCallbackHandler] window.close() failed:', e);
        }

        // If popup didn't close, show message to close manually
        setTimeout(() => {
          if (!window.closed) {
            toast.error('Sign-in failed. Please close this window and try again.', {
              duration: 10000,
            });
          }
        }, 100);
      } else {
        // Main window - show toast directly
        toast.error('Sign-in session expired. Please try again.', {
          description: 'This can happen if the sign-in flow was interrupted or took too long.',
          duration: 6000,
        });
      }

      // Clean up URL parameters
      router.replace('/');
      return;
    }

    // Clean query param if present (normal success flow)
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
  }, []);

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
