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
    expect(fixture).toContain('message.type() !== "error"');
    // The per-test console allowlist must default to off, so a test that does
    // not opt in still fails on every error the browser reports.
    expect(fixture).toContain("expectedConsoleErrors: [null, { option: true }]");
    expect(fixture).toContain("status=2152398850");
    // Firefox now reports the stretch descriptor as width; keep both spellings.
    expect(fixture).toContain("(?:stretch|width):100");
    // Exactly the two local servers, the dev server and the static export
    // server. A broader origin would let real font failures through.
    expect(fixture).toContain("http:\\/\\/(?:localhost:3000|127\\.0\\.0\\.1:3100)\\/");
    expect(fixture).toContain("_next\\/static\\/media");
    expect(fixture).toContain("__nextjs_font");
    expect(fixture).toMatch(/runtimeErrors\.length/);
  });

  // Only production builds prefetch routes, so only the export server sees
  // WebKit report a prefetch that a test's own page.goto cancelled.
  it("should_tolerate_only_webkits_cancelled_rsc_prefetch_on_the_export_server", () => {
    const fixture = readFileSync("tests/e2e/fixtures/test-fixtures.ts", "utf8");

    expect(fixture).toContain(
      "^Fetch API cannot load http:\\/\\/127\\.0\\.0\\.1:3100\\/(?:[a-z0-9-]+\\/)*__next\\.[^/?\\s]+\\.txt\\?_rsc=[A-Za-z0-9_-]+ due to access control checks\\.$"
    );
    // Playwright splits WebKit's text at the first colon, which sits inside the
    // URL, so only the stack's first line still holds the whole message.
    expect(fixture).toContain('(error.stack ?? error.message).split("\\n")[0]');
    expect(fixture).toMatch(/onPageError[^}]*isExpectedBrowserDiagnostic\(firstLine\)/);
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
    const installer = readFileSync(".github/actions/install-playwright/action.yml", "utf8");

    expect(workflow).toMatch(/browser:\s*\[chromium, firefox, webkit\]/);
    expect(workflow).toContain("uses: ./.github/actions/install-playwright");
    expect(workflow).toContain("browser: ${{ matrix.browser }}");
    expect(installer).toContain("PLAYWRIGHT_BROWSER: ${{ inputs.browser }}");
    expect(installer).toContain('playwright install --with-deps "$PLAYWRIGHT_BROWSER"');
    expect(workflow).toContain("--project=${{ matrix.browser }}");
    expect(workflow).not.toContain("e2e-chromium:");
  });

  // Every spec runs against the production export instead; the dev config stays
  // for local iteration.
  it("should_not_run_the_dev_server_suite_in_ci", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).not.toMatch(/bun run test:e2e(?!:)/);
  });

  // The main-protection ruleset requires these checks by job name.
  it("should_keep_the_required_check_job_names", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    for (const job of ["typecheck", "lint", "test", "build"]) {
      expect(workflow, job).toMatch(new RegExp(`^  ${job}:$`, "m"));
    }
  });
});
