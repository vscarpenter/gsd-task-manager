import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsRow, SettingsSelectRow } from '@/components/settings/shared-components';
import { AboutSection } from '@/components/settings/about-section';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { NotificationSettingsSection } from '@/components/settings/notification-settings';
import { ArchiveSettings } from '@/components/settings/archive-settings';
import { DataManagement } from '@/components/settings/data-management';
import { SyncSettings } from '@/components/settings/sync-settings';

// --- Mock factories (mock* prefix allows use before vi.mock hoisting) ---

const mockSetTheme = vi.fn();
const mockGetArchiveSettings = vi.fn();
const mockUpdateArchiveSettings = vi.fn();
const mockArchiveOldTasks = vi.fn();
const mockGetArchivedCount = vi.fn();
const mockGetAutoSyncConfig = vi.fn();
const mockUpdateAutoSyncConfig = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: mockSetTheme })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/archive', () => ({
  getArchiveSettings: (...args: unknown[]) => mockGetArchiveSettings(...args),
  updateArchiveSettings: (...args: unknown[]) => mockUpdateArchiveSettings(...args),
  archiveOldTasks: (...args: unknown[]) => mockArchiveOldTasks(...args),
  getArchivedCount: (...args: unknown[]) => mockGetArchivedCount(...args),
}));

