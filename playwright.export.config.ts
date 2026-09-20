import { defineConfig, devices } from "@playwright/test";
import { EXPORT_JOURNEYS } from "./tests/e2e/export-journeys";

// Runs the critical journeys against the built `out/` directory, served under
// the production CSP. Build first with `bun run build`. This is a separate
// config because the dev server and the build both delete `.next` and `out`,
// so one Playwright run cannot host both.
const EXPORT_ORIGIN = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: EXPORT_JOURNEYS.map((spec) => `**/${spec}`),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["line"], ["html", { outputFolder: "playwright-report/export", open: "never" }]],
  timeout: 30 * 1000,
  use: {
    baseURL: EXPORT_ORIGIN,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node scripts/lib/static-export-server.cjs",
    url: EXPORT_ORIGIN,
    // Port 3100, never reused: a stray `bun dev` on 3000 must not stand in for
    // the production build.
    reuseExistingServer: false,
    timeout: 15 * 1000,
  },
});
