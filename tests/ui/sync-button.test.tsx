import { render, screen } from '@testing-library/react';
import { toast } from 'sonner';

// --- Mocks ---

const mockSync = vi.fn();
const mockUseSyncHealth = vi.fn();
const mockUseSync = vi.fn(() => ({
  sync: mockSync,
  isSyncing: false,
  status: 'idle' as const,
  error: null,
  isEnabled: false,
  nextRetryAt: null,
}));

vi.mock('@/lib/sync/sync-provider', () => ({
  useSyncContext: (...args: unknown[]) => mockUseSync(...args),
}));

vi.mock('@/lib/hooks/use-sync', () => ({
  useSync: (...args: unknown[]) => mockUseSync(...args),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/components/sync/use-sync-health', () => ({
  useSyncHealth: (...args: unknown[]) => mockUseSyncHealth(...args),
}));

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

const mockUseSyncStatus = vi.fn(() => ({
  iconType: 'cloud-off' as const,
  tooltip: 'Sync disabled',
  pendingCount: 0,
  hasAuthError: false,
  retryCountdown: null,
}));

vi.mock('@/components/sync/use-sync-status', () => ({
  useSyncStatus: (...args: unknown[]) => mockUseSyncStatus(...args),
}));

vi.mock('@/components/sync/sync-auth-dialog', () => ({
  SyncAuthDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="sync-auth-dialog">Auth Dialog</div> : null,
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/sync/error-categorizer', () => ({
  isAuthError: vi.fn(() => false),
}));

vi.mock('@/lib/constants/sync', () => ({
  SYNC_CONFIG: { MAX_RETRY_COUNT: 3 },
  SYNC_TOAST_DURATION: { SHORT: 2000, MEDIUM: 4000, LONG: 6000 },
}));

// --- Import ---

import { SyncButton } from '@/components/sync/sync-button';

// --- Tests ---

describe('SyncButton', () => {
  beforeEach(() => {
    mockSync.mockClear();
    mockUseSyncHealth.mockReset();
    vi.mocked(toast).mockClear();
    mockUseSync.mockReturnValue({
      sync: mockSync,
      isSyncing: false,
      status: 'idle',
      error: null,
      isEnabled: false,
      nextRetryAt: null,
    });
    mockUseSyncStatus.mockReturnValue({
      iconType: 'cloud-off',
      tooltip: 'Sync disabled',
      pendingCount: 0,
      hasAuthError: false,
      retryCountdown: null,
    });
  });

  it('renders with disabled state tooltip', () => {
    render(<SyncButton />);
    expect(screen.getByRole('button', { name: /sync disabled/i })).toBeInTheDocument();
  });

  it('shows offline indicator dot when sync is disabled', () => {
    render(<SyncButton />);
    // The button should have a gray dot indicator when not enabled
    const button = screen.getByRole('button', { name: /sync disabled/i });
    expect(button.querySelector('.bg-gray-400')).toBeInTheDocument();
  });

  it('renders enabled idle state', () => {
    mockUseSync.mockReturnValue({
      sync: mockSync,
      isSyncing: false,
      status: 'idle',
      error: null,
      isEnabled: true,
      nextRetryAt: null,
    });
    mockUseSyncStatus.mockReturnValue({
      iconType: 'cloud-idle',
      tooltip: 'Sync enabled',
      pendingCount: 0,
      hasAuthError: false,
      retryCountdown: null,
    });

    render(<SyncButton />);
    expect(screen.getByRole('button', { name: /sync enabled/i })).toBeInTheDocument();
  });

  it('disables button while syncing', () => {
    mockUseSync.mockReturnValue({
      sync: mockSync,
      isSyncing: true,
      status: 'syncing',
      error: null,
      isEnabled: true,
      nextRetryAt: null,
    });
    mockUseSyncStatus.mockReturnValue({
      iconType: 'cloud-syncing',
      tooltip: 'Syncing...',
      pendingCount: 0,
      hasAuthError: false,
      retryCountdown: null,
    });

    render(<SyncButton />);
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });

  it('shows pending count badge when there are pending changes', () => {
    mockUseSync.mockReturnValue({
      sync: mockSync,
      isSyncing: false,
      status: 'idle',
      error: null,
      isEnabled: true,
      nextRetryAt: null,
    });
    mockUseSyncStatus.mockReturnValue({
      iconType: 'cloud-idle',
      tooltip: 'Sync enabled – 3 pending',
      pendingCount: 3,
      hasAuthError: false,
      retryCountdown: null,
    });

    render(<SyncButton />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('forwards stable health issue ids to sonner so repeated warnings are deduped', () => {
    mockUseSync.mockReturnValue({
      sync: mockSync,
      isSyncing: false,
      status: 'idle',
      error: null,
      isEnabled: true,
      nextRetryAt: null,
    });
    mockUseSyncHealth.mockImplementation(({ onHealthIssue }) => {
      onHealthIssue({
        id: 'sync-health-stale_queue',
        message: 'Pending sync operations are stale',
        duration: 6000,
        action: { label: 'Sync Now', onClick: vi.fn() },
      });
    });

    render(<SyncButton />);

    expect(toast).toHaveBeenCalledWith(
      'Pending sync operations are stale',
      expect.objectContaining({
        id: 'sync-health-stale_queue',
        duration: 6000,
        action: expect.objectContaining({ label: 'Sync Now' }),
      })
    );
  });
});
