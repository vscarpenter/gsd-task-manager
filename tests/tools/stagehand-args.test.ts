import { parseSmokeArgs, parseVerifyArgs, resolveStagehandModel } from "@/tools/stagehand/args";

describe("parseVerifyArgs", () => {
  it("applies defaults with only --goal", () => {
    expect(parseVerifyArgs(["--goal", "badge shows"])).toEqual({
      goal: "badge shows",
      seed: "none",
      path: "/",
      acts: [],
      url: "http://localhost:3000",
      headless: true,
    });
  });

  it("preserves repeated --act order", () => {
    const args = parseVerifyArgs(["--goal", "g", "--act", "first", "--act", "second"]);
    expect(args.acts).toEqual(["first", "second"]);
  });

  it("parses seed, path, url, headed", () => {
    const args = parseVerifyArgs([
      "--goal",
      "g",
      "--seed",
      "dashboard",
      "--path",
      "/dashboard",
      "--url",
      "http://x",
      "--headed",
    ]);
    expect(args).toMatchObject({
      seed: "dashboard",
      path: "/dashboard",
      url: "http://x",
      headless: false,
    });
  });

  it("throws on missing --goal", () => {
    expect(() => parseVerifyArgs([])).toThrow(/--goal/);
  });

  it("throws on invalid seed", () => {
    expect(() => parseVerifyArgs(["--goal", "g", "--seed", "bogus"])).toThrow(
      /matrix, dashboard, storage, trash, or none/
    );
  });

  it("throws on unknown flag", () => {
    expect(() => parseVerifyArgs(["--goal", "g", "--wat"])).toThrow(/Unknown flag/);
  });

  it("throws when a flag is missing its value", () => {
    expect(() => parseVerifyArgs(["--goal"])).toThrow(/requires a value/);
  });
});

describe("parseSmokeArgs", () => {
  const names = ["first-visit-redirect", "search"];

  it("defaults to the production url", () => {
    expect(parseSmokeArgs([], names)).toEqual({ url: "https://gsd.vinny.dev", headless: true });
  });

  it("accepts a known journey and url override", () => {
    expect(parseSmokeArgs(["--journey", "search", "--url", "http://l"], names)).toEqual({
      url: "http://l",
      journey: "search",
      headless: true,
    });
  });

  it("rejects unknown journey, listing valid names", () => {
    expect(() => parseSmokeArgs(["--journey", "nope"], names)).toThrow(
      /first-visit-redirect, search/
    );
  });
});

describe("resolveStagehandModel", () => {
  it("defaults to Haiku 4.5 when STAGEHAND_MODEL is unset", () => {
    expect(resolveStagehandModel({})).toBe("anthropic/claude-haiku-4-5");
  });

  it("uses STAGEHAND_MODEL when set", () => {
    expect(resolveStagehandModel({ STAGEHAND_MODEL: "anthropic/claude-sonnet-5-5" })).toBe(
      "anthropic/claude-sonnet-5-5"
    );
  });

  it("treats a blank STAGEHAND_MODEL as unset", () => {
    expect(resolveStagehandModel({ STAGEHAND_MODEL: "  " })).toBe("anthropic/claude-haiku-4-5");
  });

  it("rejects a non-Anthropic model, since only ANTHROPIC_API_KEY is wired", () => {
    expect(() => resolveStagehandModel({ STAGEHAND_MODEL: "openai/gpt-5" })).toThrow(
      /anthropic\//
    );
  });
});
