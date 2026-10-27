import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

test.beforeEach(async ({ clearIndexedDB, page, serviceWorkerEnabled }) => {
  if (serviceWorkerEnabled) return;
  // Always use fresh app code; retain IndexedDB during cache resets.
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      await Promise.all((await navigator.serviceWorker.getRegistrations()).map((worker) => worker.unregister()));
    }
    await Promise.all((await caches.keys()).filter((key) => key.startsWith("gsd-")).map((key) => caches.delete(key)));
  });
});

test("save, annotate, find globally, reload and return to a selected quadrant", async ({ page }) => {
  const matrix = new MatrixPage(page);
  await matrix.goto();
  await matrix.createTask("Read the saved article https://example.com/article * #reading");
  const originalId = await page.getByTestId("task-card").getAttribute("data-task-id");
  await matrix.saveForLater("Read the saved article");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.getByTestId("saved-item")).toContainText("Read the saved article");
  await expect(page.getByTestId("saved-item").getByRole("link")).toHaveAttribute("href", "https://example.com/article");
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await expect(page.getByLabel("Notes and links")).toBeFocused();
  await page.getByLabel("Notes and links").fill("https://example.com/article\nReference for a future project.");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await expect(page.getByLabel("Notes and links")).toBeHidden();
  await expect(page.getByTestId("saved-item")).toContainText("Reference for a future project.");
  await page.reload();
  await expect(page.getByTestId("saved-item")).toContainText("Reference for a future project.");
  await page.getByRole("searchbox", { name: "Search saved items", exact: true }).fill("future project");
  await expect(page.getByTestId("saved-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Matrix", exact: true }).click();
  await expect(page.getByTestId("matrix-grid")).toBeVisible();
  await expect(page.getByTestId("task-card")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("gsd:open-command-palette")));
  await page.getByPlaceholder("Search tasks, actions, settings...").fill("future project");
  const result = page.getByRole("option").filter({ hasText: "Read the saved article" });
  await expect(result).toContainText("Saved");
  await result.click();
  await expect(page).toHaveURL(/\/saved\/?#/);
  await page.getByRole("button", { name: "Return to matrix", exact: true }).click();
  await page.getByLabel("Quadrant", { exact: true }).selectOption("urgent-important");
  await page.getByRole("button", { name: "Add to matrix", exact: true }).click();
  await expect(page.getByTestId("saved-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Matrix", exact: true }).click();
  const returned = page.getByTestId("quadrant-q1").getByTestId("task-card");
  await expect(returned).toHaveAttribute("data-task-id", originalId!);
  await expect(returned).toContainText("Reference for a future project.");
});

test("moving to Saved has a faithful Undo", async ({ page }) => {
  const matrix = new MatrixPage(page);
  await matrix.goto();
  await matrix.createTask("Keep my place !!");
  const originalId = await page.getByTestId("task-card").getAttribute("data-task-id");
  await matrix.saveForLater("Keep my place");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("quadrant-q1").getByTestId("task-card")).toHaveAttribute("data-task-id", originalId!);
});

test("Settings counts Saved-only storage in a replace-import warning", async ({ page }) => {
  const matrix = new MatrixPage(page);
  await matrix.goto();
  await matrix.createTask("Keep this reading bookmark");
  await matrix.saveForLater("Keep this reading bookmark");
  await page.goto("/settings#data");
  await expect(page.getByText("1 tasks", { exact: true })).toBeVisible();
  await expect(page.getByText("Active:", { exact: false })).toHaveText("Active: 0");
  await expect(page.getByText("Saved:", { exact: false })).toHaveText("Saved: 1");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByText("Reset everything", { exact: true }).click();
  await expect(page.getByText(/1 task \(0 active, 0 completed, 1 saved\)/i)).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const picker = page.waitForEvent("filechooser");
  await page.getByText("Import tasks", { exact: true }).click();
  await (await picker).setFiles({
    name: "replacement.json",
    mimeType: "application/json",
    // A valid backup: the import check now turns away malformed files before
    // the merge or replace choice.
    buffer: Buffer.from(JSON.stringify({ tasks: [], exportedAt: "2026-10-27T12:00:00.000Z", version: "2.1.0" })),
  });
  await expect(page.getByText(/warning\. deletes 1 task on this device/i)).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/saved");
  await expect(page.getByTestId("saved-item")).toContainText("Keep this reading bookmark");
});

test("Saved works on a narrow screen in light and dark themes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const matrix = new MatrixPage(page);
  await matrix.goto();
  await matrix.createTask("A reading bookmark #reading");
  await matrix.saveForLater("A reading bookmark");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await page.getByRole("button", { name: "Edit notes", exact: true }).click();
  await page.getByLabel("Notes and links").fill("A short annotation to keep the context.");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await expect(page.getByLabel("Notes and links")).toBeHidden();
  await expect(page.getByTestId("saved-item")).toContainText("A short annotation");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("searchbox", { name: "Search saved items", exact: true }).focus();
  await page.getByRole("searchbox", { name: "Search saved items", exact: true }).blur();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("saved-mobile-light.png"), fullPage: true });
  await page.evaluate(() => { localStorage.setItem("gsd-theme", "dark"); });
  await page.reload();
  await expect(page.getByTestId("saved-item")).toContainText("A short annotation");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("searchbox", { name: "Search saved items", exact: true }).focus();
  await page.getByRole("searchbox", { name: "Search saved items", exact: true }).blur();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("saved-mobile-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("saved-desktop-dark.png"), fullPage: true });
});


test.describe("Saved offline", () => {
  // Only this test deliberately disconnects the browser. These are its native network diagnostics.
  test.use({ serviceWorkerEnabled: true, expectedConsoleErrors: /^(?:Failed to load resource: net::ERR_INTERNET_DISCONNECTED|Failed to load resource: WebKit encountered an internal error|Failed to preconnect to (?:http:\/\/127\.0\.0\.1:3100|https:\/\/api\.vinny\.io)\/\. Error: WebKit encountered an internal error)$/ });
  test("keeps saved notes available after an offline reload", async ({ page, baseURL }) => {
    test.skip(!baseURL?.includes(":3100"), "Requires the production service worker");
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Offline reading https://example.com/read #reading");
    await matrix.saveForLater("Offline reading");
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByTestId("saved-item")).toContainText("Offline reading");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.context().setOffline(true);
    try {
      await page.reload();
      await expect(page.getByTestId("saved-item")).toContainText("Offline reading");
      await expect(page.getByTestId("saved-item").getByRole("link")).toHaveAttribute("href", "https://example.com/read");
    } finally { await page.context().setOffline(false); }
  });
});
