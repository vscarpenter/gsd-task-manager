import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FeaturesSection } from "@/components/about/features-section";
import { McpSection } from "@/components/about/mcp-section";

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
  // Recurrence and subtasks are modelled, rendered read-only on the card and in
  // the detail sheet, and fully implemented in the data layer — but no UI can
  // author either one. Advertising them as available oversells the product.
  // Asserting on the heading's accessible name, not just its text, so the
  // caveat reaches screen-reader users along with everyone else.
  it("should_mark_recurring_tasks_as_not_yet_available", () => {
    render(<FeaturesSection />);
    expect(
      screen.getByRole("heading", { name: /Recurring Tasks\s+Coming soon/i })
    ).toBeInTheDocument();
  });

  it("should_mark_subtasks_as_not_yet_available", () => {
    render(<FeaturesSection />);
    expect(
      screen.getByRole("heading", { name: /Subtasks\s+Coming soon/i })
    ).toBeInTheDocument();
  });

  it("should_not_badge_shipped_features", () => {
    render(<FeaturesSection />);
    const card = screen.getByRole("heading", { name: "Eisenhower Matrix" }).closest("div");
    expect(card?.textContent).not.toMatch(/coming soon/i);
  });
});
