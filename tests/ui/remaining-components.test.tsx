/**
 * Coverage gap-closing tests for uncovered components:
 * - FirstTimeRedirect (0%)
 * - ClientLayout (0%)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks ---

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/sync/sync-provider', () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sync-provider">{children}</div>
  ),
}));

vi.mock('@/lib/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({
    isSyncing: false,
    status: 'idle',
    error: null,
    lastResult: null,
    sync: vi.fn(),
    isAuthenticated: false,
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

// --- Component Imports (after mocks) ---

import { FirstTimeRedirect } from '@/components/first-time-redirect';
import { ClientLayout } from '@/components/client-layout';

// --- FirstTimeRedirect Tests ---

describe('FirstTimeRedirect', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    localStorage.removeItem('gsd-has-launched');
    mockPathname = '/';
  });

  it('redirects to /about on first visit', () => {
    render(<FirstTimeRedirect />);

    expect(mockReplace).toHaveBeenCalledWith('/about');
  });

  it('sets localStorage flag on first visit', () => {
    render(<FirstTimeRedirect />);

    expect(localStorage.getItem('gsd-has-launched')).toBe('true');
  });

  it('does not redirect when localStorage flag exists', () => {
    localStorage.setItem('gsd-has-launched', 'true');

    render(<FirstTimeRedirect />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect when already on /about', () => {
    mockPathname = '/about';

    render(<FirstTimeRedirect />);

    // Flag is set but no redirect because we're already on /about
    expect(localStorage.getItem('gsd-has-launched')).toBe('true');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders null (no visible UI)', () => {
    const { container } = render(<FirstTimeRedirect />);

    expect(container.innerHTML).toBe('');
  });
});

// --- ClientLayout Tests ---

describe('ClientLayout', () => {
  it('renders children inside SyncProvider', () => {
    render(
      <ClientLayout>
        <div data-testid="child">Child Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId('sync-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('wraps children with sync provider', () => {
    render(
      <ClientLayout>
        <p>Test</p>
      </ClientLayout>
    );

    const syncProvider = screen.getByTestId('sync-provider');
    expect(syncProvider).toContainHTML('<p>Test</p>');
  });
});
