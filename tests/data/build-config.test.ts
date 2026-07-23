import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromRepo = createRequire(resolve(process.cwd(), "package.json"));

interface PackageJson {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface TypeScriptModule {
  createProgram?: unknown;
  version?: string;
}

function firstNumericMajor(versionRange: string): number | null {
  const match = versionRange.match(/\d+/);
  return match ? Number(match[0]) : null;
}

describe("build configuration", () => {
  it("runs TypeScript 7 alongside the TypeScript 6 compiler API", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;
    const nativeVersion = packageJson.devDependencies?.["@typescript/native"];
    const compatibilityVersion = packageJson.devDependencies?.typescript;

    expect(nativeVersion).toBeDefined();
    expect(compatibilityVersion).toBeDefined();
    expect(firstNumericMajor(nativeVersion!)).toBe(7);
    expect(firstNumericMajor(compatibilityVersion!)).toBe(6);
    expect(packageJson.scripts?.typecheck).toContain("@typescript/native");

    const typescript = requireFromRepo("typescript") as TypeScriptModule;
    const cliVersion = execFileSync(
      resolve(process.cwd(), "node_modules/@typescript/native/bin/tsc"),
      ["--version"],
      { encoding: "utf8" },
    ).trim();

    expect(firstNumericMajor(typescript.version ?? "")).toBeLessThan(7);
    expect(typeof typescript.createProgram).toBe("function");
    expect(cliVersion).toMatch(/^Version 7\./);
  });

  it("pins Turbopack root to the project config directory", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toMatch(/turbopack:\s*\{\s*root:\s*__dirname\s*\}/);
  });
});
