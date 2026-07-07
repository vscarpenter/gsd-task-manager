import { describe, it, expect } from "vitest";
import { parseRiskTier, RISK_TIERS } from "../scripts/parse-risk-tier.cjs";

const body = (value: string) =>
  `### Summary\n\nDo the thing\n\n### Risk tier\n\n${value}\n\n### Additional context\n\n_No response_`;

describe("parseRiskTier", () => {
  it("exposes the four canonical tiers", () => {
    expect(RISK_TIERS).toEqual(["docs", "chore", "feature", "risky"]);
  });

  it.each(RISK_TIERS)("parses a valid tier: %s", (tier) => {
    expect(parseRiskTier(body(tier))).toBe(tier);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(parseRiskTier(body("  Feature  "))).toBe("feature");
  });

  it("handles CRLF line endings", () => {
    expect(parseRiskTier("### Risk tier\r\n\r\nrisky\r\n")).toBe("risky");
  });

  it("returns null when the heading is absent", () => {
    expect(parseRiskTier("### Summary\n\nno risk field here")).toBeNull();
  });

  it("returns null for an unanswered dropdown (_No response_)", () => {
    expect(parseRiskTier(body("_No response_"))).toBeNull();
  });

  it("returns null when the answer is not one of the four tiers", () => {
    expect(parseRiskTier(body("medium"))).toBeNull();
  });

  it("returns null when the section is empty (next heading follows)", () => {
    expect(parseRiskTier("### Risk tier\n\n### Next\n\nx")).toBeNull();
  });

  it.each([null, undefined, "", 123 as unknown as string])(
    "returns null for non-string/empty input: %s",
    (input) => {
      expect(parseRiskTier(input as string)).toBeNull();
    }
  );
});
