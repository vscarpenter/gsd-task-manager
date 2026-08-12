import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";
import { waitForAppLoad } from "./helpers/test-helpers";

test.describe("Settings Navigation", () => {
  let matrixPage: MatrixPage;

  test.beforeEach(async ({ page, clearIndexedDB }) => {
    matrixPage = new MatrixPage(page);
    await matrixPage.goto();
    await waitForAppLoad(page);
  });

  test("should open settings page", async ({ page }) => {
    await matrixPage.openSettings();
    
    // Verify we're on settings page
    await expect(page.url()).toContain("/settings");
    
    await expect(
      page.locator("#main-content").getByRole("heading", { name: "Settings", exact: true })
    ).toBeVisible();
  });

  test("should display settings navigation", async ({ page }) => {
    await matrixPage.openSettings();
    
    // Verify navigation is still visible
    await expect(page.locator("[data-testid='nav-settings']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-matrix']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-dashboard']")).toBeVisible();
  });

  test("should navigate back to matrix from settings", async ({ page }) => {
    await matrixPage.openSettings();

    await matrixPage.openMatrix();

    // Verify we're back on matrix page
    await expect(page.locator("[data-testid='matrix-grid']")).toBeVisible();
    await expect(page.url()).toContain("/");
  });

  test("should navigate between settings sections", async ({ page }) => {
    await matrixPage.openSettings();

    // Default section is Appearance — the section heading lives in the SectionCard
    await expect(page.locator("main h2", { hasText: "Appearance" })).toBeVisible();

    // Click into Notifications via the sidebar (use the desktop nav for stability)
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Notifications" }).click();
    await expect(page).toHaveURL(/#notifications$/);
    await expect(page.locator("main h2", { hasText: "Notifications" })).toBeVisible();

    // Click into Data & Storage
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Data & Storage" }).click();
    await expect(page).toHaveURL(/#data$/);
    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();

    // Back to Appearance
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Appearance" }).click();
    await expect(page).toHaveURL(/#appearance$/);
    await expect(page.locator("main h2", { hasText: "Appearance" })).toBeVisible();
  });

  test("should change theme via appearance settings", async ({ page }) => {
    await matrixPage.openSettings();

    const darkBtn = page.getByRole("button", { name: "Dark", exact: true });
    const lightBtn = page.getByRole("button", { name: "Light", exact: true });

    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");
    await expect(lightBtn).toHaveAttribute("aria-pressed", "false");
    // next-themes applies the class on <html>
    await expect(page.locator("html")).toHaveClass(/dark/);

    await lightBtn.click();
    await expect(lightBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("should toggle show-completed setting", async ({ page }) => {
    await matrixPage.openSettings();

    // The Show Completed switch sits in the SettingsRow labeled "Show completed"
    const showCompletedSwitch = page.getByRole("switch").first();
    const initialChecked = await showCompletedSwitch.getAttribute("aria-checked");

    await showCompletedSwitch.click();
    const flippedChecked = await showCompletedSwitch.getAttribute("aria-checked");
    expect(flippedChecked).not.toBe(initialChecked);

    // Toggle back
    await showCompletedSwitch.click();
    await expect(showCompletedSwitch).toHaveAttribute("aria-checked", initialChecked ?? "false");
  });

  test("should trigger export download", async ({ page }) => {
    await matrixPage.createTask("Task to export");
    await matrixPage.openSettings();

    // Navigate to Data & Storage section where Export lives
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Data & Storage" }).click();
    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export tasks/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^gsd-tasks-.*\.json$/);
  });

  /**
   * The backup is the only copy of this data that leaves the app, so what
   * matters is the *contents* of the file the user actually receives — not that
   * a download fired. Before ADR 0014 this file held 1 of 6 user-owned stores.
   */
  test("exported backup carries every user-owned store and no account data", async ({ page }) => {
    await matrixPage.createTask("Live task for backup");

    // Archived tasks live in their own store and can't be created from the UI.
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("GsdTaskManager");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("archivedTasks", "readwrite");
          const now = new Date().toISOString();
          tx.objectStore("archivedTasks").put({
            id: "e2e-archived-1",
            title: "Archived task for backup",
            description: "",
            urgent: false,
            important: false,
            quadrant: "not-urgent-not-important",
            completed: true,
            createdAt: now,
            updatedAt: now,
            archivedAt: now,
            recurrence: "none",
            tags: [],
            subtasks: [],
            dependencies: [],
            notificationEnabled: false,
            notificationSent: false,
            timeSpent: 0,
            timeEntries: [],
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
    });

    await matrixPage.openSettings();
    await page.locator("aside.lg\\:block").getByRole("button", { name: "Data & Storage" }).click();
    await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export tasks/ }).click();
    const stream = await (await downloadPromise).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    expect(backup.version).toBe("2.0.0");
    expect(backup.tasks.length).toBeGreaterThan(0);

    // The 232-record omission this ADR exists to fix.
    expect(backup.archivedTasks).toHaveLength(1);
    expect(backup.archivedTasks[0].archivedAt).toBeTruthy();

    // syncMetadata carries email / userId / deviceId. A backup must not bind
    // the file to an account.
    const serialized = JSON.stringify(backup);
    for (const forbidden of ["syncMetadata", "deviceInfo", "syncHistory", "syncQueue"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
