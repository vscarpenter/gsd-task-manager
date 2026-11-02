import { test, expect } from "../harness/fixtures";

test.beforeEach(async ({ matrix }) => {
  await matrix.createTask("Buy groceries #errands");
  await matrix.createTask("Finish the report *");
});

test("search-title", async ({ page, matrix, proof }) => {
  await matrix.search("groceries");

  const cards = page.getByTestId("task-card");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("Buy groceries");
  await proof.capture("one-match");
});

test("search-tag", async ({ page, matrix, proof }) => {
  await matrix.search("errands");

  await expect(page.getByTestId("task-card")).toHaveCount(1);
  await expect(page.getByTestId("task-card")).toContainText("Buy groceries");
  await proof.capture("tag-match");
});

test("search-no-match", async ({ page, matrix, proof }) => {
  await matrix.search("volcano");

  await expect(page.getByTestId("task-card")).toHaveCount(0);
  await proof.capture("no-match");
  expect(await proof.rows("data-untouched")).toHaveLength(2);
});

test("search-clear", async ({ page, matrix }) => {
  await matrix.search("groceries");
  await expect(page.getByTestId("task-card")).toHaveCount(1);

  await matrix.clearSearch();

  await expect(page.getByTestId("task-card")).toHaveCount(2);
});

test("search-slash-key", async ({ page, matrix: _matrix, proof }) => {
  await page.getByRole("heading", { level: 1 }).first().click();
  await page.keyboard.press("/");

  const search = page.getByTestId("search-input");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await proof.capture("search-focused");
});

test("search-palette", async ({ page, matrix: _matrix, proof }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search tasks, actions, settings...").fill("groceries");

  const result = page.getByRole("option").filter({ hasText: "Buy groceries" });
  await expect(result).toBeVisible();
  await proof.capture("palette-result");
  await result.click();
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByTestId("task-card").filter({ hasText: "Buy groceries" })).toBeFocused();
  await proof.capture("card-focused");
});

test("search-palette-button", async ({ page, matrix: _matrix }) => {
  await page.getByRole("button", { name: "Open command palette" }).click();

  await expect(page.getByPlaceholder("Search tasks, actions, settings...")).toBeFocused();
});

test("search-from-other-page", async ({ page, matrix, proof }) => {
  await matrix.openSettings();
  await page.keyboard.press("Alt+Slash");

  const paletteSearch = page.getByPlaceholder("Search tasks, actions, settings...");
  await expect(paletteSearch).toBeFocused();
  await paletteSearch.fill("groceries");
  await page.getByRole("option").filter({ hasText: "Buy groceries" }).click();

  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByTestId("task-card").filter({ hasText: "Buy groceries" })).toBeVisible();
  await proof.capture("arrived-on-matrix");
});
