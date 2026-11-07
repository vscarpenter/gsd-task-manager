import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

test.describe("Today strip", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture seeds the launch flag and clears IndexedDB, so the first load lands on the matrix.
  });

  test("a pick shows first, survives a reload, and can move and be removed", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Plan the launch !!");
    await matrix.createTask("Book the venue !!");
    const strip = page.getByTestId("today-strip");
    await expect(strip.getByRole("button", { name: "Pick up to three for today" })).toBeVisible();

    for (const title of ["Plan the launch", "Book the venue"]) {
      const card = page.getByTestId("task-card").filter({ hasText: title });
      await card.hover();
      await card.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: "Add to today" }).click();
    }
    await expect(page.getByRole("region", { name: "Today, 2 of 3" })).toBeVisible();

    await page.reload();
    const rows = page.getByTestId("today-strip").getByRole("listitem");
    await expect(rows.first()).toContainText("Plan the launch");
    await expect(rows.first()).toContainText("first");

    await page.getByRole("button", { name: "Move Plan the launch down" }).click();
    await expect(rows.first()).toContainText("Book the venue");

    await page.getByRole("button", { name: "Remove Book the venue from today" }).click();
    await expect(page.getByRole("region", { name: "Today, 1 of 3" })).toBeVisible();
  });

  test("past midnight, yesterday's pick is offered and no longer counted", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-08T10:00:00") });
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Plan the launch !!");
    const card = page.getByTestId("task-card").filter({ hasText: "Plan the launch" });
    await card.hover();
    await card.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Add to today" }).click();
    await expect(page.getByRole("region", { name: "Today, 1 of 3" })).toBeVisible();

    await page.clock.fastForward("15:00:00");

    await expect(page.getByRole("region", { name: "Today, 0 of 3" })).toBeVisible();
    await expect(page.getByText("From yesterday")).toBeVisible();
    await expect(page.getByTestId("today-strip").getByRole("button", { name: "Add to today: Plan the launch" })).toBeVisible();
  });
});
