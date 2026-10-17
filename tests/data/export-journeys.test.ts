import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Importing the config would load @playwright/test, which never resolves under
// Vitest, so these guards read the file the way the other workflow guards do.
const EXPORT_CONFIG = readFileSync("playwright.export.config.ts", "utf8");

describe("production export journeys", () => {
  // CI runs Playwright only against the built export, so a narrowed match
  // would silently drop specs from every browser leg.
  it("should_run_every_e2e_spec_against_the_production_export", () => {
    expect(EXPORT_CONFIG).toContain('testDir: "./tests/e2e"');
    expect(EXPORT_CONFIG).not.toMatch(/\btest(?:Match|Ignore)\s*:/);
    expect(existsSync("tests/e2e/export-journeys.ts")).toBe(false);
  });

  // A static server has no on-demand compile to contend for, and GitHub's
  // public runners have four cores.
  it("should_use_two_workers_for_the_export_suite_on_ci", () => {
    expect(EXPORT_CONFIG).toContain("workers: process.env.CI ? 2 : undefined");
  });

  it("should_run_the_export_journeys_after_the_production_build_in_ci", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const build = workflow.indexOf("run: bun run build");
    const journeys = workflow.indexOf(
      "run: bun run test:e2e:export -- --project=${{ matrix.browser }}"
    );
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(build).toBeGreaterThan(-1);
    expect(journeys).toBeGreaterThan(build);
    expect(packageJson.scripts["test:e2e:export"]).toBe(
      "playwright test --config playwright.export.config.ts"
    );
  });
});
