import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseRiskTier, RISK_TIERS } from "../scripts/parse-risk-tier.cjs";

const body = (value: string) =>
  `### Summary\n\nDo the thing\n\n### Risk tier\n\n${value}\n\n### Additional context\n\n_No response_`;

function riskDropdownOptions(): string[] {
  const template = readFileSync(
    ".github/ISSUE_TEMPLATE/change_request.yml",
    "utf8"
  );
  const riskField = template.match(
    /id: risk[\s\S]*?options:\n(?<options>(?:\s{8}- .+\n)+)/
  );

  expect(riskField?.groups?.options).toBeDefined();

  return riskField!.groups!.options
    .trim()
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim());
}

describe("parseRiskTier", () => {
  it("exposes the four canonical tiers", () => {
    expect(RISK_TIERS).toEqual(["docs", "chore", "feature", "risky"]);
  });

  it("stays in lockstep with the change request risk dropdown", () => {
    expect(riskDropdownOptions()).toEqual(RISK_TIERS);
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

  it("returns null when the heading has no following value at all", () => {
    expect(parseRiskTier("### Risk tier")).toBeNull();
    expect(parseRiskTier("### Risk tier\n\n   \n")).toBeNull();
  });

  it.each([null, undefined, "", 123 as unknown as string])(
    "returns null for non-string/empty input: %s",
    (input) => {
      expect(parseRiskTier(input as string)).toBeNull();
    }
  );
});
