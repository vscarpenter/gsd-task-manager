import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { E2E_WARM_ROUTES, warmE2ERoutes } from "../../tests/e2e/global-setup";

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

  it("warms every application route before parallel browser workers start", async () => {
    const request = vi.fn(async () => new Response(null, { status: 200 }));

    await warmE2ERoutes(request);

    expect(request.mock.calls.map(([url]) => url)).toEqual(
      E2E_WARM_ROUTES.map((route) => `http://localhost:3000${route}`),
    );
    expect(readFileSync("playwright.config.ts", "utf8")).toContain(
      'globalSetup: "./tests/e2e/global-setup.ts"',
    );
  });

  it("fails setup when a route cannot be compiled", async () => {
    const request = vi.fn(async () => new Response(null, { status: 503 }));

    await expect(warmE2ERoutes(request)).rejects.toThrow(/failed to warm/i);
  });

  it("contains no fixed Playwright sleeps", () => {
    const offenders = TypeScriptFiles("tests/e2e").filter((path) =>
      readFileSync(path, "utf8").includes("waitForTimeout")
    );

    expect(offenders).toEqual([]);
  });

  it("runs every supported browser as a blocking CI matrix", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).toMatch(/browser:\s*\[chromium, firefox, webkit\]/);
    expect(workflow).toContain("playwright install --with-deps ${{ matrix.browser }}");
    expect(workflow).toContain("--project=${{ matrix.browser }}");
    expect(workflow).not.toContain("e2e-chromium:");
  });
});
