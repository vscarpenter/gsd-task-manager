import { test, expect, MatrixPage } from "../harness/fixtures";
import type { Page } from "@playwright/test";

function cardIn(page: Page, quadrant: string, title: string) {
  return page.getByTestId(`quadrant-${quadrant}`).getByTestId("task-card").filter({ hasText: title });
}

test.describe("first visit", () => {
  test.use({ firstVisit: true });

  test("capture-first-visit", async ({ page, proof }) => {
    await page.goto("/");
    await page.waitForURL(/\/about\/?/);
    await proof.capture("redirected-to-about");

    await page.getByTestId("nav-matrix").click();
    const tour = page.getByRole("dialog", { name: "Get the right things done." });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Skip" }).click();
    await expect(tour).toBeHidden();

    await page.getByTestId("capture-input").fill("My first task !!");
    await page.keyboard.press("Enter");
    await expect(cardIn(page, "q1", "My first task")).toBeVisible();
    await proof.capture("first-task");
    expect(await proof.rows("first-task")).toMatchObject([{ title: "My first task" }]);
  });
});

test("capture-submit", async ({ page, matrix: _matrix, proof }) => {
  await page.getByTestId("capture-input").fill("Call the bank !!");
  await page.getByTestId("submit-task").click();

  await expect(cardIn(page, "q1", "Call the bank")).toBeVisible();
  await expect(page.getByTestId("capture-input")).toHaveValue("");
  await proof.capture("after-submit");

  await page.reload();
  await expect(cardIn(page, "q1", "Call the bank")).toBeVisible();
  const rows = await proof.rows("after-reload");
  expect(rows).toMatchObject([{ title: "Call the bank", urgent: true, important: true, quadrant: "urgent-important" }]);
});

test("capture-enter", async ({ page, matrix: _matrix, proof }) => {
  await page.getByTestId("capture-input").fill("Plan the offsite * #team");
  await page.keyboard.press("Enter");

  await expect(cardIn(page, "q2", "Plan the offsite")).toBeVisible();
  await proof.capture("after-enter");
  const rows = await proof.rows("after-enter");
  expect(rows).toMatchObject([{ title: "Plan the offsite", important: true, urgent: false, tags: ["team"] }]);
});

test("capture-parser-quadrants", async ({ page, matrix, proof }) => {
  await matrix.createTask("Goes to q3 !");
  await matrix.createTask("Goes to q4");
  await matrix.createTask("!important stays a word");

  await expect(cardIn(page, "q3", "Goes to q3")).toBeVisible();
  await expect(cardIn(page, "q4", "Goes to q4")).toBeVisible();
  await expect(cardIn(page, "q4", "!important stays a word")).toBeVisible();
  await proof.capture("three-quadrants");
});

test("capture-n-key", async ({ page, matrix: _matrix, proof }) => {
  await page.keyboard.press("n");

  const input = page.getByTestId("capture-input");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await proof.capture("input-focused");
});

test("capture-details", async ({ page, matrix: _matrix, proof }) => {
  await page.getByTestId("capture-input").fill("Book flights !! #travel");
  await page.getByTestId("more-options").click();

  const drawer = page.getByTestId("edit-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId("edit-title")).toHaveValue("Book flights");
  await proof.capture("drawer-open");
  await expect(page.getByTestId("task-card")).toHaveCount(0);

  await drawer.getByRole("button", { name: "Create task" }).click();
  await expect(cardIn(page, "q1", "Book flights")).toBeVisible();
  const rows = await proof.rows("after-create");
  expect(rows).toMatchObject([{ title: "Book flights", tags: ["travel"] }]);
});

test("capture-shift-n", async ({ page, matrix: _matrix, proof }) => {
  await page.keyboard.press("Shift+N");

  await expect(page.getByTestId("edit-drawer")).toBeVisible();
  await proof.capture("empty-drawer");
});

test("capture-alt-n-other-page", async ({ page, matrix, proof }) => {
  await matrix.openSettings();
  await page.keyboard.press("Alt+KeyN");

  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByTestId("capture-input")).toBeFocused();
  await proof.capture("back-on-matrix");
});

test("capture-quadrant-pill", async ({ page, matrix: _matrix, proof }) => {
  await page.getByTestId("capture-input").fill("Pick my quadrant");
  await page.getByTestId("quadrant-toggle").click();
  await proof.capture("pill-cycled");
  await page.getByTestId("capture-input").press("Enter");

  await expect(page.getByTestId("task-card").filter({ hasText: "Pick my quadrant" })).toBeVisible();
  const [row] = await proof.rows("after-create");
  expect(row.quadrant).not.toBe("not-urgent-not-important");
});

test("capture-palette", async ({ page, matrix: _matrix, proof }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: /Create new task/ }).click();

  await expect(page.getByTestId("edit-drawer")).toBeVisible();
  await proof.capture("drawer-from-palette");
});

test("capture-share-target", async ({ page, proof }) => {
  const matrix = new MatrixPage(page);
  await matrix.goto();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // What the OS does when the user picks GSD in the share sheet.
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/share-target/";
    form.enctype = "multipart/form-data";
    for (const [name, value] of [["title", "Shared reading"], ["text", "https://example.test/story"]]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  });

  const drawer = page.getByTestId("edit-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId("edit-title")).toHaveValue("Shared reading");
  await expect(drawer.getByTestId("edit-description")).toHaveValue("https://example.test/story");
  await proof.capture("share-draft");
});

test("capture-bookmarklet", async ({ page, context, proof }) => {
  await page.goto("/settings#bookmarklet");
  const link = page.locator("main").getByRole("link", { name: "Add to GSD" });
  await expect(link).toHaveAttribute("href", /^javascript:/);
  const href = (await link.getAttribute("href")) as string;

  // The third-party page is mocked. The DNS block keeps it off the internet.
  const articleUrl = "https://example.test/article?id=7";
  await context.route("https://example.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Long read</title><a id="bookmark" href="${href}">Bookmark</a>`,
    }),
  );
  await page.goto(articleUrl);
  const [gsdTab] = await Promise.all([context.waitForEvent("page"), page.locator("#bookmark").click()]);

  const drawer = gsdTab.getByTestId("edit-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId("edit-title")).toHaveValue("Long read");
  await expect(drawer.getByTestId("edit-description")).toHaveValue(articleUrl);
  await proof.capture("bookmarklet-draft", gsdTab);
});
