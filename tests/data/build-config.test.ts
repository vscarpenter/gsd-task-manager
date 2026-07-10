import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromRepo = createRequire(resolve(process.cwd(), "package.json"));

interface PackageJson {
  devDependencies?: Record<string, string>;
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
  it("keeps TypeScript on a package that exposes the JS compiler API", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;
    const typescript = requireFromRepo("typescript") as TypeScriptModule;
    const declaredVersion = packageJson.devDependencies?.typescript;

    expect(declaredVersion).toBeDefined();
    expect(firstNumericMajor(declaredVersion!)).toBeLessThan(7);
    expect(firstNumericMajor(typescript.version ?? "")).toBeLessThan(7);
    expect(typeof typescript.createProgram).toBe("function");
  });

  it("pins Turbopack root to the project config directory", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toMatch(/turbopack:\s*\{\s*root:\s*__dirname\s*\}/);
  });
});
