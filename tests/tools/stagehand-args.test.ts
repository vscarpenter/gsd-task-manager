import { parseSmokeArgs, parseVerifyArgs } from "@/tools/stagehand/args";

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
      /matrix, dashboard, or none/
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
