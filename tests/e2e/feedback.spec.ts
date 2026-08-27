import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Settings → Feedback, end to end.
 *
 * The PocketBase create route is stubbed: this asserts the app's side of the
 * contract — that drafting is silent, that one press sends one request, and
 * that what goes over the wire is what the disclosure showed.
 */
test.describe("Feedback", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  async function openFeedback(page: import("@playwright/test").Page) {
    await matrixPage.openSettings();
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Feedback" }).click();
    await expect(page.locator("main h2", { hasText: "Feedback" })).toBeVisible();
  }

  test("drafting sends nothing until the button is pressed", async ({ page }) => {
    const requests: string[] = [];
    await page.route("**/api/collections/feedback/records", async (route) => {
      requests.push(route.request().postData() ?? "");
      await route.fulfill({ status: 200, body: "{}", contentType: "application/json" });
    });

    await openFeedback(page);

    await page.getByRole("button", { name: /natural-language due dates/i }).click();
    await page.getByLabel(/anything else/i).fill("the archive is hard to find");

    expect(requests).toHaveLength(0);

    await page.getByRole("button", { name: /send feedback/i }).click();

    await expect.poll(() => requests.length).toBe(1);
  });

  test("sends exactly what the disclosure showed, and nothing identifying", async ({ page }) => {
    let body = "";
    await page.route("**/api/collections/feedback/records", async (route) => {
      body = route.request().postData() ?? "";
      await route.fulfill({ status: 200, body: "{}", contentType: "application/json" });
    });

    await openFeedback(page);
    await page.getByRole("button", { name: /focus timer/i }).click();
    await page.getByLabel(/anything else/i).fill("please add a pomodoro");

    const preview = await page.getByTestId("feedback-payload-preview").textContent();
    await page.getByRole("button", { name: /send feedback/i }).click();
    await expect.poll(() => body.length).toBeGreaterThan(0);

    expect(JSON.parse(body)).toEqual(JSON.parse(preview ?? ""));
    expect(body).not.toMatch(/deviceId|device_id|owner|userId|token/i);
  });

  test("keeps the draft when the send fails", async ({ page }) => {
    await page.route("**/api/collections/feedback/records", (route) => route.abort("failed"));

    await openFeedback(page);
    await page.getByLabel(/anything else/i).fill("do not lose this");
    await page.getByRole("button", { name: /send feedback/i }).click();

    await expect(page.getByRole("status")).toContainText(/connect/i);
    await expect(page.getByLabel(/anything else/i)).toHaveValue("do not lose this");
  });

  test("clears the draft after a successful send", async ({ page }) => {
    await page.route("**/api/collections/feedback/records", (route) =>
      route.fulfill({ status: 200, body: "{}", contentType: "application/json" }),
    );

    await openFeedback(page);
    await page.getByLabel(/anything else/i).fill("thanks for building this");
    await page.getByRole("button", { name: /send feedback/i }).click();

    await expect(page.getByRole("status")).toContainText(/thank you/i);
    await expect(page.getByLabel(/anything else/i)).toHaveValue("");
  });

  test("deep-linking to /settings#feedback activates the section", async ({ page }) => {
    await page.goto("/settings#feedback");
    await waitForAppLoad(page);

    await expect(page.locator("main h2", { hasText: "Feedback" })).toBeVisible();
  });
});
