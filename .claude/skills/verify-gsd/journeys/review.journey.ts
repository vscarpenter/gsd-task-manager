import { test, expect } from "../harness/fixtures";

test("review-empty", async ({ page, matrix, proof }) => {
  await matrix.openDashboard();

  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing to review yet" })).toBeVisible();
  await proof.capture("empty");

  await page.getByRole("button", { name: "Open matrix" }).click();
  await expect(page.getByTestId("matrix-grid")).toBeVisible();
});

test("review-seeded", async ({ page, matrix, seed, proof }) => {
  await seed("dashboard");
  await matrix.openDashboard();

  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing to review yet" })).toHaveCount(0);
  // The seed completes one task on each of the last four local days.
  await expect(page.locator("main")).toContainText(/Completed today\s*1/);
  await expect(page.locator("main")).toContainText(/Streak\s*4\s*days/);
  await expect(page.locator("main")).toContainText(/Overdue \(1\)/);
  await proof.capture("seeded");
  expect((await proof.rows("seed-rows")).filter((row) => row.completed)).toHaveLength(4);
});

test("review-completion-counts", async ({ page, matrix, proof }) => {
  await matrix.createTask("Ship the build !!");
  await matrix.completeTask("Ship the build");
  await matrix.openDashboard();

  await expect(page.getByRole("heading", { name: "Nothing to review yet" })).toHaveCount(0);
  await proof.capture("one-completed");
  const [row] = await proof.rows("completed-row");
  expect(row.completedAt).toBeTruthy();
});

test("review-alt-r", async ({ page, matrix: _matrix }) => {
  await page.keyboard.press("Alt+KeyR");

  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
});

test("review-palette", async ({ page, matrix: _matrix }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: /View review/ }).click();

  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
});
