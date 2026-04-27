/**
 * Tests for App Router page components with 0% coverage:
 * - app/layout.tsx (RootLayout)
 * - app/about/page.tsx (AboutPage)
 * - app/(pwa)/install/page.tsx (InstallPage)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks (must be before component imports) ---

vi.mock('next/font/google', () => ({
  Geist: () => ({ className: 'mock-geist', variable: '--font-sans' }),
  Geist_Mono: () => ({ className: 'mock-geist-mono', variable: '--font-mono' }),
  Instrument_Serif: () => ({ className: 'mock-instrument', variable: '--font-instrument-serif' }),
}));

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/components/pwa-register', () => ({
  PwaRegister: () => null,
}));

vi.mock('@/components/install-pwa-prompt', () => ({
  InstallPwaPrompt: () => null,
}));

vi.mock('@/components/pwa-update-toast', () => ({
  PwaUpdateToast: () => null,
}));

vi.mock('@/components/client-layout', () => ({
  ClientLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="client-layout">{children}</div>
  ),
}));

vi.mock('@/components/query-provider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/first-time-redirect', () => ({
  FirstTimeRedirect: () => null,
}));

// Mock AppShell — render caption and topbarRightSlot so page-level assertions still work
vi.mock('@/components/matrix-simplified/app-shell', () => ({
  AppShell: ({
    children,
    caption,
    topbarRightSlot,
  }: {
    children: React.ReactNode;
    caption?: React.ReactNode;
    topbarRightSlot?: React.ReactNode;
  }) => (
    <>
      {caption && <div data-testid="shell-caption">{caption}</div>}
      {topbarRightSlot}
      {children}
    </>
  ),
}));

// About page mocks
vi.mock('@/components/about/about-nav', () => ({
  AboutNav: () => <nav data-testid="about-nav">Nav</nav>,
}));

vi.mock('@/components/about/hero-section', () => ({
  HeroSection: () => <section data-testid="hero-section">Hero</section>,
}));

vi.mock('@/components/about/matrix-section', () => ({
  MatrixSection: () => <section data-testid="matrix-section">Matrix</section>,
}));

vi.mock('@/components/about/features-section', () => ({
  FeaturesSection: () => <section data-testid="features-section">Features</section>,
}));

vi.mock('@/components/about/privacy-section', () => ({
  PrivacySection: () => <section data-testid="privacy-section">Privacy</section>,
}));

vi.mock('@/components/about/mcp-section', () => ({
  McpSection: () => <section data-testid="mcp-section">MCP</section>,
}));

vi.mock('@/components/about/footer-cta', () => ({
  FooterCta: ({ version }: { version: string }) => (
    <footer data-testid="footer-cta">v{version}</footer>
  ),
}));

vi.mock('@/package.json', () => ({
  default: { version: '1.0.0-test' },
}));

// --- Component Imports ---

import RootLayout from '@/app/layout';
import AboutPage from '@/app/about/page';
import InstallPage from '@/app/(pwa)/install/page';

// --- Tests ---

describe('RootLayout', () => {
  it('renders children inside layout wrapper', () => {
    render(
      <RootLayout>
        <div data-testid="child-content">Hello GSD</div>
      </RootLayout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByTestId('client-layout')).toBeInTheDocument();
  });

  it('renders Toaster component', () => {
    render(
      <RootLayout>
        <p>content</p>
      </RootLayout>
    );

    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('renders a CSP that restricts form submissions', () => {
    render(
      <RootLayout>
        <p>content</p>
      </RootLayout>
    );

    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(csp).toHaveAttribute('content', expect.stringContaining("form-action 'self'"));
    expect(csp).toHaveAttribute('content', expect.stringContaining("object-src 'none'"));
    expect(csp).toHaveAttribute('content', expect.stringContaining("base-uri 'self'"));
  });
});

describe('AboutPage', () => {
  it('renders all about page sections', () => {
    render(<AboutPage />);

    // Note: AboutNav was removed when AppShell wrapping was added in Task 14;
    // navigation is now handled by AppShell (mocked in tests).
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-section')).toBeInTheDocument();
    expect(screen.getByTestId('features-section')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-section')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-section')).toBeInTheDocument();
    expect(screen.getByTestId('footer-cta')).toBeInTheDocument();
  });

  it('passes package version to FooterCta', () => {
    render(<AboutPage />);

    expect(screen.getByTestId('footer-cta')).toHaveTextContent('v1.0.0-test');
  });
});

describe('InstallPage', () => {
  it('renders install instructions heading', () => {
    render(<InstallPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Install GSD Task Manager'
    );
  });

  it('renders Desktop, iOS, and Android sections', () => {
    render(<InstallPage />);

    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByText('iOS')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
  });

  it('renders install steps as ordered lists', () => {
    const { container } = render(<InstallPage />);

    const orderedLists = container.querySelectorAll('ol');
    expect(orderedLists.length).toBe(3);
  });
});
