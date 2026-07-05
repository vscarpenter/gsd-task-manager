import { render, screen } from '@testing-library/react';
import { CheckIcon } from 'lucide-react';
import { HeroSection } from '@/components/about/hero-section';
import { FeatureCard } from '@/components/about/feature-card';
import { FeaturesSection } from '@/components/about/features-section';
import { MatrixSection } from '@/components/about/matrix-section';
import { PrivacySection } from '@/components/about/privacy-section';
import { McpSection } from '@/components/about/mcp-section';
import { FooterCta } from '@/components/about/footer-cta';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/about/scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('About Components', () => {
  describe('HeroSection', () => {
    it('renders headline and CTA', () => {
      render(<HeroSection />);

      expect(screen.getByText(/Stop juggling/)).toBeInTheDocument();
      expect(screen.getByText(/Open App/)).toBeInTheDocument();
    });
  });

  describe('FeatureCard', () => {
    it('renders icon, title, and description', () => {
      render(
        <FeatureCard
          icon={CheckIcon}
          title="Test Title"
          description="Test desc"
        />
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test desc')).toBeInTheDocument();
    });
  });

  describe('FeaturesSection', () => {
    it('renders feature grid with heading and feature titles', () => {
      render(<FeaturesSection />);

      expect(screen.getByText(/Everything you need/)).toBeInTheDocument();
      expect(screen.getByText('Eisenhower Matrix')).toBeInTheDocument();
    });
  });

  describe('MatrixSection', () => {
    it('renders matrix explanation and quadrant names', () => {
      render(<MatrixSection />);

      expect(screen.getByText('The Eisenhower Matrix')).toBeInTheDocument();
      expect(screen.getByText('Do First')).toBeInTheDocument();
    });
  });

  describe('PrivacySection', () => {
    it('renders privacy headline', () => {
      render(<PrivacySection />);

      expect(screen.getByText('Your tasks stay on your device.')).toBeInTheDocument();
    });

    it('does not make a false end-to-end encryption claim', () => {
      const { container } = render(<PrivacySection />);
      const text = container.textContent ?? '';

      expect(text).not.toMatch(/ciphertext/i);
      expect(text).not.toMatch(/end-to-end/i);
    });

    it('links to the full privacy policy', () => {
      render(<PrivacySection />);

      const link = screen.getByRole('link', { name: /privacy policy/i });
      expect(link).toHaveAttribute('href', 'https://gsdtaskmanager.com/privacy/');
    });
  });

  describe('McpSection', () => {
    it('renders MCP headline', () => {
      render(<McpSection />);

      expect(screen.getByText('Let Claude manage your tasks.')).toBeInTheDocument();
    });
  });

  describe('FooterCta', () => {
    it('renders CTA text and version', () => {
      render(<FooterCta version="1.0.0" />);

      expect(screen.getByText('Ready to get stuff done?')).toBeInTheDocument();
      expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    });

    it('links to the privacy policy', () => {
      render(<FooterCta version="1.0.0" />);

      const link = screen.getByRole('link', { name: /privacy/i });
      expect(link).toHaveAttribute('href', 'https://gsdtaskmanager.com/privacy/');
    });
  });

});
