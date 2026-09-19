import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

const diagnostics = new WeakMap<Page, {
  apiRequests: string[];
  failedRequests: string[];
  badResponses: string[];
  warnings: string[];
}>();

const SYNTHETIC_USER = {
  id: "e2etokenuser0001",
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  email: "mcp-copy@example.test",
  verified: true,
};

// These deliberately unsigned credentials are accepted only by the SDK's local
// expiration check. Every PocketBase request is intercepted below.
function syntheticToken(label: string, expiresAt = Date.now() + 7_200_000): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    id: SYNTHETIC_USER.id,
    exp: Math.floor(expiresAt / 1000),
    label,
  })}.synthetic-test-signature`;
}

async function setAuth(page: Page, token: string): Promise<void> {
  await page.evaluate(({ authToken, user }) => {
    const oldValue = localStorage.getItem("pocketbase_auth");
    const newValue = JSON.stringify({ token: authToken, record: user });
    localStorage.setItem("pocketbase_auth", newValue);
    // The SDK listens for this browser event when a different tab refreshes auth.
    window.dispatchEvent(new StorageEvent("storage", {
      key: "pocketbase_auth", oldValue, newValue, storageArea: localStorage,
    }));
  }, { authToken: token, user: SYNTHETIC_USER });
}

async function seedSyncConfig(page: Page): Promise<void> {
  await page.evaluate((user) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("GsdTaskManager");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("syncMetadata", "readwrite");
      transaction.objectStore("syncMetadata").put({
        key: "sync_config", enabled: true, userId: user.id,
        // No registered device means the provider skips the unrelated SSE flow.
        deviceId: "", deviceName: "Token copy browser test", email: user.email,
        provider: "github", lastSyncAt: null, lastSuccessfulSyncAt: null,
        consecutiveFailures: 0, lastFailureAt: null, lastFailureReason: null,
        nextRetryAt: null, autoSyncEnabled: false, autoSyncIntervalMinutes: 2,
      });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), SYNTHETIC_USER);
}

async function openConnectedCloudSync(page: Page, token: string): Promise<void> {
  // Never send synthetic authorization to a real local or hosted backend.
  await page.route("**/api/**", async (route) => {
    diagnostics.get(page)?.apiRequests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 200, message: "Healthy", items: [], totalItems: 0 }),
    });
  });
  await waitForAppLoad(page);
  await seedSyncConfig(page);
  await setAuth(page, token);
  await page.goto("/settings#sync");
  await expect(page.getByRole("heading", { name: "Cloud Sync", exact: true })).toBeVisible();
}

test.describe("Cloud Sync auth token", () => {
  test.beforeEach(async ({ page, clearIndexedDB }) => {
    // The fixture removes service-worker support, clears caches and IndexedDB,
    // and suppresses onboarding in a new isolated browser context.
    const report = { apiRequests: [], failedRequests: [], badResponses: [], warnings: [] } as {
      apiRequests: string[]; failedRequests: string[]; badResponses: string[]; warnings: string[];
    };
    diagnostics.set(page, report);
    page.on("requestfailed", (request) => {
      // Navigation can cancel Next prefetches; these are not failed application requests.
      if (request.failure()?.errorText !== "net::ERR_ABORTED") report.failedRequests.push(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) report.badResponses.push(`${response.status()} ${response.url()}`);
    });
    page.on("console", (message) => {
      if (message.type() === "warning") report.warnings.push(message.text());
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    const report = diagnostics.get(page);
    await testInfo.attach("cloud-sync-browser-diagnostics", {
      body: JSON.stringify(report, null, 2), contentType: "application/json",
    });
    expect(report?.failedRequests).toEqual([]);
    expect(report?.badResponses).toEqual([]);
    expect(report?.warnings).toEqual([]);
    expect(report?.apiRequests.every((request) => request === "GET /api/health")).toBe(true);
  });

  test("copies the current token with the keyboard and picks up token rotation", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Native clipboard permissions are supported by Chromium in this harness");
    const token = syntheticToken("initial");
    const rotatedToken = syntheticToken("refreshed");
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await openConnectedCloudSync(page, token);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const copy = page.getByRole("button", { name: "Copy auth token", exact: true });
    await expect(copy).toBeVisible();
    await copy.focus();
    await expect(copy).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Auth token copied", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(token);

    await setAuth(page, rotatedToken);
    await copy.click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(rotatedToken);
    const markup = await page.content();
    expect(markup).not.toContain(token);
    expect(markup).not.toContain(rotatedToken);
    expect(consoleMessages.join("\n")).not.toContain(token);
    expect(consoleMessages.join("\n")).not.toContain(rotatedToken);
    await page.evaluate(() => navigator.clipboard.writeText(""));
  });

  test("explains clipboard denial without exposing the token or reporting success", async ({ page }) => {
    const token = syntheticToken("denied");
    await openConnectedCloudSync(page, token);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException("Clipboard denied", "NotAllowedError")) },
      });
    });
    await page.getByRole("button", { name: "Copy auth token", exact: true }).click();
    await expect(page.getByText("Couldn't copy auth token. Please try again.", { exact: true })).toBeVisible();
    await expect(page.getByText("Auth token copied", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy auth token", exact: true })).toBeEnabled();
    expect(await page.content()).not.toContain(token);
  });

  test("requires sign-in when the mounted token expires before copying", async ({ page }) => {
    const now = Date.now();
    const token = syntheticToken("expires", now + 7_200_000);
    await openConnectedCloudSync(page, token);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => { throw new Error("Expired credentials must never reach the clipboard"); } },
      });
    });
    // Advance Date without running hours of sync/health polling timers.
    await page.clock.setFixedTime(new Date(now + 10_800_000));
    await page.getByRole("button", { name: "Copy auth token", exact: true }).click();
    await expect(page.getByText("Sign in again to copy your token.", { exact: true })).toBeVisible();
    await expect(page.getByText("Auth token copied", { exact: true })).toHaveCount(0);
  });

  test("removes the token-copy control immediately after signing out", async ({ page }) => {
    await openConnectedCloudSync(page, syntheticToken("sign-out"));
    const copy = page.getByRole("button", { name: "Copy auth token", exact: true });
    await expect(copy).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByText("Signed out", { exact: true })).toBeVisible();
    await expect(copy).toHaveCount(0);
    await expect(page.getByText("MCP access", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pocketbase_auth"))).toBeNull();
  });

  test("keeps the token action readable in desktop and mobile light and dark themes", async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem("gsd-theme", "light"));
    await openConnectedCloudSync(page, syntheticToken("layout"));
    const copy = page.getByRole("button", { name: "Copy auth token", exact: true });
    for (const viewport of [{ width: 1280, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const theme of ["light", "dark"]) {
        const currentTheme = await page.locator("html").getAttribute("class");
        if (currentTheme?.split(" ").includes("dark") !== (theme === "dark")) {
          await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
        }
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
        await copy.scrollIntoViewIfNeeded();
        await expect(copy).toBeVisible();
        const size = await copy.boundingBox();
        expect(size?.width).toBeGreaterThanOrEqual(44);
        expect(size?.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const screenshot = testInfo.outputPath(`cloud-sync-${viewport.width}-${theme}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        await testInfo.attach(`cloud-sync-${viewport.width}-${theme}`, { path: screenshot, contentType: "image/png" });
      }
    }
  });
});
