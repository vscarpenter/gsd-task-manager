import { test, expect } from "./fixtures/test-fixtures";

test.describe("About and Install Pages", () => {
  test("about page renders the marketing hero", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("gsd-has-launched", "true");
    });
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /stop juggling\./i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open app/i })).toBeVisible();
  });

  test("install page renders platform instructions", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("gsd-has-launched", "true");
    });
    await page.goto("/install");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /install gsd task manager/i })).toBeVisible();
    await expect(page.getByText("Desktop", { exact: true })).toBeVisible();
    await expect(page.getByText("iOS", { exact: true })).toBeVisible();
    await expect(page.getByText("Android", { exact: true })).toBeVisible();
  });
});
