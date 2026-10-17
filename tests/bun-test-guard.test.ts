import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");

// The probe file lives outside the repo so a missing guard can't make Bun discover
// this test and spawn itself again. Bun only reads bunfig.toml from its cwd, so the
// run still starts from the repo root.
function runBunTest(): { status: number | null; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "bun-test-guard-"));
  const probe = join(dir, "probe.test.ts");
  writeFileSync(probe, 'import { test } from "bun:test";\ntest("probe", () => {});\n');
  const result = spawnSync("bun", ["test", probe], { cwd: REPO_ROOT, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

describe("bun test guard", () => {
  it("exits non-zero and points at bun run test", () => {
    const { status, stderr } = runBunTest();
    expect(status).toBe(1);
    expect(stderr).toContain("bun run test");
  });

  it("stops before Bun runs any test", () => {
    expect(runBunTest().stderr).not.toContain("Ran 1 test");
  });
});
