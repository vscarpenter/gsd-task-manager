import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DOCKER = join(__dirname, "..", "docker");
const LIB = join(DOCKER, "lib", "migrations.sh");

// The fail-closed cases need the sqlite3 CLI, which the image installs and the
// CI Ubuntu runner ships. Fail loudly instead of skipping: a skip would hide
// the one check this file exists for.
if (spawnSync("sqlite3", ["-version"]).status !== 0) {
  throw new Error("tests/docker-migrations.test.ts needs the sqlite3 CLI on PATH");
}

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gsd-migrations-"));
  workDirs.push(dir);
  return dir;
}

/** Run one shell snippet with the real function file sourced by POSIX sh. */
function sh(snippet: string) {
  return spawnSync("sh", ["-c", `. "${LIB}"; ${snippet}`], { encoding: "utf8" });
}

function makeDb(dataDir: string, sql: string): void {
  const result = spawnSync("sqlite3", [join(dataDir, "data.db"), sql], { encoding: "utf8" });
  expect(result.status).toBe(0);
}

describe("gsd_install_state", () => {
  it("reports fresh when there is no data.db", () => {
    const result = sh(`gsd_install_state "${workDir()}"`);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("fresh");
  });

  it("reports existing when the database has a tasks table", () => {
    const dir = workDir();
    makeDb(dir, "CREATE TABLE tasks (id TEXT);");

    const result = sh(`gsd_install_state "${dir}"`);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("existing");
  });

  it("reports fresh when the database has no tasks table", () => {
    const dir = workDir();
    makeDb(dir, "CREATE TABLE _params (id TEXT);");

    const result = sh(`gsd_install_state "${dir}"`);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("fresh");
  });

  it("fails closed when data.db exists but sqlite3 cannot read it", () => {
    // A read error must never look like a fresh install: the fresh set swaps
    // in a no-op backfill, so existing plaintext rows would stay plaintext.
    const dir = workDir();
    writeFileSync(join(dir, "data.db"), "this is not a sqlite database, just text ".repeat(50));

    const result = sh(`gsd_install_state "${dir}"`);

    expect(result.status).not.toBe(0);
    expect(result.stdout.trim()).not.toBe("fresh");
    expect(result.stderr).toContain("FATAL");
  });

  it("stops a set -e script at the assignment, as the entrypoint uses it", () => {
    const dir = workDir();
    writeFileSync(join(dir, "data.db"), "this is not a sqlite database, just text ".repeat(50));

    const result = sh(`set -e; INSTALL_STATE="$(gsd_install_state "${dir}")"; echo "reached $INSTALL_STATE"`);

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("reached");
  });
});

describe("gsd_build_fresh_migrations", () => {
  it("copies every shipped migration and lets the fresh set replace same-named files", () => {
    const root = workDir();
    const shipped = join(root, "pb_migrations");
    const fresh = join(root, "pb_fresh_migrations");
    const dest = join(root, "out");
    mkdirSync(shipped);
    mkdirSync(fresh);
    writeFileSync(join(shipped, "1_backfill.js"), "real backfill");
    writeFileSync(join(shipped, "2_followup.js"), "followup");
    writeFileSync(join(shipped, "3_added_later.js"), "added later");
    writeFileSync(join(fresh, "1_backfill.js"), "no-op");

    const result = sh(`gsd_build_fresh_migrations "${shipped}" "${fresh}" "${dest}"`);

    expect(result.status).toBe(0);
    expect(readdirSync(dest).sort()).toEqual(["1_backfill.js", "2_followup.js", "3_added_later.js"]);
    expect(readFileSync(join(dest, "1_backfill.js"), "utf8")).toBe("no-op");
    expect(readFileSync(join(dest, "3_added_later.js"), "utf8")).toBe("added later");
  });

  it("ships only fresh-set files that replace a shipped migration", () => {
    // A fresh-only file would run on new installs and never on upgraded ones.
    const shipped = new Set(readdirSync(join(DOCKER, "pb_migrations")));

    for (const file of readdirSync(join(DOCKER, "pb_fresh_migrations"))) {
      expect(shipped.has(file), file).toBe(true);
    }
  });
});
