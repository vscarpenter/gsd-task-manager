import { describe, it, expect } from "vitest";
import { extractRunTokens, totalTokens, parsePr } from "../scripts/extract-run-tokens.cjs";

const runJson = (overrides: Record<string, unknown> = {}) => ({
  type: "result",
  result: "Opened the PR.\nOPENED_PR=123",
  usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 200, cache_read_input_tokens: 3000 },
  ...overrides,
});

describe("totalTokens", () => {
  it("sums all *_tokens fields present", () => {
    expect(totalTokens({ input_tokens: 10, output_tokens: 5 })).toBe(15);
    expect(totalTokens({ input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 200, cache_read_input_tokens: 3000 })).toBe(4700);
  });
  it("is 0 for missing/invalid usage", () => {
    expect(totalTokens(undefined)).toBe(0);
    expect(totalTokens(null)).toBe(0);
  });
});

describe("parsePr", () => {
  it("parses OPENED_PR=<n>", () => expect(parsePr("done\nOPENED_PR=42")).toBe(42));
  it("returns null for none/absent", () => {
    expect(parsePr("OPENED_PR=none")).toBeNull();
    expect(parsePr("no marker here")).toBeNull();
    expect(parsePr(undefined as unknown as string)).toBeNull();
  });
});

describe("extractRunTokens", () => {
  it("extracts tokens and pr from a run object", () => {
    expect(extractRunTokens(runJson())).toEqual({ tokens: 4700, pr: 123 });
  });
  it("parses a JSON string", () => {
    expect(extractRunTokens(JSON.stringify(runJson()))).toEqual({ tokens: 4700, pr: 123 });
  });
  it("returns 0 tokens when usage is missing", () => {
    expect(extractRunTokens(runJson({ usage: undefined }))).toEqual({ tokens: 0, pr: 123 });
  });
  it("returns null pr when the run opened none", () => {
    expect(extractRunTokens(runJson({ result: "Planned only.\nOPENED_PR=none" }))).toEqual({ tokens: 4700, pr: null });
  });
  it("is safe on malformed input", () => {
    expect(extractRunTokens("not json")).toEqual({ tokens: 0, pr: null });
    expect(extractRunTokens(null)).toEqual({ tokens: 0, pr: null });
  });
});
