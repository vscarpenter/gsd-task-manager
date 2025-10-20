"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDb } from '@/lib/db';
import { toast } from 'sonner';
import { EncryptionPassphraseDialog } from '@/components/sync/encryption-passphrase-dialog';
import { isEncryptionConfigured } from '@/lib/sync/crypto';

interface OAuthData {
  userId: string;
  deviceId: string;
  email: string;
  token: string;
  expiresAt: number;
  requiresEncryptionSetup?: boolean;
  encryptionSalt?: string;
  provider: string;
  state: string;
}

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

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if we're returning from OAuth
      const oauthComplete = searchParams.get('oauth_complete');

      console.log('[OAuthCallbackHandler] Mounted, oauth_complete =', oauthComplete);

      if (oauthComplete !== 'true') {
        return;
      }

      try {
        // Read OAuth success data from sessionStorage
        const oauthSuccessData = sessionStorage.getItem('oauth_success');
        console.log('[OAuthCallbackHandler] sessionStorage oauth_success =', oauthSuccessData ? 'FOUND' : 'NOT FOUND');

        if (!oauthSuccessData) {
          console.warn('[OAuthCallbackHandler] No oauth_success data in sessionStorage');
          toast.error('OAuth data not found in sessionStorage');
          // Clear the query param
          router.replace('/');
          return;
        }

        // Parse the OAuth data
        const authData: OAuthData = JSON.parse(oauthSuccessData);
        console.log('[OAuthCallbackHandler] Processing auth data for user', authData.email);
        toast.info(`Processing OAuth for ${authData.email}...`);

        // Store auth data in IndexedDB
        const db = getDb();

        // Get existing config to preserve fields like vectorClock, serverUrl, etc.
        const existingConfig = await db.syncMetadata.get('sync_config');
        const existingSyncConfig = existingConfig && existingConfig.key === 'sync_config' ? existingConfig : null;

        // Use same-origin for deployed environments (CloudFront will proxy /api/* to worker)
        const serverUrl = existingSyncConfig?.serverUrl || (
          window.location.hostname === 'localhost'
            ? 'http://localhost:8787'
            : window.location.origin
        );

        await db.syncMetadata.put({
          key: 'sync_config',
          enabled: true,
          userId: authData.userId,
          deviceId: authData.deviceId,
          deviceName: existingSyncConfig?.deviceName || 'Device',
          email: authData.email,
          token: authData.token,
          tokenExpiresAt: authData.expiresAt,
          lastSyncAt: existingSyncConfig?.lastSyncAt || null,
          vectorClock: existingSyncConfig?.vectorClock || {},
          conflictStrategy: existingSyncConfig?.conflictStrategy || 'last_write_wins',
          serverUrl,
          provider: authData.provider,
        });

        console.log('[OAuthCallbackHandler] Stored sync config in IndexedDB:', {
          userId: authData.userId,
          email: authData.email,
          serverUrl,
        });

        // Check if user needs to set up encryption
        const hasEncryption = await isEncryptionConfigured();

        // Store encryption salt from server if available
        setServerEncryptionSalt(authData.encryptionSalt || null);

        if (authData.requiresEncryptionSetup || !hasEncryption) {
          // New user or existing user on new device - show encryption passphrase dialog
          console.log('[OAuthCallbackHandler] Showing encryption setup dialog (new user)');
          setIsNewUser(true);
          setShowEncryptionDialog(true);
        } else {
          // Existing user with encryption - show encryption passphrase dialog to unlock
          console.log('[OAuthCallbackHandler] Showing encryption unlock dialog (existing user)');
          setIsNewUser(false);
          setShowEncryptionDialog(true);
        }

        // Clear sessionStorage
        sessionStorage.removeItem('oauth_success');
        console.log('[OAuthCallbackHandler] Cleared sessionStorage');

        // Clear the query param
        router.replace('/');
        console.log('[OAuthCallbackHandler] Replaced URL to clear query param');
      } catch (err) {
        console.error('[OAuthCallbackHandler] Error:', err);
        toast.error(`Failed to process OAuth callback: ${err instanceof Error ? err.message : 'Unknown error'}`);

        // Clear sessionStorage and query param
        sessionStorage.removeItem('oauth_success');
        router.replace('/');
      }
    };

    handleOAuthCallback();
  }, [searchParams, router]);

  const handleEncryptionComplete = async () => {
    // Encryption setup complete
    console.log('[OAuthCallbackHandler] Encryption setup complete, closing dialog');
    setShowEncryptionDialog(false);
    toast.success('Sync enabled successfully! The sync button should update shortly.');
  };

  return (
    <>
      {/* Encryption Passphrase Dialog */}
      <EncryptionPassphraseDialog
        isOpen={showEncryptionDialog}
        isNewUser={isNewUser}
        onComplete={handleEncryptionComplete}
        onCancel={() => {
          setShowEncryptionDialog(false);
        }}
        serverEncryptionSalt={serverEncryptionSalt}
      />
    </>
  );
}
