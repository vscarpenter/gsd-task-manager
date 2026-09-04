import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "triage-run.sh");
const HELPER = join(__dirname, "..", "scripts", "failing-agent-prs.cjs");
const SHA = "a".repeat(40);

function stubTools(pausedCount: number, prsJson: unknown): { dir: string; marker: string } {
  const dir = mkdtempSync(join(tmpdir(), "triage-tools-"));
  const prsFile = join(dir, "prs.json");
  const marker = join(dir, "executed.txt");
  writeFileSync(prsFile, JSON.stringify(prsJson));
  writeFileSync(
    join(dir, "gh"),
    '#!/bin/bash\ncase "$1" in\n  issue) echo ' +
      pausedCount +
      ' ;;\n  pr) cat "' +
      prsFile +
      '" ;;\nesac\n'
  );
  chmodSync(join(dir, "gh"), 0o755);
  for (const tool of ["git", "claude", "bun"]) {
    writeFileSync(join(dir, tool), '#!/bin/bash\necho ' + tool + ' >> "' + marker + '"\nexit 97\n');
    chmodSync(join(dir, tool), 0o755);
  }
  return { dir, marker };
}

function run(mode: string, pausedCount: number, prsJson: unknown): { output: string; marker: string } {
  const { dir, marker } = stubTools(pausedCount, prsJson);
  const output = execFileSync("bash", [SCRIPT, mode], {
    env: {
      ...process.env,
      PATH: dir + ":/usr/bin:/bin",
      GSD_TRIAGE_HELPER: HELPER,
      GSD_TRIAGE_BOT_LOGIN: "claude[bot]",
    },
    encoding: "utf8",
  });
  return { output, marker };
}

const botFailure = {
  author: { login: "claude[bot]" },
  headRefName: "claude/fix-a",
  headRefOid: SHA,
  isCrossRepository: false,
  statusCheckRollup: [{ conclusion: "FAILURE" }],
};

describe("triage-run.sh discovery-only boundary", () => {
  it("is disabled by default without a configured bot identity", () => {
    const output = execFileSync("bash", [SCRIPT, "--check"], {
      env: { ...process.env, GSD_TRIAGE_BOT_LOGIN: "" },
      encoding: "utf8",
    });
    expect(output).toContain("DISABLED");
  });

  it("honors the pause switch", () => {
    expect(run("--check", 1, [botFailure]).output).toContain("PAUSED");
  });

  it("reports only exact bot and SHA candidates", () => {
    const output = run("--check", 0, [botFailure]).output;
    expect(output).toContain("DISCOVERY:");
    expect(output).toContain("local branch remediation is retired");
  });

  it.each(["--check", "--dry-run", ""])(
    "never executes branch tools in mode %s",
    (mode) => {
      const { output, marker } = run(mode, 0, [botFailure]);
      expect(output).toContain("DISABLED:");
      expect(existsSync(marker)).toBe(false);
    }
  );

  it("contains no local branch execution sink", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).not.toMatch(/claude\s+-p|git\s+-C|bun\s+/);
    expect(source).not.toContain("/triage-prs");
  });
});
