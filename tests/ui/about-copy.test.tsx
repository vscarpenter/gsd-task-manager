import { render } from "@testing-library/react";
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
