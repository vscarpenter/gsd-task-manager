import { test, expect, MatrixPage } from "../harness/fixtures";
import type { Download, Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const IOS_BACKUP = "tests/fixtures/cross-platform/ios-backup-export.json";

async function readDownload(download: Download): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function openData(page: Page): Promise<void> {
  await page.goto("/settings#data");
  await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();
}

async function chooseImportFile(page: Page, name: string, contents: string | Buffer): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /import/i }).click();
  await (await chooser).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(contents) });
}

test("backup-export", async ({ page, matrix, proof }) => {
  await matrix.createTask("Task worth keeping !!");
  await openData(page);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export tasks/ }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toMatch(/^gsd-tasks-.*\.json$/);
  const backup = await readDownload(download);
  proof.write("backup", backup);
  expect(backup.tasks).toMatchObject([{ title: "Task worth keeping" }]);
  for (const store of ["archivedTasks", "deletedTasks"]) expect(backup).toHaveProperty(store);
  const serialized = JSON.stringify(backup);
  for (const forbidden of ["syncMetadata", "deviceInfo", "syncHistory", "syncQueue"]) {
    expect(serialized).not.toContain(forbidden);
  }
});

test("backup-export-palette", async ({ page, matrix: _matrix }) => {
  await page.keyboard.press("ControlOrMeta+k");
  const downloading = page.waitForEvent("download");
  await page.getByRole("option", { name: /Export tasks as JSON/ }).click();

  expect((await downloading).suggestedFilename()).toMatch(/^gsd-tasks-.*\.json$/);
});

test("backup-sidebar-path", async ({ page, matrix, proof }) => {
  await matrix.openSettings();
  await page.locator("aside.lg\\:block").getByRole("button", { name: "Data & Storage" }).click();

  await expect(page).toHaveURL(/#data$/);
  await expect(page.getByRole("button", { name: /Export tasks/ })).toBeVisible();
  await proof.capture("data-section");
});

test("backup-import-palette", async ({ page, matrix: _matrix }) => {
  // Known app bug, found 2026-11-02: the URL becomes /settings/#data but the page
  // stays on Appearance. The assertion is correct. Remove this line with the fix.
  test.fail(true, "palette navigation to /settings#data leaves the Appearance section showing");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: /Import tasks from JSON/ }).click();

  await expect(page).toHaveURL(/\/settings\/?#data$/);
  await expect(page.locator("main h2", { hasText: "Data & Storage" })).toBeVisible();
});

test("backup-import-ios-merge", async ({ page, matrix, proof }) => {
  await matrix.createTask("Already on this device");
  await openData(page);
  await chooseImportFile(page, "ios-backup-export.json", readFileSync(IOS_BACKUP));

  const dialog = page.getByRole("dialog", { name: /import tasks/i });
  await expect(dialog).toBeVisible();
  await proof.capture("import-dialog");
  await dialog.getByRole("button", { name: /Merge Tasks/ }).click();
  await expect(dialog).toBeHidden();

  await new MatrixPage(page).goto();
  const cards = page.getByTestId("task-card");
  await expect(cards.filter({ hasText: "Ship the parity fixes" })).toBeVisible();
  await expect(cards.filter({ hasText: "Already on this device" })).toBeVisible();
  await proof.capture("merged");
  const titles = (await proof.rows("after-merge")).map((row) => row.title);
  expect(titles).toEqual(expect.arrayContaining(["Already on this device", "Ship the parity fixes", "Blocked on the first one"]));
});

test("backup-round-trip-replace", async ({ page, matrix, proof }) => {
  await matrix.createTask("Survives the round trip *");
  await openData(page);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export tasks/ }).click();
  const backup = JSON.stringify(await readDownload(await downloading));

  await new MatrixPage(page).goto();
  await matrix.createTask("Created after the backup");
  await openData(page);
  await chooseImportFile(page, "own-backup.json", backup);
  const dialog = page.getByRole("dialog", { name: /import tasks/i });
  await proof.capture("before-replace");
  // Sync is off here, so Replace runs at once. Its "Delete and replace" step needs sync on.
  await dialog.getByRole("button", { name: /Replace Everything/ }).click();
  await expect(dialog).toBeHidden();

  await new MatrixPage(page).goto();
  await expect(page.getByTestId("task-card").filter({ hasText: "Survives the round trip" })).toBeVisible();
  await expect(page.getByTestId("task-card").filter({ hasText: "Created after the backup" })).toHaveCount(0);
  expect(await proof.rows("after-replace")).toMatchObject([{ title: "Survives the round trip" }]);
});

test("backup-import-invalid", async ({ page, matrix, proof }) => {
  await matrix.createTask("Must survive a bad file");
  await openData(page);
  await chooseImportFile(page, "broken.json", "{this is not valid json");

  await expect(page.getByText(/invalid json format/i)).toBeVisible();
  await expect(page.getByRole("dialog", { name: /import tasks/i })).toHaveCount(0);
  await proof.capture("rejected");
  expect(await proof.rows("data-untouched")).toMatchObject([{ title: "Must survive a bad file" }]);
});
