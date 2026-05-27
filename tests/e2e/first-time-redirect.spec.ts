import { test, expect } from "./fixtures/test-fixtures";

test.describe("First-time Redirect", () => {
  test("redirects first-time visitors to /about and remembers the launch flag", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/about\/?(?:[?#].*)?$/);
    await expect(page.getByRole("link", { name: /open app/i })).toBeVisible();
    await expect(page.locator("main h1", { hasText: /stop juggling/i })).toBeVisible();

    expect(await page.evaluate(() => localStorage.getItem("gsd-has-launched"))).toBe("true");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/about(?:[?#].*)?$/);
    await expect(page.locator("[data-testid='matrix-grid']")).toBeVisible();
  });
});
