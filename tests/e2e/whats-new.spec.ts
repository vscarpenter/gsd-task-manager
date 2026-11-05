import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { createTaskViaCaptureBar, waitForAppLoad } from "./helpers/test-helpers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What's New, end to end (tasks/spec-whats-new.md). The show rule itself is
 * pinned by the cross-platform corpus; these specs prove the surfaces: the
 * one-line cue, its link and Dismiss, and the palette entry. The cue's headline
 * is checked against whats-new.json, so a new release entry doesn't break them.
 */

const content: { releases: Array<{ platform: string; version: string; notable: boolean; headline: string | null }> } =
  JSON.parse(readFileSync(join(process.cwd(), "lib/whats-new/whats-new.json"), "utf8"));
const LAST_SEEN = "gsd:whats-new:last-seen";
const OLDER_THAN_EVERY_RELEASE = "0.0.1";

test.describe("What's New", () => {
  test.beforeEach(async ({ page, clearIndexedDB }) => {
    await new MatrixPage(page).goto();
    await waitForAppLoad(page);
  });

  async function becomeExistingUserBeforeAnUpdate(page: import("@playwright/test").Page): Promise<void> {
    await createTaskViaCaptureBar(page, "Already using GSD");
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [LAST_SEEN, OLDER_THAN_EVERY_RELEASE]);
    await page.reload();
    await waitForAppLoad(page);
  }

  test("a first visit records the running version and shows no cue", async ({ page }) => {
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LAST_SEEN)).toMatch(/^\d+\.\d+\.\d+$/);
    await expect(page.getByTestId("whats-new-cue")).toHaveCount(0);
  });

  test("an existing user sees the newest notable headline after an update", async ({ page }) => {
    await becomeExistingUserBeforeAnUpdate(page);

    const cue = page.getByTestId("whats-new-cue");
    const text = (await cue.textContent()) ?? "";
    const match = /New in (\d+\.\d+\.\d+): (.+?)See what/.exec(text);
    expect(match, text).not.toBeNull();
    const entry = content.releases.find((r) => r.platform === "web" && r.version === match?.[1]);
    expect(entry?.notable).toBe(true);
    expect(match?.[2].trim()).toBe(entry?.headline);
  });

  test("See what's new opens the section and retires the cue", async ({ page }) => {
    await becomeExistingUserBeforeAnUpdate(page);
    await page.getByRole("link", { name: "See what’s new" }).click();

    await expect(page).toHaveURL(/\/settings\/?#whats-new$/);
    await expect(page.locator("main h2", { hasText: "What's new" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText(/^Version \d+\.\d+\.\d+$/);

    await new MatrixPage(page).goto();
    await waitForAppLoad(page);
    await expect(page.getByTestId("whats-new-cue")).toHaveCount(0);
  });

  test("Dismiss hides the cue for good", async ({ page }) => {
    await becomeExistingUserBeforeAnUpdate(page);
    await page.getByRole("button", { name: "Dismiss what's new" }).click();
    await expect(page.getByTestId("whats-new-cue")).toHaveCount(0);

    await page.reload();
    await waitForAppLoad(page);
    await expect(page.getByTestId("whats-new-cue")).toHaveCount(0);
  });

  test("the command palette opens the section", async ({ page }) => {
    await page.mouse.move(0, 0);
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("What's new");
    await page.getByRole("option", { name: "What's new" }).click();

    await expect(page).toHaveURL(/\/settings\/?#whats-new$/);
    await expect(page.locator("main h2", { hasText: "What's new" })).toBeVisible();
  });
});
