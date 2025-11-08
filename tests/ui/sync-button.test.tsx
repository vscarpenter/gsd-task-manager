/**
 * Tests for SyncButton component
 * Tests sync trigger on button click, sync status display, error handling, and last sync timestamp display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Hoisted mocks
const {
  mockUseSync,
  mockGetCryptoManager,
  mockGetSyncQueue,
  mockGetHealthMonitor,
  mockIsAuthError,
  mockShowToast,
} = vi.hoisted(() => ({
  mockUseSync: vi.fn(),
  mockGetCryptoManager: vi.fn(),
  mockGetSyncQueue: vi.fn(),
  mockGetHealthMonitor: vi.fn(),
  mockIsAuthError: vi.fn(),
  mockShowToast: vi.fn(),
}));

// Mock modules
vi.mock('@/lib/hooks/use-sync', () => ({
  useSync: () => mockUseSync(),
}));

vi.mock('@/lib/sync/crypto', () => ({
  getCryptoManager: () => mockGetCryptoManager(),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: () => mockGetSyncQueue(),
}));

vi.mock('@/lib/sync/health-monitor', () => ({
  getHealthMonitor: () => mockGetHealthMonitor(),
}));

vi.mock('@/lib/sync/error-categorizer', () => ({
  isAuthError: (error: Error) => mockIsAuthError(error),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock SyncAuthDialog component
vi.mock('@/components/sync/sync-auth-dialog', () => ({
  SyncAuthDialog: ({
    isOpen,
    onClose,
    onSuccess,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
  }) =>
    isOpen ? (
      <div data-testid="sync-auth-dialog">
        <button onClick={onClose}>Close Dialog</button>
        <button onClick={onSuccess}>Success</button>
      </div>
    ) : null,
}));

// Import component after mocks
import { SyncButton } from '@/components/sync/sync-button';

describe('SyncButton', () => {
  let mockCryptoManager: any;
  let mockSyncQueue: any;
  let mockHealthMonitor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mock crypto manager
    mockCryptoManager = {
      isInitialized: vi.fn().mockReturnValue(true),
    };
    mockGetCryptoManager.mockReturnValue(mockCryptoManager);

    // Setup mock sync queue
    mockSyncQueue = {
      getPendingCount: vi.fn().mockResolvedValue(0),
    };
    mockGetSyncQueue.mockReturnValue(mockSyncQueue);

    // Setup mock health monitor
    mockHealthMonitor = {
      check: vi.fn().mockResolvedValue({
        healthy: true,
        issues: [],
        timestamp: Date.now(),
      }),
    };
    mockGetHealthMonitor.mockReturnValue(mockHealthMonitor);

    // Default: auth errors return false
    mockIsAuthError.mockReturnValue(false);

    // Default useSync state: idle and enabled
    mockUseSync.mockReturnValue({
      sync: vi.fn().mockResolvedValue(undefined),
      isSyncing: false,
      status: 'idle',
      error: null,
      isEnabled: true,
      lastResult: null,
      nextRetryAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Button Rendering', () => {
    it('should render sync button', () => {
      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /sync with cloud/i });
      expect(button).toBeInTheDocument();
    });

    it('should show cloud icon when idle', () => {
      render(<SyncButton />);

      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should show cloud off icon when sync is disabled', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: false,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /sync not enabled/i });
      expect(button).toBeInTheDocument();
    });

    it('should show disabled indicator dot when sync is not enabled', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: false,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const dot = document.querySelector('.bg-gray-400');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('Sync Status Display', () => {
    it('should show syncing status with pulsing icon', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: true,
        status: 'syncing',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /syncing/i });
      expect(button).toBeInTheDocument();
      
      const icon = button.querySelector('.animate-pulse');
      expect(icon).toBeInTheDocument();
    });

    it('should show success status with green check icon', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'success',
        error: null,
        isEnabled: true,
        lastResult: { status: 'success' },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /sync successful/i });
      expect(button).toBeInTheDocument();
      
      const icon = button.querySelector('.text-green-500');
      expect(icon).toBeInTheDocument();
    });

    it('should show error status with red X icon', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'error',
        error: 'Network error',
        isEnabled: true,
        lastResult: { status: 'error', error: 'Network error' },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /network error/i });
      expect(button).toBeInTheDocument();
      
      const icon = button.querySelector('.text-red-500');
      expect(icon).toBeInTheDocument();
    });

    it('should show conflict status with yellow alert icon', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'conflict',
        error: null,
        isEnabled: true,
        lastResult: { status: 'conflict', conflicts: [] },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /conflicts resolved/i });
      expect(button).toBeInTheDocument();
      
      const icon = button.querySelector('.text-yellow-500');
      expect(icon).toBeInTheDocument();
    });

    it('should disable button while syncing', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: true,
        status: 'syncing',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Pending Operations Badge', () => {
    it('should show pending count badge when operations are queued', async () => {
      mockSyncQueue.getPendingCount.mockResolvedValue(5);

      render(<SyncButton />);

      // Wait for initial effect to run
      await vi.advanceTimersByTimeAsync(0);

      const badge = screen.getByText('5');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-500');
    });

    it('should not show badge when no pending operations', async () => {
      mockSyncQueue.getPendingCount.mockResolvedValue(0);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const badge = document.querySelector('.bg-blue-500');
      expect(badge).not.toBeInTheDocument();
    });

    it('should update pending count periodically', async () => {
      mockSyncQueue.getPendingCount.mockResolvedValue(3);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      expect(screen.getByText('3')).toBeInTheDocument();

      // Update count
      mockSyncQueue.getPendingCount.mockResolvedValue(7);

      // Advance timer by 2 seconds (polling interval)
      await vi.advanceTimersByTimeAsync(2000);

      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should show pending count in tooltip', async () => {
      mockSyncQueue.getPendingCount.mockResolvedValue(3);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button', { name: /3 pending operations/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Sync Trigger', () => {
    it('should call sync function when button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSync = vi.fn().mockResolvedValue(undefined);

      mockUseSync.mockReturnValue({
        sync: mockSync,
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSync).toHaveBeenCalled();
    });

    it('should open auth dialog when sync is not enabled', async () => {
      const user = userEvent.setup({ delay: null });

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: false,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByTestId('sync-auth-dialog')).toBeInTheDocument();
    });

    it('should not call sync when encryption is not initialized', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSync = vi.fn();
      mockCryptoManager.isInitialized.mockReturnValue(false);

      mockUseSync.mockReturnValue({
        sync: mockSync,
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSync).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please enter your encryption passphrase to sync',
        undefined,
        5000
      );
    });

    it('should open auth dialog when encryption is not initialized', async () => {
      const user = userEvent.setup({ delay: null });
      mockCryptoManager.isInitialized.mockReturnValue(false);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByTestId('sync-auth-dialog')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message in tooltip', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'error',
        error: 'Connection timeout',
        isEnabled: true,
        lastResult: { status: 'error', error: 'Connection timeout' },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      const button = screen.getByRole('button', { name: /connection timeout/i });
      expect(button).toBeInTheDocument();
    });

    it('should show auth error badge with exclamation mark', () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'error',
        error: 'Authentication expired',
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      mockIsAuthError.mockReturnValue(true);

      render(<SyncButton />);

      // Wait for auth error detection
      vi.advanceTimersByTime(100);

      const badge = screen.getByText('!');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-600');
    });

    it('should show toast with re-login action for auth errors', async () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'error',
        error: 'Token expired',
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      mockIsAuthError.mockReturnValue(true);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Token expired',
        expect.objectContaining({
          label: 'Re-login',
          onClick: expect.any(Function),
        }),
        7000
      );
    });

    it('should open auth dialog when clicking re-login on auth error', async () => {
      const user = userEvent.setup({ delay: null });
      let reloginCallback: (() => void) | undefined;

      mockShowToast.mockImplementation((message, action) => {
        if (action?.onClick) {
          reloginCallback = action.onClick;
        }
      });

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'error',
        error: 'Authentication failed',
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      mockIsAuthError.mockReturnValue(true);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      expect(reloginCallback).toBeDefined();

      // Trigger re-login
      reloginCallback?.();

      expect(screen.getByTestId('sync-auth-dialog')).toBeInTheDocument();
    });

    it('should prevent sync when auth error is active', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSync = vi.fn();

      mockUseSync.mockReturnValue({
        sync: mockSync,
        isSyncing: false,
        status: 'error',
        error: 'Auth expired',
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      mockIsAuthError.mockReturnValue(true);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSync).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please re-login to continue syncing',
        undefined,
        5000
      );
    });
  });

  describe('Retry Countdown', () => {
    it('should show retry countdown when nextRetryAt is set', () => {
      const futureTime = Date.now() + 30000; // 30 seconds from now

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: futureTime,
      });

      render(<SyncButton />);

      vi.advanceTimersByTime(1000);

      const countdown = screen.getByText(/30s/i);
      expect(countdown).toBeInTheDocument();
    });

    it('should show clock icon during retry countdown', () => {
      const futureTime = Date.now() + 15000;

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: futureTime,
      });

      render(<SyncButton />);

      vi.advanceTimersByTime(1000);

      const icon = document.querySelector('.text-orange-500');
      expect(icon).toBeInTheDocument();
    });

    it('should update countdown every second', () => {
      const futureTime = Date.now() + 10000; // 10 seconds

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: futureTime,
      });

      render(<SyncButton />);

      vi.advanceTimersByTime(1000);
      expect(screen.getByText((content, element) => {
        return element?.textContent === '10s';
      })).toBeInTheDocument();

      vi.advanceTimersByTime(1000);
      expect(screen.getByText((content, element) => {
        return element?.textContent === '9s';
      })).toBeInTheDocument();

      vi.advanceTimersByTime(1000);
      expect(screen.getByText((content, element) => {
        return element?.textContent === '8s';
      })).toBeInTheDocument();
    });

    it('should show retry countdown in tooltip', () => {
      const futureTime = Date.now() + 20000;

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: null,
        nextRetryAt: futureTime,
      });

      render(<SyncButton />);

      vi.advanceTimersByTime(1000);

      const button = screen.getByRole('button', { name: /retrying in 20s/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Health Monitoring', () => {
    it('should check health periodically when enabled', async () => {
      render(<SyncButton />);

      // Initial check after 10 seconds
      await vi.advanceTimersByTimeAsync(10000);

      expect(mockHealthMonitor.check).toHaveBeenCalled();
    });

    it('should show toast for error severity health issues', async () => {
      mockHealthMonitor.check.mockResolvedValue({
        healthy: false,
        issues: [
          {
            type: 'auth_error',
            severity: 'error',
            message: 'Authentication failed',
            suggestedAction: 'Please re-login',
          },
        ],
        timestamp: Date.now(),
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Authentication failed. Please re-login',
        undefined,
        7000
      );
    });

    it('should show toast with sync action for stale queue warnings', async () => {
      mockHealthMonitor.check.mockResolvedValue({
        healthy: false,
        issues: [
          {
            type: 'stale_queue',
            severity: 'warning',
            message: 'Pending operations not synced',
            suggestedAction: 'Sync now',
          },
        ],
        timestamp: Date.now(),
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Pending operations not synced',
        expect.objectContaining({
          label: 'Sync Now',
          onClick: expect.any(Function),
        }),
        7000
      );
    });

    it('should not spam health notifications', async () => {
      mockHealthMonitor.check.mockResolvedValue({
        healthy: false,
        issues: [
          {
            type: 'auth_error',
            severity: 'error',
            message: 'Error',
            suggestedAction: 'Fix it',
          },
        ],
        timestamp: Date.now(),
      });

      render(<SyncButton />);

      // First check
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockShowToast).toHaveBeenCalledTimes(1);

      // Second check within cooldown period (5 minutes)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      
      // Should not show another toast due to cooldown
      expect(mockShowToast).toHaveBeenCalledTimes(1);
    });

    it('should not check health when sync is disabled', async () => {
      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: false,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockHealthMonitor.check).not.toHaveBeenCalled();
    });
  });

  describe('Sync Result Toasts', () => {
    it('should show success toast after successful sync', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSync = vi.fn().mockResolvedValue(undefined);

      mockUseSync.mockReturnValue({
        sync: mockSync,
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: {
          status: 'success',
          pushedCount: 3,
          pulledCount: 5,
        },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Sync complete: Pushed 3 changes, pulled 5 changes.',
        undefined,
        3000
      );
    });

    it('should show conflict toast when conflicts are resolved', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSync = vi.fn().mockResolvedValue(undefined);

      mockUseSync.mockReturnValue({
        sync: mockSync,
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: {
          status: 'conflict',
          conflicts: [{}, {}], // 2 conflicts
        },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Sync conflicts detected: 2 conflicts were auto-resolved.',
        undefined,
        5000
      );
    });

    it('should show error toast when sync fails', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSync = vi.fn().mockResolvedValue(undefined);

      mockUseSync.mockReturnValue({
        sync: mockSync,
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: true,
        lastResult: {
          status: 'error',
          error: 'Network timeout',
        },
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Sync failed: Network timeout',
        undefined,
        7000
      );
    });
  });

  describe('Auth Dialog Integration', () => {
    it('should close auth dialog when close button is clicked', async () => {
      const user = userEvent.setup({ delay: null });

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'idle',
        error: null,
        isEnabled: false,
        lastResult: null,
        nextRetryAt: null,
      });

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      // Open dialog
      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByTestId('sync-auth-dialog')).toBeInTheDocument();

      // Close dialog
      const closeButton = screen.getByText('Close Dialog');
      await user.click(closeButton);

      expect(screen.queryByTestId('sync-auth-dialog')).not.toBeInTheDocument();
    });

    it('should clear auth error state on successful re-authentication', async () => {
      const user = userEvent.setup({ delay: null });

      mockUseSync.mockReturnValue({
        sync: vi.fn(),
        isSyncing: false,
        status: 'error',
        error: 'Auth expired',
        isEnabled: true,
        lastResult: null,
        nextRetryAt: null,
      });

      mockIsAuthError.mockReturnValue(true);

      render(<SyncButton />);

      await vi.advanceTimersByTimeAsync(0);

      // Open dialog
      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByTestId('sync-auth-dialog')).toBeInTheDocument();

      // Trigger success
      const successButton = screen.getByText('Success');
      await user.click(successButton);

      expect(screen.queryByTestId('sync-auth-dialog')).not.toBeInTheDocument();

      // Auth error badge should be cleared
      expect(screen.queryByText('!')).not.toBeInTheDocument();
    });
  });
});
