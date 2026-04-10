import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsRow, SettingsSelectRow } from '@/components/settings/shared-components';
import { AboutSection } from '@/components/settings/about-section';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { NotificationSettingsSection } from '@/components/settings/notification-settings';

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

    it('renders privacy statement', () => {
      render(<AboutSection />);

      expect(screen.getByText(/All data is stored locally/)).toBeInTheDocument();
    });

    it('renders GitHub link', () => {
      render(<AboutSection />);

      expect(screen.getByText('View on GitHub')).toBeInTheDocument();
    });
  });

  describe('AppearanceSettings', () => {
    it('renders theme options', () => {
      render(
        <AppearanceSettings
          showCompleted={false}
          onToggleCompleted={vi.fn()}
        />
      );

      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('renders show completed toggle', () => {
      render(
        <AppearanceSettings
          showCompleted={true}
          onToggleCompleted={vi.fn()}
        />
      );

      expect(screen.getByText('Show completed')).toBeInTheDocument();
    });
  });

  describe('NotificationSettingsSection', () => {
    const baseProps = {
      onNotificationToggle: vi.fn(),
      onDefaultReminderChange: vi.fn(),
    };

    it('renders loading state when settings is null', () => {
      render(
        <NotificationSettingsSection
          settings={null}
          {...baseProps}
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders enabled state with push notifications label', () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted' },
        writable: true,
        configurable: true,
      });

      render(
        <NotificationSettingsSection
          settings={{ id: 'settings', enabled: true, defaultReminder: 30 }}
          {...baseProps}
        />
      );

      expect(screen.getByText('Push notifications')).toBeInTheDocument();
      expect(screen.getByText('Granted')).toBeInTheDocument();
    });
  });
});
