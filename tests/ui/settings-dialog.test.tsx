import { render, screen } from '@testing-library/react';
import { ArchiveSettings } from '@/components/settings/archive-settings';
import { DataManagement } from '@/components/settings/data-management';
import { SyncSettings } from '@/components/settings/sync-settings';
import { SettingsDialog } from '@/components/settings/settings-dialog';

// --- Mocks ---

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/use-tasks', () => ({
  useTasks: () => ({ all: [], isLoading: false }),
}));

vi.mock('@/lib/notifications', () => ({
  getNotificationSettings: vi.fn().mockResolvedValue({
    id: 'settings',
    enabled: false,
    defaultReminder: 30,
    soundEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    permissionAsked: false,
    updatedAt: new Date().toISOString(),
  }),
  updateNotificationSettings: vi.fn().mockResolvedValue(undefined),
  requestNotificationPermission: vi.fn().mockResolvedValue('granted'),
}));

vi.mock('@/lib/sync/config', () => ({
  getSyncConfig: vi.fn().mockResolvedValue(null),
  getSyncStatus: vi.fn().mockResolvedValue({ enabled: false, pendingCount: 0 }),
  getAutoSyncConfig: vi.fn().mockResolvedValue({ enabled: false, intervalMinutes: 5 }),
  updateAutoSyncConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/archive', () => ({
  archiveOldTasks: vi.fn().mockResolvedValue(0),
  getArchiveSettings: vi.fn().mockResolvedValue({
    enabled: false,
    archiveAfterDays: 30,
  }),
  updateArchiveSettings: vi.fn().mockResolvedValue(undefined),
  getArchivedCount: vi.fn().mockResolvedValue(3),
}));

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn() })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock('@/components/reset-everything-dialog', () => ({
  ResetEverythingDialog: () => null,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

// --- Tests ---

describe('ArchiveSettings', () => {
  it('renders auto-archive toggle', async () => {
    render(<ArchiveSettings onViewArchive={vi.fn()} />);

    expect(await screen.findByText('Auto-archive')).toBeInTheDocument();
  });

  it('renders view archive button when archived tasks exist', async () => {
    render(<ArchiveSettings onViewArchive={vi.fn()} />);

    expect(await screen.findByText('View archive')).toBeInTheDocument();
  });
});

describe('DataManagement', () => {
  it('renders storage info with task counts', () => {
    render(
      <DataManagement
        activeTasks={5}
        completedTasks={3}
        totalTasks={8}
        estimatedSize="1.2"
        onExport={vi.fn()}
        onImportClick={vi.fn()}
      />
    );

    expect(screen.getByText('Active:')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Done:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders export and import buttons', () => {
    render(
      <DataManagement
        activeTasks={5}
        completedTasks={3}
        totalTasks={8}
        estimatedSize="1.2"
        onExport={vi.fn()}
        onImportClick={vi.fn()}
      />
    );

    expect(screen.getByText('Export tasks')).toBeInTheDocument();
    expect(screen.getByText('Import tasks')).toBeInTheDocument();
  });
});

describe('SyncSettings', () => {
  it('renders auto-sync toggle', async () => {
    render(<SyncSettings onViewHistory={vi.fn()} />);

    expect(await screen.findByText('Auto-sync')).toBeInTheDocument();
  });

  it('renders sync history link', async () => {
    render(<SyncSettings onViewHistory={vi.fn()} />);

    expect(await screen.findByText('Sync history')).toBeInTheDocument();
  });
});

describe('SettingsDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    showCompleted: false,
    onToggleCompleted: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
  };

  it('renders when open', async () => {
    render(<SettingsDialog {...defaultProps} />);

    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Preferences and configuration')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SettingsDialog {...defaultProps} open={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
