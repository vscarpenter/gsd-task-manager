/**
 * Tests for SyncAuthDialog component
 * Tests dialog open/close behavior, OAuth login flow, user info display, and logout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthState } from '@/lib/sync/pb-auth';

// Hoisted mocks
const {
  mockGetDb,
  mockLogout,
  mockGetSyncQueue,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockLogout: vi.fn(),
  mockGetSyncQueue: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// Mock modules
vi.mock('@/lib/db', () => ({
  getDb: () => mockGetDb(),
}));

vi.mock('@/lib/sync/pb-auth', () => ({
  logout: () => mockLogout(),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: () => mockGetSyncQueue(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// Capture OAuthButtons callbacks so tests can invoke them directly
let capturedOnSuccess: ((authState: AuthState) => void) | undefined;
let capturedOnError: ((error: Error) => void) | undefined;

vi.mock('@/components/sync/oauth-buttons', () => ({
  OAuthButtons: ({
    onStart,
    onSuccess,
    onError,
  }: {
    onStart?: (provider: 'google' | 'github') => void;
    onSuccess?: (authState: AuthState) => void;
    onError?: (error: Error) => void;
  }) => {
    capturedOnSuccess = onSuccess;
    capturedOnError = onError;

    return (
      <div data-testid="oauth-buttons">
        <button onClick={() => onStart?.('google')}>Continue with Google</button>
        <button onClick={() => onStart?.('github')}>Continue with GitHub</button>
      </div>
    );
  },
}));

// Import component after mocks
import { SyncAuthDialog } from '@/components/sync/sync-auth-dialog';

describe('SyncAuthDialog', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueue: any;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSuccess = undefined;
    capturedOnError = undefined;

    // Setup mock database
    mockDb = {
      syncMetadata: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
      syncQueue: {
        clear: vi.fn().mockResolvedValue(undefined),
      },
    };
    mockGetDb.mockReturnValue(mockDb);

    // Setup mock sync queue
    mockQueue = {
      populateFromExistingTasks: vi.fn().mockResolvedValue(undefined),
    };
    mockGetSyncQueue.mockReturnValue(mockQueue);
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

    it('should show "Enable cloud sync" when not authenticated', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Enable cloud sync')).toBeInTheDocument();
      });
    });

    it('should show "Manage your sync account" when authenticated', async () => {
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

      await user.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Sync Settings')).toBeInTheDocument();
      });

      const backdrop = document.querySelector('.fixed.inset-0.z-50.bg-black\\/50');
      if (backdrop) {
        await user.click(backdrop as Element);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Not Authenticated State', () => {
    it('should render OAuth buttons when not authenticated', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });
    });

    it('should show PocketBase sync information message', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Cloud sync')).toBeInTheDocument();
        expect(
          screen.getByText(/Sign in to sync your tasks across devices/i)
        ).toBeInTheDocument();
      });
    });

    it('should set loading state when OAuth starts', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue with Google'));

      // Loading spinner should appear
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should handle successful OAuth authentication', async () => {
      const onSuccess = vi.fn();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      });

      // Simulate the OAuthButtons calling onSuccess with an AuthState
      const authState: AuthState = {
        isLoggedIn: true,
        userId: 'user123',
        email: 'test@example.com',
        provider: 'google',
      };

      // Invoke the captured onSuccess callback from OAuthButtons
      await waitFor(() => {
        expect(capturedOnSuccess).toBeDefined();
      });
      await capturedOnSuccess!(authState);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Signed in as test@example.com');
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should persist sync config on successful OAuth', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(capturedOnSuccess).toBeDefined();
      });

      const authState: AuthState = {
        isLoggedIn: true,
        userId: 'user123',
        email: 'test@example.com',
        provider: 'google',
      };

      await capturedOnSuccess!(authState);

      await waitFor(() => {
        expect(mockDb.syncMetadata.put).toHaveBeenCalledWith(
          expect.objectContaining({
            key: 'sync_config',
            enabled: true,
            userId: 'user123',
            email: 'test@example.com',
            provider: 'google',
          })
        );
      });
    });

    it('should populate sync queue from existing tasks on OAuth success', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(capturedOnSuccess).toBeDefined();
      });

      const authState: AuthState = {
        isLoggedIn: true,
        userId: 'user123',
        email: 'test@example.com',
        provider: 'google',
      };

      await capturedOnSuccess!(authState);

      await waitFor(() => {
        expect(mockQueue.populateFromExistingTasks).toHaveBeenCalled();
      });
    });

    it('should display error on OAuth failure', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(capturedOnError).toBeDefined();
      });

      // Invoke the captured onError callback
      capturedOnError!(new Error('Authentication failed'));

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(mockToastError).toHaveBeenCalledWith('Authentication failed');
      });
    });

    it('should clear error when starting new OAuth flow', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(capturedOnError).toBeDefined();
      });

      // Trigger an error first
      capturedOnError!(new Error('First error'));

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Start a new OAuth flow by clicking a provider button
      await user.click(screen.getByText('Continue with Google'));

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: 'google',
      });
    });

    it('should display signed-in user email', async () => {
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

    it('should not show provider text when provider is null', async () => {
      mockDb.syncMetadata.get.mockResolvedValue({
        key: 'sync_config',
        enabled: true,
        email: 'test@example.com',
        provider: null,
      });

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      expect(screen.queryByText(/^via /)).not.toBeInTheDocument();
    });

    it('should render logout button', async () => {
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

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockDb.syncQueue.clear).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith('Logged out successfully');
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should update sync config on logout', async () => {
      const user = userEvent.setup();

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(mockDb.syncMetadata.put).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
            userId: null,
            email: null,
            provider: null,
            lastSyncAt: null,
          })
        );
      });
    });

    it('should show loading state during logout', async () => {
      const user = userEvent.setup();

      // Make the syncQueue.clear slow so we can catch loading state
      mockDb.syncQueue.clear.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /logout/i }));

      expect(screen.getByText('Logging out...')).toBeInTheDocument();
    });

    it('should disable logout button while logging out', async () => {
      const user = userEvent.setup();

      // Make the syncQueue.clear slow
      mockDb.syncQueue.clear.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      expect(logoutButton).toBeDisabled();
    });

    it('should handle logout error', async () => {
      const user = userEvent.setup();

      // Make logout throw an error
      mockLogout.mockImplementation(() => {
        throw new Error('Logout failed');
      });

      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        const errorElement = screen.getByText('Logout failed');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement.closest('div')).toHaveClass('bg-red-50');
      });
    });
  });

  describe('Status Loading', () => {
    it('should load sync status from IndexedDB when dialog opens', async () => {
      render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockDb.syncMetadata.get).toHaveBeenCalledWith('sync_config');
      });
    });

    it('should reload sync status when dialog re-opens', async () => {
      const { rerender } = render(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockDb.syncMetadata.get).toHaveBeenCalledWith('sync_config');
      });

      // Close and re-open
      rerender(<SyncAuthDialog isOpen={false} onClose={vi.fn()} />);
      rerender(<SyncAuthDialog isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        // Should have been called again on re-open
        expect(mockDb.syncMetadata.get).toHaveBeenCalledTimes(2);
      });
    });
  });
});
