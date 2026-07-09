import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "triage-run.sh");
const HELPER = join(__dirname, "..", "scripts", "failing-agent-prs.cjs");

function expectLaunchdPath(capturedPath: string, ghDir: string, homeDir: string): void {
  const parts = capturedPath.split(":");
  expect(parts.slice(0, 3)).toEqual([ghDir, "/usr/bin", "/bin"]);
  expect(parts).toContain("/opt/homebrew/bin");
  expect(parts).toContain(join(homeDir, ".local/bin"));
  expect(parts).toContain(join(homeDir, ".bun/bin"));
}

// Stub gh: `gh issue list …` -> paused count; `gh pr list …` -> PR JSON.
function stubGh(pausedCount: number, prsJson: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "ghstub-"));
  const prsFile = join(dir, "prs.json");
  writeFileSync(prsFile, JSON.stringify(prsJson));
  const bin = join(dir, "gh");
  writeFileSync(
    bin,
    `#!/usr/bin/env bash
case "$1" in
  issue) echo ${pausedCount} ;;
  pr) cat ${prsFile} ;;
  *) echo "" ;;
esac
`
  );
  chmodSync(bin, 0o755);
  return dir;
}

function pathCapturingGh(pathFile: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ghpath-"));
  const bin = join(dir, "gh");
  writeFileSync(bin, `#!/usr/bin/env bash\nprintf '%s' "$PATH" > "${pathFile}"\necho 1\n`);
  chmodSync(bin, 0o755);
  return dir;
}

function run(mode: string, pausedCount: number, prsJson: unknown): string {
  const stub = stubGh(pausedCount, prsJson);
  return execFileSync("bash", [SCRIPT, mode], {
    env: { ...process.env, PATH: `${stub}:${process.env.PATH}`, GSD_TRIAGE_HELPER: HELPER },
    encoding: "utf8",
  });
}

const failingAgentPr = { headRefName: "claude/fix-a", statusCheckRollup: [{ conclusion: "FAILURE" }] };
const passingAgentPr = { headRefName: "claude/fix-b", statusCheckRollup: [{ conclusion: "SUCCESS" }] };
const failingUserPr = { headRefName: "feat/mine", statusCheckRollup: [{ conclusion: "FAILURE" }] };

describe("triage-run.sh pre-check", () => {
  it("exits PAUSED when triage:paused is set", () => {
    expect(run("--check", 1, [failingAgentPr])).toContain("PAUSED");
  });
  it("appends launchd tool dirs without shadowing an existing gh", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "triage-home-"));
    const pathFile = join(homeDir, "captured-path.txt");
    const ghDir = pathCapturingGh(pathFile);

    const out = execFileSync("bash", [SCRIPT, "--check"], {
      env: { ...process.env, HOME: homeDir, PATH: `${ghDir}:/usr/bin:/bin`, GSD_TRIAGE_HELPER: HELPER },
      encoding: "utf8",
    });

    expect(out).toContain("PAUSED");
    expectLaunchdPath(readFileSync(pathFile, "utf8"), ghDir, homeDir);
  });
  it("exits NO_WORK when no claude/* PR is failing", () => {
    expect(run("--check", 0, [passingAgentPr, failingUserPr])).toContain("NO_WORK");
  });
  it("reports WORK when a claude/* PR is failing", () => {
    expect(run("--check", 0, [failingAgentPr, failingUserPr])).toMatch(/^WORK:/m);
  });
  it("dry-run prints the intended invocation", () => {
    const out = run("--dry-run", 0, [failingAgentPr]);
    expect(out).toMatch(/^WORK:/m);
    expect(out).toContain("/triage-prs");
  });
});
