import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";

const THIRD_PARTY_URL = "https://example.test/article?id=7";

async function readBookmarkletHref(page: Page): Promise<string> {
  await page.goto("/settings#bookmarklet");
  const link = page.locator("main").getByRole("link", { name: "Add to GSD" });
  await expect(link).toHaveAttribute("href", /^javascript:/);
  return (await link.getAttribute("href")) as string;
}

test.describe("Bookmarklet", () => {
  // Requesting the fixture seeds the launch and onboarding flags and clears IndexedDB.
  test.beforeEach(async ({ clearIndexedDB }) => {});

  test("clicking the link in Settings explains how to install it", async ({ page }) => {
    await readBookmarkletHref(page);
    const urlBefore = page.url();

    await page.locator("main").getByRole("link", { name: "Add to GSD" }).click();

    await expect(
      page.getByText("Drag this link to your bookmarks bar, then click it on any page."),
    ).toBeVisible();
    expect(page.url()).toBe(urlBefore);
  });

  test("a bookmarklet from Settings captures a third-party page for review", async ({
    page,
    context,
    baseURL,
  }) => {
    const href = await readBookmarkletHref(page);
    await context.route("https://example.test/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><title>Long read</title><a id="bookmark" href="${href}">Bookmark</a>`,
      }),
    );
    await page.goto(THIRD_PARTY_URL);
    const gsdLoads: Array<Record<string, string>> = [];
    context.on("request", (request) => {
      if (request.isNavigationRequest() && request.url().startsWith(baseURL as string)) {
        gsdLoads.push(request.headers());
      }
    });

    const [gsdTab] = await Promise.all([
      context.waitForEvent("page"),
      page.locator("#bookmark").click(),
    ]);

    const drawer = gsdTab.locator("[data-testid='edit-drawer']");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-testid='edit-title']")).toHaveValue("Long read");
    await expect(drawer.locator("[data-testid='edit-description']")).toHaveValue(THIRD_PARTY_URL);
    await expect(drawer.getByRole("button", { name: "Create task" })).toBeVisible();
    await expect(gsdTab.getByTestId("task-card")).toHaveCount(0);
    expect(gsdLoads.length).toBeGreaterThan(0);
    // WebKit reports a suppressed referrer as an empty header, the others omit it.
    expect(gsdLoads[0].referer ?? "").toBe("");
  });
});
