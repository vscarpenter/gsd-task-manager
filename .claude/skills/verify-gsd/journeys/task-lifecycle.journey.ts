import { test, expect } from "../harness/fixtures";

test("task-edit", async ({ page, matrix, proof }) => {
  await matrix.createTask("Original title");
  await matrix.openEditDrawer("Original title");
  await proof.capture("drawer-open");
  await matrix.saveEditDrawer({ title: "Updated title", description: "Now with details", quadrant: "q1" });

  const card = page.getByTestId("quadrant-q1").getByTestId("task-card").filter({ hasText: "Updated title" });
  await expect(card).toContainText("Now with details");
  await proof.capture("after-save");

  await page.reload();
  await expect(card).toContainText("Now with details");
  const rows = await proof.rows("after-reload");
  expect(rows).toMatchObject([
    { title: "Updated title", description: "Now with details", urgent: true, important: true },
  ]);
});

test("task-complete", async ({ page, matrix, proof }) => {
  await matrix.createTask("Send the invoice !!");
  await matrix.completeTask("Send the invoice");

  await expect(page.getByTestId("task-card").filter({ hasText: "Send the invoice" })).toBeHidden();
  await proof.capture("after-complete");
  const [row] = await proof.rows("after-complete");
  expect(row).toMatchObject({ title: "Send the invoice", completed: true });
  expect(row.completedAt).toBeTruthy();
});

test("task-recurring-complete", async ({ page, matrix, proof }) => {
  await matrix.createTask("Water the plants");
  await matrix.openEditDrawer("Water the plants");
  const drawer = page.getByTestId("edit-drawer");
  await drawer.getByTestId("edit-recurrence-daily").click();
  await drawer.getByTestId("save-task").click();
  await drawer.waitFor({ state: "hidden" });
  const card = page.getByTestId("task-card").filter({ hasText: "Water the plants" });
  const firstId = await card.getAttribute("data-task-id");

  // MatrixPage.completeTask waits for the title to vanish, and the next instance keeps it.
  await card.getByTestId("complete-task").click();

  await expect(card).toHaveCount(1);
  await expect(card).not.toHaveAttribute("data-task-id", firstId as string);
  await proof.capture("next-instance");
  const rows = await proof.rows("after-complete");
  expect(rows.map((row) => row.completed).sort()).toEqual([false, true]);
});

test("task-move-undo", async ({ page, matrix, proof }) => {
  await matrix.createTask("Plan the offsite *");
  const inQuadrant = (id: string) =>
    page.getByTestId(`quadrant-${id}`).getByTestId("task-card").filter({ hasText: "Plan the offsite" });
  await inQuadrant("q2").hover();
  await inQuadrant("q2").getByRole("button", { name: "More actions" }).click();
  // Keyboard path: a pointer jump onto a Radix submenu item races its positioning.
  await page.getByRole("menuitem", { name: "Move to", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menuitem", { name: "Do First" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(inQuadrant("q1")).toBeVisible();
  await proof.capture("moved");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(inQuadrant("q2")).toBeVisible();
  const rows = await proof.rows("after-undo");
  expect(rows).toMatchObject([{ quadrant: "not-urgent-important" }]);
});

test("task-delete-restore", async ({ page, matrix, proof }) => {
  await matrix.createTask("Old errand");
  await matrix.deleteTask("Old errand");
  expect(await proof.rows("after-delete")).toEqual([]);
  expect(await proof.rows("after-delete", "deletedTasks")).toMatchObject([{ title: "Old errand" }]);

  await page.goto("/settings#trash");
  await proof.capture("trash");
  await page.getByRole("button", { name: "Restore Old errand" }).click();
  await expect(page.getByText("Restored “Old errand”")).toBeVisible();

  await page.getByTestId("nav-matrix").click();
  await expect(page.getByTestId("task-card").filter({ hasText: "Old errand" })).toBeVisible();
  expect(await proof.rows("after-restore")).toMatchObject([{ title: "Old errand" }]);
  expect(await proof.rows("after-restore", "deletedTasks")).toEqual([]);
  await proof.capture("restored");
});
