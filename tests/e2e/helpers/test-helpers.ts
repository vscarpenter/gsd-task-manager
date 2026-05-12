import { Page } from "@playwright/test";

export async function waitForAppLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  
  // Handle redirect to about page by navigating to matrix
  if (page.url().includes("/about")) {
    await page.locator("[data-testid='nav-matrix']").click();
    await page.waitForLoadState("networkidle");
  }
  
  await page.waitForTimeout(2000); // Wait for app to fully render
  await page.waitForSelector("[data-testid='matrix-grid']", { timeout: 20000 });
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
  await captureBar.locator("[data-testid='capture-input']").fill(taskTitle);
  await captureBar.locator("[data-testid='submit-task']").click();
  await page.waitForTimeout(500); // Wait for task to be created
}

export async function completeTask(page: Page, taskTitle: string): Promise<void> {
  const taskCard = page.locator(`[data-testid='task-card']`).filter({ hasText: taskTitle });
  await taskCard.locator("[data-testid='complete-task']").click();
  await page.waitForTimeout(500); // Wait for confetti animation
}

export async function deleteTask(page: Page, taskTitle: string): Promise<void> {
  const taskCard = page.locator(`[data-testid='task-card']`).filter({ hasText: taskTitle });
  await taskCard.locator("[data-testid='task-card-menu']").click();
  await page.locator("[data-testid='delete-task']").click();
  await page.waitForTimeout(500); // Wait for deletion
}

export async function searchTasks(page: Page, query: string): Promise<void> {
  const searchInput = page.locator("[data-testid='search-input']");
  await searchInput.fill(query);
  await page.waitForTimeout(300); // Wait for search results
}

export async function clearSearch(page: Page): Promise<void> {
  const searchInput = page.locator("[data-testid='search-input']");
  await searchInput.fill("");
  await page.waitForTimeout(300);
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function openSettings(page: Page): Promise<void> {
  const settingsButton = page.locator("[data-testid='nav-settings']");
  await settingsButton.click();
  await page.waitForTimeout(500);
}

export async function openDashboard(page: Page): Promise<void> {
  const dashboardButton = page.locator("[data-testid='nav-dashboard']");
  await dashboardButton.click();
  await page.waitForTimeout(500);
}

export async function openMatrix(page: Page): Promise<void> {
  const matrixButton = page.locator("[data-testid='nav-matrix']");
  await matrixButton.click();
  await page.waitForTimeout(500);
}