import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

// The manifest's share_target posts to /share-target/. The service worker answers
// it, so this needs the production build (the export server on :3100).
test.describe("Share target", () => {
  test.use({ serviceWorkerEnabled: true });
  // Requesting the fixture seeds the launch and onboarding flags and clears IndexedDB.
  test.beforeEach(async ({ clearIndexedDB }) => {});

  test("a share into the installed app opens a capture draft", async ({ page, baseURL }) => {
    test.skip(!baseURL?.includes(":3100"), "Requires the production service worker");
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    // What the OS does when the user picks GSD in the share sheet.
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/share-target/";
      form.enctype = "multipart/form-data";
      for (const [name, value] of [["title", "Shared reading"], ["text", "https://example.com/story"]]) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    });

    const drawer = page.locator("[data-testid='edit-drawer']");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-testid='edit-title']")).toHaveValue("Shared reading");
    await expect(drawer.locator("[data-testid='edit-description']")).toHaveValue("https://example.com/story");
  });
});
