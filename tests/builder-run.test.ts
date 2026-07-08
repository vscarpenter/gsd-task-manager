import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
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

// A fake `gh` that always fails (simulates expired auth / network outage).
function failingGh(): string {
  const dir = mkdtempSync(join(tmpdir(), "ghfail-"));
  const bin = join(dir, "gh");
  writeFileSync(bin, `#!/usr/bin/env bash\necho "gh: simulated failure" >&2\nexit 1\n`);
  chmodSync(bin, 0o755);
  return dir;
}

function run(mode: string, counts: Record<string, number>): string {
  return runWith(mode, stubGh(counts));
}

function runWith(mode: string, ghDir: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync("bash", [SCRIPT, mode], {
    env: { ...process.env, PATH: `${ghDir}:${process.env.PATH}`, ...extraEnv },
    encoding: "utf8",
  });
}

describe("builder-run.sh pre-check", () => {
  it("exits PAUSED when builder:paused is set (before any work check)", () => {
    expect(run("--check", { "builder:paused": 1, "ready-for-agent": 5 })).toContain("PAUSED");
  });

  it("exits NO_WORK when nothing is actionable", () => {
    expect(
      run("--check", {
        "builder:paused": 0,
        "ready-for-agent": 0,
        "plan:approved": 0,
        "plan:revise": 0,
      })
    ).toContain("NO_WORK");
  });

  // Anchor to a line start: "NO_WORK:" also *contains* "WORK:", so a bare
  // toContain("WORK") would pass on the idle path too.
  it("reports WORK when ready-for-agent issues exist", () => {
    expect(
      run("--check", { "builder:paused": 0, "ready-for-agent": 2, "plan:approved": 0, "plan:revise": 0 })
    ).toMatch(/^WORK:/m);
  });

  it("reports WORK when plan:approved issues exist", () => {
    expect(
      run("--check", { "builder:paused": 0, "ready-for-agent": 0, "plan:approved": 1, "plan:revise": 0 })
    ).toMatch(/^WORK:/m);
  });

  it("reports WORK when plan:revise issues exist (so /revise gets processed)", () => {
    expect(
      run("--check", { "builder:paused": 0, "ready-for-agent": 0, "plan:approved": 0, "plan:revise": 1 })
    ).toMatch(/^WORK:/m);
  });

  it("dry-run prints the intended invocation without running claude", () => {
    const out = run("--dry-run", {
      "builder:paused": 0,
      "ready-for-agent": 1,
      "plan:approved": 0,
      "plan:revise": 0,
    });
    expect(out).toMatch(/^WORK:/m);
    expect(out).toContain("/build-next");
  });

  it("stays NO_WORK and logs a record when gh fails persistently", () => {
    const logDir = mkdtempSync(join(tmpdir(), "ghlog-"));
    const out = runWith("--check", failingGh(), { GSD_BUILDER_LOG_DIR: logDir });
    // Fail-safe: a gh outage must not be mistaken for actionable work.
    expect(out).toContain("NO_WORK");
    // But it must be discoverable, not silent.
    const log = readFileSync(join(logDir, "gh-errors.log"), "utf8");
    expect(log.length).toBeGreaterThan(0);
  });
});
