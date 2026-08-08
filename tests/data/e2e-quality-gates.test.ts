import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function TypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return TypeScriptFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("Playwright quality gates", () => {
  it("automatically fails tests on page errors and unexpected error console messages", () => {
    const fixture = readFileSync("tests/e2e/fixtures/test-fixtures.ts", "utf8");

    expect(fixture).toContain('page.on("pageerror"');
    expect(fixture).toContain('page.on("console"');
    expect(fixture).toContain('message.type() === "error"');
    expect(fixture).toContain("status=2152398850");
    expect(fixture).toContain("http:\\/\\/localhost:3000\\/");
    expect(fixture).toContain("_next\\/static\\/media");
    expect(fixture).toContain("__nextjs_font");
    expect(fixture).toMatch(/runtimeErrors\.length/);
  });

  it("runs E2E against webpack rather than the observed Turbopack chunk race", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const playwrightConfig = readFileSync("playwright.config.ts", "utf8");

    expect(packageJson.scripts["dev:e2e"]).toBe("rimraf .next && next dev --webpack");
    expect(playwrightConfig).toContain('command: "bun run dev:e2e"');
  });

  it("contains no fixed Playwright sleeps", () => {
    const offenders = TypeScriptFiles("tests/e2e").filter((path) =>
      readFileSync(path, "utf8").includes("waitForTimeout")
    );

    expect(offenders).toEqual([]);
  });
});
