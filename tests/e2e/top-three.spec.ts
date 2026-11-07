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

test.describe("Today strip at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits the screen with three picks and logs no errors", async ({ page, clearIndexedDB }) => {
    void clearIndexedDB;
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const matrix = new MatrixPage(page);
    await matrix.goto();
    for (const title of ["Plan the launch with the whole team", "Book the venue", "Send the invites"]) {
      await matrix.createTask(`${title} !!`);
      const card = page.getByTestId("task-card").filter({ hasText: title });
      await card.getByTestId("task-card-menu").click();
      await page.getByRole("menuitem", { name: "Add to today" }).click();
    }

    const strip = page.getByTestId("today-strip");
    await expect(page.getByRole("region", { name: "Today, 3 of 3" })).toBeVisible();
    const overflows = await strip.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflows).toBe(false);
    await expect(page.getByRole("menuitem")).toHaveCount(0);
    await strip.screenshot({ path: process.env.TODAY_STRIP_SHOT ?? "test-results/today-strip-390.png" });
    expect(errors).toEqual([]);
  });
});
