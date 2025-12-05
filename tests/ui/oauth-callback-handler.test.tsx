/**
 * Tests for OAuthCallbackHandler component
 * Focus on token expiration normalization (Issue #2) and OAuth flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { OAuthAuthData } from '@/lib/sync/oauth-handshake';

// Use vi.hoisted to ensure these are available to vi.mock
const {
  mockRouterReplace,
  mockSearchParams,
  mockToast,
  mockSubscribeToOAuthHandshake,
  mockIsEncryptionConfigured,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  mockToast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  mockSubscribeToOAuthHandshake: vi.fn(),
  mockIsEncryptionConfigured: vi.fn(),
}));

// Mock modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/sync/oauth-handshake', () => ({
  subscribeToOAuthHandshake: (callback: any) => mockSubscribeToOAuthHandshake(callback),
}));

vi.mock('@/lib/sync/crypto', () => ({
  isEncryptionConfigured: () => mockIsEncryptionConfigured(),
}));

// Now import the component and dependencies
import { OAuthCallbackHandler } from '@/components/oauth-callback-handler';
import { getDb } from '@/lib/db';

describe('OAuthCallbackHandler', () => {
  let db: ReturnType<typeof getDb>;
  let oauthCallback: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    db = getDb();

    // Clear database
    await db.syncMetadata.clear();
    await db.tasks.clear();

    // Set up default mock values
    mockIsEncryptionConfigured.mockResolvedValue(false);

    // Capture the OAuth callback
    mockSubscribeToOAuthHandshake.mockImplementation((callback) => {
      oauthCallback = callback;
      return vi.fn(); // Return unsubscribe function
    });
  });

  afterEach(async () => {
    await db.syncMetadata.clear();
    await db.tasks.clear();
  });

  describe('Issue #2: Token Expiration Normalization', () => {
    it('should normalize token expiration from seconds to milliseconds', async () => {
      render(<OAuthCallbackHandler />);

      // Simulate OAuth success with token expiration in seconds (typical JWT format)
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'jwt-token',
        expiresAt: 1735689600, // Jan 1, 2025 00:00:00 UTC in SECONDS
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state-123',
      });

      // Wait for processing to complete
      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config).toBeDefined();
      });

      // Verify token expiration was normalized to milliseconds
      const config = await db.syncMetadata.get('sync_config');
      expect(config?.tokenExpiresAt).toBe(1735689600 * 1000); // Now in milliseconds
      expect(config?.tokenExpiresAt).toBe(1735689600000);
    });

    it('should keep token expiration unchanged if already in milliseconds', async () => {
      render(<OAuthCallbackHandler />);

      // Simulate OAuth success with token expiration already in milliseconds
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'jwt-token',
        expiresAt: 1735689600000, // Already in MILLISECONDS
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state-456',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config).toBeDefined();
      });

      // Should remain unchanged (already in milliseconds)
      const config = await db.syncMetadata.get('sync_config');
      expect(config?.tokenExpiresAt).toBe(1735689600000);
    });

    it('should handle threshold boundary correctly (seconds)', async () => {
      render(<OAuthCallbackHandler />);

      // Just below the 10 billion threshold (should be treated as seconds)
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'jwt-token',
        expiresAt: 9_999_999_999, // Just below threshold
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state-789',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config).toBeDefined();
      });

      // Should be multiplied by 1000
      const config = await db.syncMetadata.get('sync_config');
      expect(config?.tokenExpiresAt).toBe(9_999_999_999 * 1000);
    });

    it('should handle threshold boundary correctly (milliseconds)', async () => {
      render(<OAuthCallbackHandler />);

      // At threshold: 10 billion (should be treated as milliseconds)
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'jwt-token',
        expiresAt: 10_000_000_000, // At threshold
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state-abc',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config).toBeDefined();
      });

      // Should NOT be multiplied (already in milliseconds)
      const config = await db.syncMetadata.get('sync_config');
      expect(config?.tokenExpiresAt).toBe(10_000_000_000);
    });
  });

  describe('OAuth Flow', () => {
    it('should process OAuth handshake success event', async () => {
      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith('Processing OAuth for test@example.com...');
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config).toBeDefined();
      });
    });

    it('should store sync config in IndexedDB with correct fields', async () => {
      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device456',
        email: 'test@example.com',
        token: 'oauth-token-xyz',
        expiresAt: 1735689600,
        provider: 'apple',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config).toMatchObject({
          key: 'sync_config',
          enabled: true,
          userId: 'user123',
          deviceId: 'device456',
          email: 'test@example.com',
          token: 'oauth-token-xyz',
          provider: 'apple',
          conflictStrategy: 'last_write_wins',
          consecutiveFailures: 0,
          lastFailureAt: null,
          lastFailureReason: null,
          nextRetryAt: null,
        });
      });
    });

    it('should show encryption dialog for new users', async () => {
      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'new-user@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true, // New user
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Sync enabled successfully! Finish encryption setup to start syncing.'
        );
      });
    });

    it('should show encryption unlock dialog for existing users without local encryption', async () => {
      render(<OAuthCallbackHandler />);
      mockIsEncryptionConfigured.mockResolvedValue(false);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'existing@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: false, // Existing user
        encryptionSalt: 'server-salt',
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(() => {
        expect(mockIsEncryptionConfigured).toHaveBeenCalled();
      });
    });

    it('should handle OAuth handshake errors', async () => {
      render(<OAuthCallbackHandler />);

      await oauthCallback({
        status: 'error',
        error: 'Authentication failed',
        state: 'test-state',
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Authentication failed');
      });
    });

    it('should handle OAuth handshake errors with generic message', async () => {
      render(<OAuthCallbackHandler />);

      await oauthCallback({
        status: 'error',
        error: null,
        state: 'test-state',
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Sign in failed. Please try again.');
      });
    });
  });

  describe('Server URL Detection', () => {
    it('should use localhost URL in development', async () => {
      // Mock window.location.hostname
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'localhost',
          origin: 'http://localhost:3000',
        },
        writable: true,
      });

      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config?.serverUrl).toBe('http://localhost:8787');
      });
    });

    it('should use window origin in production', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'gsd.vinny.dev',
          origin: 'https://gsd.vinny.dev',
        },
        writable: true,
      });

      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        expect(config?.serverUrl).toBe('https://gsd.vinny.dev');
      });
    });

    it('should preserve existing serverUrl if already configured', async () => {
      // Pre-populate existing sync config
      await db.syncMetadata.put({
        key: 'sync_config',
        enabled: false,
        userId: 'user123',
        deviceId: 'device123',
        deviceName: 'Old Device',
        email: 'old@example.com',
        token: null,
        tokenExpiresAt: null,
        lastSyncAt: null,
        vectorClock: {},
        conflictStrategy: 'last_write_wins',
        serverUrl: 'https://custom-server.com',
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });

      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device789',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(async () => {
        const config = await db.syncMetadata.get('sync_config');
        // Should preserve custom server URL
        expect(config?.serverUrl).toBe('https://custom-server.com');
      });
    });
  });

  describe('Query Parameter Handling', () => {
    it('should replace URL when oauth_complete query param is present', () => {
      mockSearchParams.set('oauth_complete', 'true');

      render(<OAuthCallbackHandler />);

      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });

    it('should not replace URL when oauth_complete is absent', () => {
      mockSearchParams.delete('oauth_complete');

      render(<OAuthCallbackHandler />);

      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock database error
      vi.spyOn(db.syncMetadata, 'put').mockRejectedValue(new Error('Database error'));

      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      await oauthCallback({
        status: 'success',
        authData,
        state: 'test-state',
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to process OAuth callback')
        );
      });

      consoleErrorSpy.mockRestore();
    });

    // Duplicate state prevention IS implemented via processingState check in component (lines 71-73)
    it('should prevent duplicate processing of same state', async () => {
      render(<OAuthCallbackHandler />);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: 1735689600,
        provider: 'google',
        requiresEncryptionSetup: true,
        encryptionSalt: null,
      };

      const sameState = 'duplicate-state';

      // First call - should process normally
      await oauthCallback({
        status: 'success',
        authData,
        state: sameState,
      });

      // Wait for first callback to fully process (state update + toast)
      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith(
          expect.stringContaining('Processing OAuth')
        );
      });

      // Clear mocks after first call is fully processed
      mockToast.info.mockClear();
      mockToast.success.mockClear();

      // Call again with same state - should be blocked by processingState check
      await oauthCallback({
        status: 'success',
        authData,
        state: sameState,
      });

      // Second call should be ignored (no toasts)
      expect(mockToast.info).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
    });
  });
});