vi.mock('@/lib/sync/config', () => ({
  getAutoSyncConfig: (...args: unknown[]) => mockGetAutoSyncConfig(...args),
  updateAutoSyncConfig: (...args: unknown[]) => mockUpdateAutoSyncConfig(...args),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/components/reset-everything-dialog', () => ({
  ResetEverythingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reset-dialog">Reset Dialog</div> : null,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockSetTheme.mockClear();
  mockGetArchiveSettings.mockResolvedValue({ id: 'settings', enabled: true, archiveAfterDays: 30 });
  mockUpdateArchiveSettings.mockResolvedValue(undefined);
  mockArchiveOldTasks.mockResolvedValue(5);
  mockGetArchivedCount.mockResolvedValue(3);
  mockGetAutoSyncConfig.mockResolvedValue({ enabled: true, intervalMinutes: 2 });
  mockUpdateAutoSyncConfig.mockResolvedValue(undefined);
});

// --- Tests ---

describe('Settings Components', () => {
  describe('SettingsRow', () => {
    it('renders label and children', () => {
      render(
        <SettingsRow label="Test Label">
          <span>child content</span>
        </SettingsRow>
      );
      expect(screen.getByText('Test Label')).toBeInTheDocument();
      expect(screen.getByText('child content')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(
        <SettingsRow label="Label" description="Some desc">
          <span>content</span>
        </SettingsRow>
      );
      expect(screen.getByText('Some desc')).toBeInTheDocument();
    });
  });

  describe('SettingsSelectRow', () => {
    it('renders label and triggers onChange', () => {
      const handleChange = vi.fn();
      render(
        <SettingsSelectRow
          label="Sort Order"
          value="Newest"
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
          ]}
          onChange={handleChange}
        />
      );
      expect(screen.getByText('Sort Order')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'oldest' } });
      expect(handleChange).toHaveBeenCalledWith('oldest');
    });
  });

  describe('AboutSection', () => {
    it('renders version label', () => {
      render(<AboutSection />);
      expect(screen.getByText('Version')).toBeInTheDocument();
    });

    it('renders build date row', () => {
      render(<AboutSection />);
      expect(screen.getByText('Build')).toBeInTheDocument();
    });

    it('renders privacy statement', () => {
      render(<AboutSection />);
      expect(screen.getByText(/All data is stored locally/)).toBeInTheDocument();
    });

    it('renders GitHub link with correct href', () => {
      render(<AboutSection />);
      const link = screen.getByText('View on GitHub');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        'https://github.com/vscarpenter/gsd-task-manager'
      );
    });
  });

  describe('AppearanceSettings', () => {
    it('renders all three theme options', () => {
      render(<AppearanceSettings showCompleted={false} onToggleCompleted={vi.fn()} />);
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('renders show completed label', () => {
      render(<AppearanceSettings showCompleted={false} onToggleCompleted={vi.fn()} />);
      expect(screen.getByText('Show completed')).toBeInTheDocument();
    });

    it('clicking Dark calls setTheme("dark")', () => {
      render(<AppearanceSettings showCompleted={false} onToggleCompleted={vi.fn()} />);
      fireEvent.click(screen.getByText('Dark'));
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('clicking Light calls setTheme("light")', () => {
      render(<AppearanceSettings showCompleted={false} onToggleCompleted={vi.fn()} />);
      fireEvent.click(screen.getByText('Light'));
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('clicking Auto calls setTheme("system")', () => {
      render(<AppearanceSettings showCompleted={false} onToggleCompleted={vi.fn()} />);
      fireEvent.click(screen.getByText('Auto'));
      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });

    it('toggling show completed calls onToggleCompleted', () => {
      const onToggle = vi.fn();
      render(<AppearanceSettings showCompleted={false} onToggleCompleted={onToggle} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onToggle).toHaveBeenCalled();
    });

    it('switch reflects showCompleted=true state', () => {
      render(<AppearanceSettings showCompleted={true} onToggleCompleted={vi.fn()} />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('NotificationSettingsSection', () => {
    const enabledSettings = {
      id: 'settings' as const,
      enabled: true,
      defaultReminder: 30,
      soundEnabled: true,
      permissionAsked: true,
      updatedAt: new Date().toISOString(),
    };

    it('renders loading state when settings is null', () => {
      render(
        <NotificationSettingsSection
          settings={null}
          onNotificationToggle={vi.fn()}
          onDefaultReminderChange={vi.fn()}
        />
      );
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders push notifications row when settings provided', () => {
      render(
        <NotificationSettingsSection
          settings={enabledSettings}
          onNotificationToggle={vi.fn()}
          onDefaultReminderChange={vi.fn()}
        />
      );
      expect(screen.getByText('Push notifications')).toBeInTheDocument();
    });

    it('shows default reminder select when notifications enabled', () => {
      render(
        <NotificationSettingsSection
          settings={enabledSettings}
          onNotificationToggle={vi.fn()}
          onDefaultReminderChange={vi.fn()}
        />
      );
      expect(screen.getByText('Default reminder')).toBeInTheDocument();
    });

    it('hides default reminder select when notifications disabled', () => {
      render(
        <NotificationSettingsSection
          settings={{ ...enabledSettings, enabled: false }}
          onNotificationToggle={vi.fn()}
          onDefaultReminderChange={vi.fn()}
        />
      );
      expect(screen.queryByText('Default reminder')).not.toBeInTheDocument();
    });

    it('clicking the switch calls onNotificationToggle', () => {
      const onToggle = vi.fn();
      render(
        <NotificationSettingsSection
          settings={enabledSettings}
          onNotificationToggle={onToggle}
          onDefaultReminderChange={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole('switch'));
      expect(onToggle).toHaveBeenCalled();
    });

    it('shows Granted permission badge when Notification API is available', () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted' },
        writable: true,
        configurable: true,
      });
      render(
        <NotificationSettingsSection
          settings={enabledSettings}
          onNotificationToggle={vi.fn()}
          onDefaultReminderChange={vi.fn()}
        />
      );
      expect(screen.getByText('Granted')).toBeInTheDocument();
    });
  });

  describe('ArchiveSettings', () => {
    it('shows auto-archive toggle after loading', async () => {
      render(<ArchiveSettings onViewArchive={vi.fn()} />);
      expect(await screen.findByText('Auto-archive')).toBeInTheDocument();
    });

    it('shows archive after select when auto-archive is enabled', async () => {
      render(<ArchiveSettings onViewArchive={vi.fn()} />);
      expect(await screen.findByText('Archive after')).toBeInTheDocument();
    });

    it('shows view archive button with archived count', async () => {
      render(<ArchiveSettings onViewArchive={vi.fn()} />);
      expect(await screen.findByText('View archive')).toBeInTheDocument();
      expect(await screen.findByText(/3 tasks/)).toBeInTheDocument();
    });

    it('clicking view archive calls onViewArchive', async () => {
      const onViewArchive = vi.fn();
      render(<ArchiveSettings onViewArchive={onViewArchive} />);
      fireEvent.click(await screen.findByText('View archive'));
      expect(onViewArchive).toHaveBeenCalled();
    });

    it('clicking Archive now Run button calls archiveOldTasks', async () => {
      render(<ArchiveSettings onViewArchive={vi.fn()} />);
      await screen.findByText('Auto-archive');
      await act(async () => {
        fireEvent.click(screen.getByText('Run'));
      });
      expect(mockArchiveOldTasks).toHaveBeenCalled();
    });

    it('toggling auto-archive calls updateArchiveSettings with new value', async () => {
      render(<ArchiveSettings onViewArchive={vi.fn()} />);
      await screen.findByText('Auto-archive');
      await act(async () => {
        fireEvent.click(screen.getByRole('switch'));
      });
      expect(mockUpdateArchiveSettings).toHaveBeenCalledWith({ enabled: false });
    });

    it('hides view archive button when archived count is 0', async () => {
      mockGetArchivedCount.mockResolvedValue(0);
      render(<ArchiveSettings onViewArchive={vi.fn()} />);
      await screen.findByText('Auto-archive');
      expect(screen.queryByText('View archive')).not.toBeInTheDocument();
    });
  });

  describe('DataManagement', () => {
    const defaultProps = {
      activeTasks: 5,
      completedTasks: 3,
      totalTasks: 8,
      estimatedSize: '1.2',
      onExport: vi.fn().mockResolvedValue(undefined),
      onImportClick: vi.fn(),
    };

    it('renders local storage size and total task count', () => {
      render(<DataManagement {...defaultProps} />);
      expect(screen.getByText('1.2 KB')).toBeInTheDocument();
      expect(screen.getByText('8 tasks')).toBeInTheDocument();
    });

    it('renders active and completed task counts', () => {
      render(<DataManagement {...defaultProps} />);
      expect(screen.getByText('Active:')).toBeInTheDocument();
      expect(screen.getByText('Done:')).toBeInTheDocument();
    });

    it('renders export and import action rows', () => {
      render(<DataManagement {...defaultProps} />);
      expect(screen.getByText('Export tasks')).toBeInTheDocument();
      expect(screen.getByText('Import tasks')).toBeInTheDocument();
    });

    it('clicking Export tasks calls onExport', () => {
      const onExport = vi.fn().mockResolvedValue(undefined);
      render(<DataManagement {...defaultProps} onExport={onExport} />);
      fireEvent.click(screen.getByText('Export tasks'));
      expect(onExport).toHaveBeenCalled();
    });

    it('clicking Import tasks calls onImportClick', () => {
      const onImportClick = vi.fn();
      render(<DataManagement {...defaultProps} onImportClick={onImportClick} />);
      fireEvent.click(screen.getByText('Import tasks'));
      expect(onImportClick).toHaveBeenCalled();
    });

    it('clicking Reset everything opens the reset dialog', () => {
      render(<DataManagement {...defaultProps} />);
      fireEvent.click(screen.getByText('Reset everything'));
      expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
    });

    it('buttons are disabled when isLoading is true', () => {
      render(<DataManagement {...defaultProps} isLoading={true} />);
      expect(screen.getByText('Export tasks').closest('button')).toBeDisabled();
      expect(screen.getByText('Import tasks').closest('button')).toBeDisabled();
    });
  });

  describe('SyncSettings', () => {
    it('renders auto-sync toggle after loading', async () => {
      render(<SyncSettings onViewHistory={vi.fn()} />);
      expect(await screen.findByText('Auto-sync')).toBeInTheDocument();
    });

    it('shows sync interval select when auto-sync is enabled', async () => {
      render(<SyncSettings onViewHistory={vi.fn()} />);
      expect(await screen.findByText('Sync interval')).toBeInTheDocument();
    });

    it('shows smart triggers info when auto-sync is enabled', async () => {
      render(<SyncSettings onViewHistory={vi.fn()} />);
      expect(await screen.findByText('Smart triggers')).toBeInTheDocument();
    });

    it('renders sync history button', async () => {
      render(<SyncSettings onViewHistory={vi.fn()} />);
      expect(await screen.findByText('Sync history')).toBeInTheDocument();
    });

    it('clicking Sync history calls onViewHistory', async () => {
      const onViewHistory = vi.fn();
      render(<SyncSettings onViewHistory={onViewHistory} />);
      fireEvent.click(await screen.findByText('Sync history'));
      expect(onViewHistory).toHaveBeenCalled();
    });

    it('toggling auto-sync calls updateAutoSyncConfig with new value', async () => {
      render(<SyncSettings onViewHistory={vi.fn()} />);
      await screen.findByText('Auto-sync');
      await act(async () => {
        fireEvent.click(screen.getByRole('switch'));
      });
      expect(mockUpdateAutoSyncConfig).toHaveBeenCalledWith(false, 2);
    });

    it('hides sync interval when auto-sync is disabled', async () => {
      mockGetAutoSyncConfig.mockResolvedValue({ enabled: false, intervalMinutes: 5 });
      render(<SyncSettings onViewHistory={vi.fn()} />);
      await screen.findByText('Auto-sync');
      expect(screen.queryByText('Sync interval')).not.toBeInTheDocument();
    });
  });
});
