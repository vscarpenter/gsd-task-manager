import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  compareBundleBudget,
  measureFirstLoad,
  toBaseline,
} from "../../scripts/check-bundle-budget.cjs";

const SHARED_CHUNK = "export const shared = 'every route loads this chunk';".repeat(40);
const MATRIX_CHUNK = "export const matrix = 'only the matrix loads this chunk';".repeat(25);
const gzipBytes = (source: string) => gzipSync(source, { level: 9 }).length;

function page(scripts: string[]): string {
  const tags = scripts.map((src) => `<script src="${src}" async=""></script>`).join("");
  return `<html><head>${tags}<script src="https://cdn.example/x.js"></script></head></html>`;
}

describe("first-load bundle budget", () => {
  let outDir: string;

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), "gsd-budget-"));
    for (const dir of ["about", "404", "_not-found", "_next/static/chunks"]) {
      mkdirSync(join(outDir, dir), { recursive: true });
    }
    writeFileSync(join(outDir, "_next/static/chunks/shared.js"), SHARED_CHUNK);
    writeFileSync(join(outDir, "_next/static/chunks/matrix.js"), MATRIX_CHUNK);
    const shared = "/_next/static/chunks/shared.js";
    writeFileSync(join(outDir, "index.html"), page([shared, "/_next/static/chunks/matrix.js"]));
    writeFileSync(join(outDir, "about/index.html"), page([shared, shared]));
    writeFileSync(join(outDir, "404/index.html"), page([shared]));
    writeFileSync(join(outDir, "_not-found/index.html"), page([shared]));
  });

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it("should_sum_gzip_bytes_of_each_routes_scripts_and_skip_error_pages", () => {
    expect(measureFirstLoad(outDir)).toEqual({
      "/": gzipBytes(SHARED_CHUNK) + gzipBytes(MATRIX_CHUNK),
      "/about": gzipBytes(SHARED_CHUNK),
    });
  });

  it("should_fail_a_route_over_its_budget_and_pass_one_at_the_limit", () => {
    const budget = { allowanceBytes: 100, routes: { "/": 1000, "/about": 1000 } };

    expect(compareBundleBudget(budget, { "/": 1100, "/about": 1000 })).toEqual([]);
    expect(compareBundleBudget(budget, { "/": 1101, "/about": 1000 })).toEqual([
      "/ loads 1101 bytes of first-load JavaScript, over its budget of 1000 plus 100",
    ]);
  });

  it("should_fail_a_route_that_has_no_budget_entry", () => {
    const budget = { allowanceBytes: 100, routes: { "/": 1000 } };

    expect(compareBundleBudget(budget, { "/": 900, "/new-route": 10 })).toEqual([
      "/new-route has no entry in scripts/bundle-budget.json",
    ]);
  });

  it("should_pass_against_its_own_written_baseline", () => {
    const current = measureFirstLoad(outDir);
    const committed = JSON.parse(readFileSync("scripts/bundle-budget.json", "utf8"));
    const baseline = toBaseline(current, committed.allowanceBytes);

    expect(baseline.allowanceBytes).toBe(committed.allowanceBytes);
    expect(compareBundleBudget(baseline, current)).toEqual([]);
  });

  it("should_name_the_build_command_when_the_export_is_missing", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "gsd-budget-empty-"));

    try {
      expect(() => measureFirstLoad(emptyDir)).toThrow(/bun run build/);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("should_run_the_bundle_budget_after_the_static_export_build_in_ci", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const buildJob = workflow.slice(workflow.indexOf("\n  build:"));
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(buildJob.indexOf("run: bun run quality:bundle")).toBeGreaterThan(
      buildJob.indexOf("uses: ./.github/actions/build-static-export")
    );
    expect(packageJson.scripts["quality:bundle"]).toBe("node scripts/check-bundle-budget.cjs");
  });
});
