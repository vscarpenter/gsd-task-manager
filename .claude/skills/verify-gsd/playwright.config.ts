import { defineConfig, devices } from "@playwright/test";

// Run this through scripts/gsd-verify, which sets these three values for the
// instance it started. Without them Playwright would have nothing safe to drive.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run journeys with scripts/gsd-verify drive.`);
  return value;
}

const evidenceDir = requireEnv("GSD_VERIFY_EVIDENCE");

// The production bundle talks to the live PocketBase at api.vinny.io. Failing DNS
// in the browser process stops every page and service worker request, including
// the ones Playwright's routing cannot see. A journey that needs a backend mocks
// it with context.route, which answers before DNS runs.
const BLOCK_THE_INTERNET = "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost";

export default defineConfig({
  testDir: requireEnv("GSD_VERIFY_TESTDIR"),
  // Not *.spec.ts: Vitest collects that suffix anywhere in the repo.
  testMatch: "**/*.journey.ts",
  outputDir: `${evidenceDir}/playwright`,
  workers: 1,
  retries: 0,
  timeout: 60 * 1000,
  reporter: [["line"], ["json", { outputFile: `${evidenceDir}/report.json` }]],
  use: {
    baseURL: requireEnv("GSD_VERIFY_BASE_URL"),
    trace: "on",
    screenshot: "only-on-failure",
    launchOptions: { args: [BLOCK_THE_INTERNET] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
