import { test, expect } from "./fixtures/test-fixtures";

test.describe("About Page", () => {
  test("about page renders the marketing hero", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("gsd-has-launched", "true");
    });
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /stop juggling\./i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open app/i })).toBeVisible();
  });

});
