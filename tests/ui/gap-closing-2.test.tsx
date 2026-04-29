/**
 * Gap-closing UI tests for InstallPwaPrompt
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    type?: string;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/lib/routes', () => ({
  ROUTES: { INSTALL: '/install' },
}));

vi.mock('@/lib/constants', () => ({
  TIME_MS: { DAY: 86400000 },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { InstallPwaPrompt } from '@/components/install-pwa-prompt';

describe('InstallPwaPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('gsd-pwa-dismissed');

    // Mock matchMedia to return not standalone
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('should not render initially (before beforeinstallprompt event)', () => {
    render(<InstallPwaPrompt />);

    // The prompt only shows after the beforeinstallprompt event or for Safari
    expect(
      screen.queryByText('Install GSD Task Manager')
    ).not.toBeInTheDocument();
  });

  it('should render when beforeinstallprompt event fires', async () => {
    render(<InstallPwaPrompt />);

    // Fire the beforeinstallprompt event inside act
    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: vi.fn() });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByText('Install GSD Task Manager')).toBeInTheDocument();
    });
  });

  it('should render Install Now button when deferred prompt is available', async () => {
    render(<InstallPwaPrompt />);

    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', {
        value: vi.fn().mockResolvedValue(undefined),
      });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByText('Install Now')).toBeInTheDocument();
    });
  });

  it('should render dismiss button with accessible label', async () => {
    render(<InstallPwaPrompt />);

    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: vi.fn() });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText('Dismiss install prompt')
      ).toBeInTheDocument();
    });
  });

  it('should hide prompt and save dismissal timestamp on Not Now click', async () => {
    const user = userEvent.setup();

    render(<InstallPwaPrompt />);

    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: vi.fn() });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByText('Not Now')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Not Now'));

    expect(
      screen.queryByText('Install GSD Task Manager')
    ).not.toBeInTheDocument();
    expect(localStorage.getItem('gsd-pwa-dismissed')).toBeTruthy();
  });

  it('should not render if already installed (standalone mode)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<InstallPwaPrompt />);

    expect(
      screen.queryByText('Install GSD Task Manager')
    ).not.toBeInTheDocument();
  });

  it('should not re-show after dismissal when beforeinstallprompt fires again', async () => {
    const user = userEvent.setup();
    render(<InstallPwaPrompt />);

    // Fire the event the first time
    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: vi.fn() });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByText('Install GSD Task Manager')).toBeInTheDocument();
    });

    // Dismiss the prompt
    await user.click(screen.getByText('Not Now'));
    expect(screen.queryByText('Install GSD Task Manager')).not.toBeInTheDocument();

    // Browser fires beforeinstallprompt again (e.g., on SPA navigation)
    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: vi.fn() });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    // Prompt should NOT reappear within the 7-day cooldown window
    expect(screen.queryByText('Install GSD Task Manager')).not.toBeInTheDocument();
  });

  it('should have role="dialog" with proper aria attributes', async () => {
    render(<InstallPwaPrompt />);

    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: vi.fn() });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'install-pwa-title');
      expect(dialog).toHaveAttribute(
        'aria-describedby',
        'install-pwa-description'
      );
    });
  });
});
