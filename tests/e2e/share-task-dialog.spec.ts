import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import type { Page, Locator } from "@playwright/test";

type MailtoWindow = Window & { __mailtoHrefs: string[] };

/**
 * Live-engine verification for the share-dialog recipient-email validation (#399).
 * Intercepts mailto: anchor clicks so a valid submit can't launch a real mail
 * client during the run, and so we can assert the generated link is percent-encoded.
 */
async function openEmailTab(page: Page): Promise<Locator> {
  await page.addInitScript(() => {
    const w = window as unknown as MailtoWindow;
    w.__mailtoHrefs = [];
    const proto = HTMLAnchorElement.prototype;
    const originalClick = proto.click;
    proto.click = function (this: HTMLAnchorElement) {
      if (typeof this.href === "string" && this.href.startsWith("mailto:")) {
        w.__mailtoHrefs.push(this.href);
        return;
      }
      originalClick.call(this);
    };
  });

  const matrix = new MatrixPage(page);
  await matrix.goto();
  await matrix.createTask("Verify share email validation");

  const card = page.locator("[data-testid='task-card']").first();
  await card.hover();
  await card.getByRole("button", { name: "Share task" }).click();

  const dialog = page.locator("[data-testid='share-task-dialog']");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Email" }).click();
  return dialog;
}

test.describe("Share task dialog · recipient email validation (#399)", () => {
  test("invalid email shows an inline error and does not open a mail client", async ({
    page,
    clearIndexedDB,
  }) => {
    const dialog = await openEmailTab(page);
    await dialog.locator("#recipient-email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Open Email Client" }).click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog).toBeVisible(); // guard returns early; dialog stays open
    const mailtoCount = await page.evaluate(
      () => (window as unknown as MailtoWindow).__mailtoHrefs.length
    );
    expect(mailtoCount).toBe(0);
  });

  test("editing the recipient clears the error", async ({ page, clearIndexedDB }) => {
    const dialog = await openEmailTab(page);
    await dialog.locator("#recipient-email").fill("bad");
    await dialog.getByRole("button", { name: "Open Email Client" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();

    await dialog.locator("#recipient-email").fill("bad@example.com");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
  });

  test("valid email builds a percent-encoded mailto and closes the dialog", async ({
    page,
    clearIndexedDB,
  }) => {
    const dialog = await openEmailTab(page);
    await dialog.locator("#recipient-email").fill("test@example.com");
    await dialog.getByRole("button", { name: "Open Email Client" }).click();

    await expect(dialog).toBeHidden();
    const hrefs = await page.evaluate(
      () => (window as unknown as MailtoWindow).__mailtoHrefs
    );
    expect(hrefs).toHaveLength(1);
    expect(hrefs[0]).toContain("mailto:test%40example.com");
  });
});
