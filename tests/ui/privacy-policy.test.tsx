import { render, screen } from '@testing-library/react';
import { PrivacyPolicy } from '@/components/privacy/privacy-policy';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('PrivacyPolicy', () => {
  it('renders the document title and last-updated date', () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole('heading', { level: 1, name: /privacy policy/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/last updated june 5, 2026/i)).toBeInTheDocument();
  });

  it('renders every required section heading', () => {
    render(<PrivacyPolicy />);

    const sections = [
      /our approach/i,
      /what we collect/i,
      /local-first storage/i,
      /optional cloud sync/i,
      /third-party services/i,
      /error tracking/i,
      /your choices/i,
      /changes to this policy/i,
      /contact/i,
    ];

    for (const name of sections) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('describes cloud sync honestly: encrypted in transit, not end-to-end encrypted', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';

    // Accurate controls are disclosed.
    expect(text).toMatch(/in transit/i);
    expect(text).toMatch(/not end-to-end encrypted/i);

    // The previously-false marketing claim must never appear.
    expect(text).not.toMatch(/ciphertext/i);
    expect(text).not.toMatch(/cannot read your tasks/i);
  });

  it('discloses the third-party services that touch user data', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/google/i);
    expect(text).toMatch(/github/i);
    expect(text).toMatch(/aws|amazon web services/i);
  });

  it('discloses Sentry error tracking and that task content never leaves the device', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/sentry/i);
    expect(text).toMatch(/never|stripped|does not include|excluded/i);
  });

  it('provides a contact email', () => {
    render(<PrivacyPolicy />);

    expect(screen.getByText(/vscarpenter@gmail\.com/i)).toBeInTheDocument();
  });
});
