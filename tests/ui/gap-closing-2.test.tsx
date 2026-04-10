/**
 * Gap-closing UI tests for components with 0% coverage
 * Targets: BulkTagDialog, InstallPwaPrompt
 * (SyncAuthDialog already has extensive tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// BulkTagDialog mocks
// ============================================================================

vi.mock('@/lib/use-all-tags', () => ({
  useAllTags: () => ['work', 'personal', 'urgent'],
}));

vi.mock('@/components/tag-autocomplete-input', () => ({
  TagAutocompleteInput: ({
    value,
    onChange,
    onSelect,
    onEnterWithoutSelection,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    onSelect: (tag: string) => void;
    onEnterWithoutSelection: () => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="tag-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnterWithoutSelection();
      }}
    />
  ),
}));

// Mock Dialog components to render children directly
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
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

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => (
    <label>{children}</label>
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

import { BulkTagDialog } from '@/components/bulk-tag-dialog';
import { InstallPwaPrompt } from '@/components/install-pwa-prompt';

describe('BulkTagDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    selectedCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog title with selected count', () => {
    render(<BulkTagDialog {...defaultProps} />);

    // Title appears in both the heading and the confirm button
    const matches = screen.getAllByText('Add Tags to 3 Tasks');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should render description text', () => {
    render(<BulkTagDialog {...defaultProps} />);

    expect(
      screen.getByText('Select or enter tags to apply to all selected tasks')
    ).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    render(<BulkTagDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Add Tags to 3 Tasks')).not.toBeInTheDocument();
  });

  it('should render Add button', () => {
    render(<BulkTagDialog {...defaultProps} />);

    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('should render Cancel button', () => {
    render(<BulkTagDialog {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should have confirm button disabled when no tags are added', () => {
    render(<BulkTagDialog {...defaultProps} />);

    // Text appears in both heading and button; find the button specifically
    const buttons = screen.getAllByText('Add Tags to 3 Tasks');
    const confirmButton = buttons.find((el) => el.tagName === 'BUTTON');
    expect(confirmButton).toBeDisabled();
  });

  it('should call onOpenChange(false) and reset when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<BulkTagDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should render tag input with placeholder', () => {
    render(<BulkTagDialog {...defaultProps} />);

    expect(
      screen.getByPlaceholderText('Add tag (e.g., work, urgent)')
    ).toBeInTheDocument();
  });
});

describe('InstallPwaPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

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
