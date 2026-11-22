import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");
let root: string;

function write(path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function useScript(path: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  copyFileSync(join(REPO, path), join(root, path));
}

function checkModels(): { status: number | null; output: string } {
  const run = spawnSync("bash", [join(root, "scripts/check-models.sh")], { encoding: "utf8" });
  return { status: run.status, output: run.stdout + run.stderr };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gsd-models-"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("check-models.sh", () => {
  beforeEach(() => useScript("scripts/check-models.sh"));

  it("passes when every model's check passes and runs each config", () => {
    write("docs/formal/a/A.tla", "");
    write("docs/formal/a/A.cfg", "");
    write("docs/formal/a/check.sh", "echo 'ok A.cfg holds'\n");

    expect(checkModels().status).toBe(0);
  });

  it("fails when any model's check fails, after a passing one", () => {
    write("docs/formal/a/A.tla", "");
    write("docs/formal/a/check.sh", "echo ok\n");
    write("docs/formal/b/B.tla", "");
    write("docs/formal/b/check.sh", "echo broken; exit 1\n");

    const result = checkModels();

    expect(result.status).toBe(1);
    expect(result.output).toContain("docs/formal/b: check.sh failed");
  });

  it("fails a model that has no runner, and names the fix", () => {
    write("docs/diagrams/new-model/New.tla", "");

    const result = checkModels();

    expect(result.status).toBe(1);
    expect(result.output).toContain("docs/diagrams/new-model: add a check.sh");
  });

  it("fails a config its runner never ran, even when its name is a prefix of one that ran", () => {
    write("docs/formal/a/A.tla", "");
    write("docs/formal/a/Retry.cfg", "");
    write("docs/formal/a/RetryTwice.cfg", "");
    write("docs/formal/a/check.sh", "echo 'ok RetryTwice holds'\n");

    const result = checkModels();

    expect(result.status).toBe(1);
    expect(result.output).toContain("Retry.cfg never ran: add it to docs/formal/a/check.sh");
  });

  it("fails when it finds no model at all", () => {
    write("docs/README.md", "");

    expect(checkModels().status).toBe(1);
  });
});

describe("tlc.sh", () => {
  it("gives each concurrent checker its own download file, so neither hashes a partial jar", async () => {
    useScript("scripts/tlc.sh");
    write("M.tla", "");
    write("M.cfg", "");
    write("bin/curl", `#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do [ "$1" = -o ] && out="$2"; shift; done
echo "$out" >> "${join(root, "downloads")}"
echo jar > "$out"
sleep 0.2
`);
    chmodSync(join(root, "bin/curl"), 0o755);
    const env = { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, GSD_TLC_CACHE: join(root, "cache") };
    const run = () => new Promise<void>((done) => {
      const child = spawn("bash", [join(root, "scripts/tlc.sh"), join(root, "M.tla"), join(root, "M.cfg")], { env, stdio: "ignore" });
      child.on("close", () => done());
    });

    await Promise.all([run(), run()]);

    const targets = readFileSync(join(root, "downloads"), "utf8").trim().split("\n");
    expect(new Set(targets).size).toBe(2);
  });
});

describe("CI", () => {
  it("runs the models inside a required check", () => {
    const ci = readFileSync(join(REPO, ".github/workflows/ci.yml"), "utf8");
    const requiredTestJob = ci.slice(ci.indexOf("\n  test:\n"), ci.indexOf("\n  mcp-coverage:\n"));

    expect(requiredTestJob).toContain("bash scripts/check-models.sh");
  });
});
