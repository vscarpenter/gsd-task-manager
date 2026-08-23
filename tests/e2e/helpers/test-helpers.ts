import { expect, Page } from "@playwright/test";

export async function waitForAppLoad(page: Page): Promise<void> {
  // Handle redirect to about page by navigating to matrix
  if (page.url().includes("/about")) {
    await page.locator("[data-testid='nav-matrix']").click();
  }

  await page.waitForSelector("[data-testid='matrix-grid']", { timeout: 20000 });

  const onboarding = page.getByRole("dialog", { name: "Get the right things done." });
  if (await onboarding.isVisible({ timeout: 1000 }).catch(() => false)) {
    await onboarding.getByRole("button", { name: "Skip" }).click();
    await expect(onboarding).toBeHidden();
  }

  await expect(page.getByRole("button", { name: /Protect Q2/ })).toBeEnabled();
}

export async function getTaskCount(page: Page): Promise<number> {
  const tasks = await page.locator("[data-testid='task-card']").count();
  return tasks;
}

export async function getQuadrantTaskCount(
  page: Page,
  quadrant: "q1" | "q2" | "q3" | "q4"
): Promise<number> {
  const quadrantSelector = `[data-testid='quadrant-${quadrant}']`;
  await page.waitForSelector(quadrantSelector);
  const tasks = await page
    .locator(quadrantSelector)
    .locator("[data-testid='task-card']")
    .count();
  return tasks;
}

export async function createTaskViaCaptureBar(
  page: Page,
  taskTitle: string
): Promise<void> {
  const captureBar = page.locator("[data-testid='capture-bar']");
  const taskCount = await page.locator("[data-testid='task-card']").count();
  await captureBar.locator("[data-testid='capture-input']").fill(taskTitle);
  await captureBar.locator("[data-testid='submit-task']").click();
  await expect(captureBar.locator("[data-testid='capture-input']")).toHaveValue("");
  await expect(page.locator("[data-testid='task-card']")).toHaveCount(taskCount + 1);
}

export async function completeTask(page: Page, taskTitle: string): Promise<void> {
  const taskCard = page.locator(`[data-testid='task-card']`).filter({ hasText: taskTitle });
  await taskCard.locator("[data-testid='complete-task']").click();
  await expect(taskCard).toBeHidden();
}

export async function deleteTask(page: Page, taskTitle: string): Promise<void> {
  const taskCard = page.locator(`[data-testid='task-card']`).filter({ hasText: taskTitle });
  await taskCard.locator("[data-testid='task-card-menu']").click();
  await page.locator("[data-testid='delete-task']").click();
  await expect(taskCard).toHaveCount(0);
}

export async function searchTasks(page: Page, query: string): Promise<void> {
  const searchInput = page.locator("[data-testid='search-input']");
  await searchInput.fill(query);
}

export async function clearSearch(page: Page): Promise<void> {
  const searchInput = page.locator("[data-testid='search-input']");
  await searchInput.fill("");
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

export async function openSettings(page: Page): Promise<void> {
  const settingsButton = page.locator("[data-testid='nav-settings']");
  await settingsButton.click();
  await expect(page).toHaveURL(/\/settings/);
}

export async function openDashboard(page: Page): Promise<void> {
  const dashboardButton = page.locator("[data-testid='nav-dashboard']");
  await dashboardButton.click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function openMatrix(page: Page): Promise<void> {
  const matrixButton = page.locator("[data-testid='nav-matrix']");
  await matrixButton.click();
  await expect(page.locator("[data-testid='matrix-grid']")).toBeVisible();
}
