import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

test.beforeEach(async ({ clearIndexedDB, page, serviceWorkerEnabled }) => {
  if (serviceWorkerEnabled) return;
  // Always use fresh app code; retain IndexedDB during cache resets.
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      await Promise.all((await navigator.serviceWorker.getRegistrations()).map((worker) => worker.unregister()));
    }
    await Promise.all((await caches.keys()).filter((key) => key.startsWith("gsd-")).map((key) => caches.delete(key)));
  });
});

/**
 * Due time of day (D-1): a due date at local midnight is all day, any other
 * time is a time of day. The edit drawer sets it; the card shows it.
 */
test.describe("Due time of day", () => {
  test("sets a time in the drawer, shows it on the card, and clears it with All day", async ({ page }) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await matrix.createTask("Send the invoice");

    await matrix.openEditDrawer("Send the invoice");
    const drawer = page.locator("[data-testid='edit-drawer']");
    await drawer.getByRole("button", { name: "Next week", exact: true }).click();

    const allDay = drawer.getByRole("switch", { name: "All day" });
    await expect(allDay).toBeChecked();
    await allDay.click();
    await drawer.getByLabel("Due time").fill("15:30");
    await drawer.locator("[data-testid='save-task']").click();
    await drawer.waitFor({ state: "hidden" });

    const card = page.locator("[data-testid='task-card']").filter({ hasText: "Send the invoice" });
    await expect(card).toContainText(/3:30\s?PM/);

    await matrix.openEditDrawer("Send the invoice");
    await expect(drawer.getByLabel("Due time")).toHaveValue("15:30");
    await drawer.getByRole("switch", { name: "All day" }).click();
    await drawer.locator("[data-testid='save-task']").click();
    await drawer.waitFor({ state: "hidden" });

    await expect(card).not.toContainText(/3:30\s?PM/);
  });
});
