import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "builder-run.sh");

function toolStubs(): { dir: string; marker: string } {
  const dir = mkdtempSync(join(tmpdir(), "builder-tools-"));
  const marker = join(dir, "executed.txt");
  for (const tool of ["gh", "git", "claude", "bun", "node"]) {
    const path = join(dir, tool);
    writeFileSync(path, '#!/bin/bash\necho ' + tool + ' >> "' + marker + '"\nexit 97\n');
    chmodSync(path, 0o755);
  }
  return { dir, marker };
}

describe("builder-run.sh retired execution boundary", () => {
  it.each(["--check", "--dry-run", ""])("is a no-op in mode %s", (mode) => {
    const { dir, marker } = toolStubs();
    const args = mode ? [SCRIPT, mode] : [SCRIPT];
    const output = execFileSync("bash", args, {
      env: { ...process.env, PATH: dir + ":/usr/bin:/bin" },
      encoding: "utf8",
    });

    expect(output).toContain("DISABLED: unattended builder execution is retired");
    expect(output).toContain("immutable issue bytes");
    expect(() => readFileSync(marker, "utf8")).toThrow();
  });

  it("rejects unknown arguments", () => {
    const result = spawnSync("bash", [SCRIPT, "--unsafe"], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown arg");
  });

  it("contains no issue selection or local agent execution sink", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).not.toMatch(/gh issue|claude\s+-p|git\s+-C|bun\s+/);
  });
});
