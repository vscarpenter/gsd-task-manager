/**
 * Final push for function coverage threshold.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// About section components (75% func)
// ---------------------------------------------------------------------------

vi.mock("@/components/about/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("AboutSection components", () => {
  it("HeroSection renders headline", async () => {
    const { HeroSection } = await import("@/components/about/hero-section");
    render(<HeroSection />);
    expect(screen.getByText(/GSD/)).toBeInTheDocument();
  });

  it("PrivacySection renders", async () => {
    const { PrivacySection } = await import("@/components/about/privacy-section");
    render(<PrivacySection />);
    expect(screen.getByText(/your device/i)).toBeInTheDocument();
  });

  it("FooterCta renders", async () => {
    const { FooterCta } = await import("@/components/about/footer-cta");
    render(<FooterCta />);
    expect(document.body.textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// NotFound page
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("NotFound page", () => {
  it("renders 404 heading", async () => {
    const { default: NotFound } = await import("@/app/not-found");
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CommandGroup
// ---------------------------------------------------------------------------

describe("CommandGroup", () => {
  it("returns null for empty actions", async () => {
    const { CommandGroup } = await import("@/components/command-palette/command-group");
    const { container } = render(<CommandGroup heading="Test" actions={[]} onExecute={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
