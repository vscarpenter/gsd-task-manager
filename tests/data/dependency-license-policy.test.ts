import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("dependency license policy", () => {
  it("fails closed when an installed package has a denied license", () => {
    const root = temporaryDirectory("gsd-license-denied-");
    const packageDirectory = join(root, "node_modules", "denied-package");
    mkdirSync(packageDirectory, { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ name: "denied-package", version: "1.0.0", license: "AGPL-3.0-only" }),
    );

    const result = spawnSync(
      process.execPath,
      [
        "scripts/check-dependency-licenses.cjs",
        "--root",
        join(root, "node_modules"),
        "--policy",
        resolve("scripts/license-policy.json"),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("denied-package@1.0.0");
  });

  it("approves the installed graph and emits a CycloneDX SBOM", () => {
    const root = temporaryDirectory("gsd-sbom-");
    const sbomPath = join(root, "gsd-taskmanager.cdx.json");

    execFileSync(
      process.execPath,
      ["scripts/check-dependency-licenses.cjs", "--sbom", sbomPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
    expect(sbom.bomFormat).toBe("CycloneDX");
    expect(sbom.specVersion).toBe("1.5");
    expect(sbom.components.length).toBeGreaterThan(100);
  });

  it("runs the policy and uploads its SBOM in blocking CI", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(packageJson.scripts["license:check"]).toBeDefined();
    expect(workflow).toContain("bun run license:check");
    expect(workflow).toContain("gsd-taskmanager.cdx.json");
  });
});
