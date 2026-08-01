import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Refined Evolution production hybrid", () => {
  test.beforeEach(async ({ page, clearIndexedDB }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await waitForAppLoad(page);
  });

  test("supports the physical Option shortcut model", async ({ page }) => {
    await page.keyboard.press("Alt+n");
    await expect(page.getByTestId("capture-input")).toBeFocused();
    await page.getByTestId("capture-input").blur();

    for (const [key, quadrant] of [
      ["1", "q1"],
      ["2", "q2"],
      ["3", "q3"],
      ["4", "q4"],
    ] as const) {
      await page.keyboard.press(`Alt+${key}`);
      await expect(page.getByTestId(`quadrant-${quadrant}`)).toBeFocused();
    }

    await page.keyboard.press("Alt+/");
    await expect(page.getByPlaceholder("Search tasks, actions, settings...")).toBeVisible();
    await page.keyboard.press("Alt+r");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByPlaceholder("Search tasks, actions, settings...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("quadrant-q4")).toBeFocused();

    const installPrompt = page.locator(
      "[role='dialog'][aria-labelledby='install-pwa-title']"
    );
    await installPrompt.waitFor({ state: "visible", timeout: 750 }).catch(() => undefined);
    if (await installPrompt.isVisible().catch(() => false)) {
      await installPrompt.getByRole("button", { name: "Dismiss install prompt" }).click();
    }

    const commandButton = page.getByRole("button", { name: /open command palette/i });
    await commandButton.click();
    await page.getByText("Toggle theme", { exact: true }).click();
    await expect(commandButton).toBeFocused();

    await commandButton.click();
    await page.getByText("Open user guide", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: /how to use gsd/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.keyboard.press("Alt+r");
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  });

  test("delivers cross-route capture and quadrant focus then cleans the URL", async ({ page }) => {
    await page.getByRole("button", { name: "Review" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    await page.keyboard.press("Alt+2");
    await expect(page.getByTestId("quadrant-q2")).toBeFocused();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Review" }).first().click();
    await page.keyboard.press("Alt+n");
    await expect(page.getByTestId("capture-input")).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test("keeps mobile capture, navigation, and read-only details distinct", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await waitForAppLoad(page);

    const mobileNav = page.getByRole("navigation", { name: /mobile/i });
    const captureDock = page.getByTestId("mobile-capture-dock");
    await expect(mobileNav.getByText("Review", { exact: true })).toBeVisible();
    await expect(captureDock).toBeVisible();

    const [navBox, captureBox] = await Promise.all([mobileNav.boundingBox(), captureDock.boundingBox()]);
    expect(navBox).not.toBeNull();
    expect(captureBox).not.toBeNull();
    expect(captureBox!.y + captureBox!.height).toBeLessThanOrEqual(navBox!.y);

    await page.getByTestId("capture-input").fill("Protect the planning block *");
    await page.getByTestId("submit-task").click();
    const detailTrigger = page.getByRole("button", {
      name: /view details for protect the planning block/i,
    });
    await expect(detailTrigger).toBeVisible();
    await detailTrigger.click();

    let details = page.getByRole("dialog", { name: "Protect the planning block" });
    await expect(details).toBeVisible();
    await expect(details.getByText("Schedule")).toBeVisible();
    await details.getByRole("button", { name: "Close", exact: true }).click();
    await expect(detailTrigger).toBeFocused();

    await detailTrigger.click();
    details = page.getByRole("dialog", { name: "Protect the planning block" });
    await details.getByRole("button", { name: "Edit task" }).click();
    await expect(page.getByTestId("edit-drawer")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
