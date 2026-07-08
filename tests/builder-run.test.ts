import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "builder-run.sh");

// Build a fake `gh` on PATH that returns a canned open-issue count per label.
function stubGh(counts: Record<string, number>): string {
  const dir = mkdtempSync(join(tmpdir(), "ghstub-"));
  const bin = join(dir, "gh");
  const cases = Object.entries(counts)
    .map(([l, n]) => `  "${l}") echo ${n};;`)
    .join("\n");
  const script = `#!/usr/bin/env bash
label=""
while [ "$#" -gt 0 ]; do case "$1" in --label) shift; label="$1";; esac; shift; done
case "$label" in
${cases}
  *) echo 0;;
esac
`;
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return dir;
}

function run(mode: string, counts: Record<string, number>): string {
  const stub = stubGh(counts);
  return execFileSync("bash", [SCRIPT, mode], {
    env: { ...process.env, PATH: `${stub}:${process.env.PATH}` },
    encoding: "utf8",
  });
}

describe("builder-run.sh pre-check", () => {
  it("exits PAUSED when builder:paused is set (before any work check)", () => {
    expect(run("--check", { "builder:paused": 1, "ready-for-agent": 5 })).toContain("PAUSED");
  });

  it("exits NO_WORK when nothing is actionable", () => {
    expect(
      run("--check", { "builder:paused": 0, "ready-for-agent": 0, "plan:approved": 0 })
    ).toContain("NO_WORK");
  });

  it("reports WORK when ready-for-agent issues exist", () => {
    expect(
      run("--check", { "builder:paused": 0, "ready-for-agent": 2, "plan:approved": 0 })
    ).toContain("WORK");
  });

  it("reports WORK when plan:approved issues exist", () => {
    expect(
      run("--check", { "builder:paused": 0, "ready-for-agent": 0, "plan:approved": 1 })
    ).toContain("WORK");
  });

  it("dry-run prints the intended invocation without running claude", () => {
    const out = run("--dry-run", { "builder:paused": 0, "ready-for-agent": 1, "plan:approved": 0 });
    expect(out).toContain("WORK");
    expect(out).toContain("/build-next");
  });
});
