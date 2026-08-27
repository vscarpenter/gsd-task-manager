import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FeaturesSection } from "@/components/about/features-section";
import { McpSection } from "@/components/about/mcp-section";
import { PrivacySection } from "@/components/about/privacy-section";

describe("about-page privacy copy", () => {
  it("should_not_claim_zero_knowledge_or_e2e", () => {
    const { container } = render(<FeaturesSection />);
    expect(container.textContent).not.toMatch(/zero-knowledge/i);
    expect(container.textContent).not.toMatch(/end-to-end/i);
  });

  it("should_not_reference_stale_encryption_passphrase", () => {
    const { container } = render(<McpSection />);
    expect(container.textContent).not.toMatch(/ENCRYPTION_PASSPHRASE/);
  });
});

describe("about-page shipped-feature claims", () => {
  // Recurrence and subtasks were badged "Coming soon" while the schema and the
  // engine existed but no UI could reach them. Both are authorable now, so the
  // page can claim them plainly again.
  it("should_claim_recurring_tasks_without_a_caveat", () => {
    render(<FeaturesSection />);
    expect(screen.getByRole("heading", { name: "Recurring Tasks" })).toBeInTheDocument();
  });

  it("should_claim_subtasks_without_a_caveat", () => {
    render(<FeaturesSection />);
    expect(screen.getByRole("heading", { name: "Subtasks" })).toBeInTheDocument();
  });

  it("should_not_badge_any_feature_as_coming_soon", () => {
    const { container } = render(<FeaturesSection />);
    expect(container.textContent).not.toMatch(/coming soon/i);
  });
});

describe("about-page feedback disclosure", () => {
  // Feedback is a new outbound path. The page's "no analytics tracking what
  // you type" claim stays true because that is about passive collection, but
  // staying silent about an explicit path would itself be the dark pattern.
  it("should_disclose_that_feedback_is_opt_in", () => {
    const { container } = render(<PrivacySection />);
    expect(container.textContent).toMatch(/feedback/i);
    expect(container.textContent).toMatch(/anonymous/i);
  });

  it("should_not_overclaim_that_nothing_ever_leaves", () => {
    const { container } = render(<PrivacySection />);
    expect(container.textContent).not.toMatch(/never leaves your device/i);
    expect(container.textContent).not.toMatch(/nothing (?:is |ever )?(?:sent|collected)/i);
  });
});
