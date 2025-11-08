/**
 * Tests for SyncAuthDialog component
 * Tests authentication flow steps, provider selection, passphrase entry, error display and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OAuthHandshakeEvent, OAuthAuthData } from '@/lib/sync/oauth-handshake';

// Hoisted mocks
const {
  mockGetDb,
  mockSubscribeToOAuthHandshake,
  mockIsEncryptionConfigured,
  mockGetCryptoManager,
  mockClearCryptoManager,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSubscribeToOAuthHandshake: vi.fn(),
  mockIsEncryptionConfigured: vi.fn(),
  mockGetCryptoManager: vi.fn(),
  mockClearCryptoManager: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
}));

// Mock modules
vi.mock('@/lib/db', () => ({
  getDb: () => mockGetDb(),
}));

vi.mock('@/lib/sync/oauth-handshake', () => ({
  subscribeToOAuthHandshake: (callback: any) => mockSubscribeToOAuthHandshake(callback),
}));

vi.mock('@/lib/sync/crypto', () => ({
  isEncryptionConfigured: () => mockIsEncryptionConfigured(),
  getCryptoManager: () => mockGetCryptoManager(),
  clearCryptoManager: () => mockClearCryptoManager(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
  },
}));

// Mock OAuthButtons component
vi.mock('@/components/sync/oauth-buttons', () => ({
  OAuthButtons: ({ onStart }: { onStart?: () => void }) => (
    <div data-testid="oauth-buttons">
      <button onClick={() => onStart?.()}>Sign in with Google</button>
    </div>
  ),
}));

// Mock EncryptionPassphraseDialog component
vi.mock('@/components/sync/encryption-passphrase-dialog', () => ({
  EncryptionPassphraseDialog: ({
    isOpen,
    onComplete,
    onCancel,
  }: {
    isOpen: boolean;
    onComplete: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="encryption-dialog">
        <button onClick={onComplete}>Complete Encryption</button>
        <button onClick={onCancel}>Cancel Encryption</button>
      </div>
    ) : null,
}));

// Import component after mocks
import { SyncAuthDialog } from '@/components/sync/sync-auth-dialog';

describe('SyncAuthDialog', () => {
  let oauthCallback: ((event: OAuthHandshakeEvent) => void) | null = null;
  let unsubscribeFn: ReturnType<typeof vi.fn>;
  let mockDb: any;
  let mockCryptoManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    oauthCallback = null;

    // Setup mock database
    mockDb = {
      syncMetadata: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockGetDb.mockReturnValue(mockDb);

    // Setup mock crypto manager
    mockCryptoManager = {
      isInitialized: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
    };
    mockGetCryptoManager.mockReturnValue(mockCryptoManager);

    // Setup OAuth subscription
    unsubscribeFn = vi.fn();
    mockSubscribeToOAuthHandshake.mockImplementation((callback) => {
      oauthCallback = callback;
      return unsubscribeFn;
    });

    // Default: no encryption configured
    mockIsEncryptionConfigured.mockResolvedValue(false);

    // Default: no sync config
    mockDb.syncMetadata.get.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Dialog Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<SyncAuthDialog isOpen={false} onClose={vi.fn()} />);

      expect(screen.queryByText('Sync Settings')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Sync Settings')).toBeInTheDocument();
      });
    });

    it('should show enable sync message when not authenticated', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Enable cloud sync')).toBeInTheDocument();
      });
    });

    it('should show manage account message when authenticated', async () => {
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: 'google',
      });

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Manage your sync account')).toBeInTheDocument();
      });
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Sync Settings')).toBeInTheDocument();
      });

      // Find the backdrop by its class
      const backdrop = document.querySelector('.fixed.inset-0.z-50.bg-black\\/50');
      if (backdrop) {
        await user.click(backdrop as Element);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Authentication Flow - Not Authenticated', () => {
    it('should render OAuth buttons when not authenticated', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });
    });

    it('should show encryption information message', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('🔐 End-to-end encrypted')).toBeInTheDocument();
        expect(
          screen.getByText(/Your tasks are encrypted on your device before syncing/i)
        ).toBeInTheDocument();
      });
    });

    it('should set loading state when OAuth starts', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in with Google');
      await user.click(signInButton);

      // Loading spinner should appear
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should handle successful OAuth authentication', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in with Google');
      await user.click(signInButton);

      // Simulate successful OAuth
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state-token',
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining('Signed in as test@example.com')
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should display error message on OAuth failure', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in with Google');
      await user.click(signInButton);

      // Simulate OAuth error
      oauthCallback?.({
        status: 'error',
        error: 'Authentication failed',
        state: 'test-state-token',
      });

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(mockToastError).toHaveBeenCalledWith('Authentication failed');
      });
    });

    it('should clear error when starting new OAuth flow', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in with Google');

      // First attempt - error
      await user.click(signInButton);
      oauthCallback?.({
        status: 'error',
        error: 'First error',
        state: 'state1',
      });

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second attempt - should clear error
      await user.click(signInButton);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow - Authenticated', () => {
    beforeEach(() => {
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: 'google',
      });
    });

    it('should display signed in user email', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Signed in as')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should display provider information', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('via google')).toBeInTheDocument();
      });
    });

    it('should render logout button when authenticated', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });
    });

    it('should handle logout successfully', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockDb.syncMetadata.delete).toHaveBeenCalledWith('sync_config');
        expect(mockDb.syncMetadata.delete).toHaveBeenCalledWith('encryption_salt');
        expect(mockClearCryptoManager).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith('Logged out successfully');
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading state during logout', async () => {
      const user = userEvent.setup();
      
      // Make delete operation slow to catch loading state
      mockDb.syncMetadata.delete.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      // Check for loading text immediately
      expect(screen.getByText('Logging out...')).toBeInTheDocument();
    });

    it('should handle logout error', async () => {
      const user = userEvent.setup();
      mockDb.syncMetadata.delete.mockRejectedValue(new Error('Delete failed'));

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByText('Delete failed')).toBeInTheDocument();
      });
    });

    it('should disable logout button while logging out', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(logoutButton).toBeDisabled();
      });
    });
  });

  describe('Encryption Passphrase Flow', () => {
    beforeEach(() => {
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: 'google',
      });
      mockIsEncryptionConfigured.mockResolvedValue(true);
      mockCryptoManager.isInitialized.mockReturnValue(false);
    });

    it('should show encryption dialog when encryption is configured but not initialized', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('encryption-dialog')).toBeInTheDocument();
        expect(mockToastInfo).toHaveBeenCalledWith(
          'Please enter your encryption passphrase to unlock sync.'
        );
      });
    });

    it('should not show encryption dialog when crypto manager is initialized', async () => {
      mockCryptoManager.isInitialized.mockReturnValue(true);

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('encryption-dialog')).not.toBeInTheDocument();
    });

    it('should handle encryption dialog completion', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('encryption-dialog')).toBeInTheDocument();
      });

      const completeButton = screen.getByText('Complete Encryption');
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Encryption unlocked. You can close this dialog.'
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle encryption dialog cancellation', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('encryption-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel Encryption');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('encryption-dialog')).not.toBeInTheDocument();
      });
    });

    it('should refresh sync status after encryption completion', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('encryption-dialog')).toBeInTheDocument();
      });

      const completeButton = screen.getByText('Complete Encryption');
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockDb.syncMetadata.get).toHaveBeenCalledWith('sync_config');
      });
    });
  });

  describe('OAuth State Management', () => {
    it('should ignore OAuth events with mismatched state', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in with Google');
      await user.click(signInButton);

      // First OAuth success sets active state
      const authData1: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      oauthCallback?.({
        status: 'success',
        authData: authData1,
        state: 'state1',
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });

      // Second OAuth event with different state should be ignored
      oauthCallback?.({
        status: 'error',
        error: 'Should be ignored',
        state: 'state2',
      });

      // onSuccess should not be called again
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Should be ignored')).not.toBeInTheDocument();
    });

    it('should only process OAuth events when dialog is open', async () => {
      const { rerender } = render(<SyncAuthDialog isOpen={false} onClose={vi.fn()} />);

      // Trigger OAuth event while dialog is closed
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state',
      });

      // Should not show success toast
      expect(mockToastSuccess).not.toHaveBeenCalled();

      // Open dialog
      rerender(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      // Still should not process the old event
      await waitFor(() => {
        expect(screen.getByText('Sync Settings')).toBeInTheDocument();
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Cleanup', () => {
    it('should unsubscribe from OAuth handshake on unmount', () => {
      const { unmount } = render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      expect(mockSubscribeToOAuthHandshake).toHaveBeenCalled();

      unmount();

      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('should not subscribe when not mounted', () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      // Should wait for mounted state before subscribing
      expect(mockSubscribeToOAuthHandshake).toHaveBeenCalled();
    });
  });

  describe('Status Refresh', () => {
    it('should refresh status after successful OAuth', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in with Google');
      await user.click(signInButton);

      // Simulate successful OAuth
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      // Update mock to return sync config after OAuth
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: 'google',
      });

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state',
      });

      // Wait for the status refresh (happens after 600ms timeout)
      await waitFor(() => {
        expect(mockDb.syncMetadata.get).toHaveBeenCalledWith('sync_config');
      }, { timeout: 2000 });
    });
  });

  describe('Error Display', () => {
    beforeEach(() => {
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: 'google',
      });
    });

    it('should display error in authenticated state', async () => {
      mockDb.syncMetadata.delete.mockRejectedValue(new Error('Network error'));
      
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });

      const user = userEvent.setup();
      await user.click(logoutButton);

      await waitFor(() => {
        const errorElement = screen.getByText('Network error');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement.closest('div')).toHaveClass('bg-red-50');
      }, { timeout: 2000 });
    });
  });
});
