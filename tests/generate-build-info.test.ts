import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "generate-build-info.cjs");

/**
 * The script resolves package.json and .build-info.json relative to its own
 * location, so each case runs a copy inside a throwaway repo root.
 */
function runInFreshRoot(packageVersion: string, priorBuildInfo?: { version: string }): string {
  const root = mkdtempSync(join(tmpdir(), "build-info-"));
  mkdirSync(join(root, "scripts"));
  copyFileSync(SCRIPT, join(root, "scripts", "generate-build-info.cjs"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: packageVersion }));
  if (priorBuildInfo) {
    writeFileSync(join(root, ".build-info.json"), JSON.stringify(priorBuildInfo));
  }
  execFileSync("node", [join(root, "scripts", "generate-build-info.cjs")], { encoding: "utf8" });
  return JSON.parse(readFileSync(join(root, ".build-info.json"), "utf8")).version;
}

describe("generate-build-info.cjs", () => {
  // CI and the release workflows always build from a clean checkout, where
  // .build-info.json is gitignored and absent. The first build after a
  // version bump must report the package version, not one patch ahead of it.
  it("reports the package version on a clean checkout", () => {
    expect(runInFreshRoot("13.9.4")).toBe("13.9.4");
  });

  it("increments the patch on a repeat local build of the same package version", () => {
    expect(runInFreshRoot("13.9.4", { version: "13.9.4" })).toBe("13.9.5");
  });

  it("resets to the package version when the package version changed", () => {
    expect(runInFreshRoot("13.9.4", { version: "13.9.3" })).toBe("13.9.4");
  });
});
