import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    setTheme: mockSetTheme,
    resolvedTheme: 'light',
  })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/lib/use-view-transition', () => ({
  useViewTransition: () => ({
    navigateWithTransition: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => <button onClick={onSelect}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// --- Imports ---

import { ThemeToggle } from '@/components/theme-toggle';
import { ViewToggle } from '@/components/view-toggle';
import { KeyboardHintsToast } from '@/components/keyboard-hints-toast';
import { PwaRegister } from '@/components/pwa-register';
import { HeaderActions } from '@/components/app-header/header-actions';
import { useTheme } from 'next-themes';

// --- ThemeToggle ---

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });
  });

  it('renders a toggle button with correct aria-label', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('shows tooltip text for switching to dark mode when light', () => {
    render(<ThemeToggle />);
    expect(screen.getByText(/switch to dark mode/i)).toBeInTheDocument();
  });

  it('calls setTheme when clicked', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});

// --- ViewToggle ---

describe('ViewToggle', () => {
  it('renders Matrix and Dashboard buttons', () => {
    render(<ViewToggle />);
    expect(screen.getByRole('button', { name: /matrix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('marks Matrix as current page on home route', () => {
    render(<ViewToggle />);
    expect(screen.getByRole('button', { name: /matrix/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /dashboard/i })).not.toHaveAttribute('aria-current');
  });
});

// --- KeyboardHintsToast ---

describe('KeyboardHintsToast', () => {
  beforeEach(() => {
    localStorage.removeItem('gsd-keyboard-hints-dismissed');
  });

  it('renders keyboard shortcuts text when not dismissed', () => {
    render(<KeyboardHintsToast />);
    expect(screen.getByText(/new task/i)).toBeInTheDocument();
    expect(screen.getByText(/search/i)).toBeInTheDocument();
    expect(screen.getByText(/palette/i)).toBeInTheDocument();
  });

  it('has a dismiss button', () => {
    render(<KeyboardHintsToast />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('hides content after dismiss', () => {
    render(<KeyboardHintsToast />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/new task/i)).not.toBeInTheDocument();
  });

  it('sets localStorage dismissed flag after dismiss', () => {
    render(<KeyboardHintsToast />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(localStorage.getItem('gsd-keyboard-hints-dismissed')).toBe('1');
  });
});

// --- PwaRegister ---

describe('PwaRegister', () => {
  it('renders nothing (returns null)', () => {
    const { container } = render(<PwaRegister />);
    expect(container.innerHTML).toBe('');
  });

  it('registers service worker when available', async () => {
    const mockRegister = vi.fn().mockResolvedValue({
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
        ready: Promise.resolve({ periodicSync: undefined }),
      },
      configurable: true,
      writable: true,
    });

    render(<PwaRegister />);
    // Allow the async register() to run
    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    });
  });
});

// --- HeaderActions ---

describe('HeaderActions', () => {
  const defaultProps = {
    onHelp: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenAbout: vi.fn(),
    selectionMode: false,
    selectedCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onOpenSettings when the Settings menu item is selected', () => {
    const onOpenSettings = vi.fn();
    render(<HeaderActions {...defaultProps} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('calls onHelp when the Help menu item is selected', () => {
    const onHelp = vi.fn();
    render(<HeaderActions {...defaultProps} onHelp={onHelp} />);

    fireEvent.click(screen.getByRole('button', { name: /^help$/i }));

    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenAbout when the About menu item is selected', () => {
    const onOpenAbout = vi.fn();
    render(<HeaderActions {...defaultProps} onOpenAbout={onOpenAbout} />);

    fireEvent.click(screen.getByRole('button', { name: /^about$/i }));

    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });
});
