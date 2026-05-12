import { Page, Locator } from "@playwright/test";

export class MatrixPage {
  readonly page: Page;
  readonly captureBar: Locator;
  readonly matrixGrid: Locator;
  readonly q1Quadrant: Locator;
  readonly q2Quadrant: Locator;
  readonly q3Quadrant: Locator;
  readonly q4Quadrant: Locator;
  readonly searchInput: Locator;
  readonly navSettings: Locator;
  readonly navDashboard: Locator;
  readonly navMatrix: Locator;

  constructor(page: Page) {
    this.page = page;
    this.captureBar = page.locator("[data-testid='capture-bar']");
    this.matrixGrid = page.locator("[data-testid='matrix-grid']");
    this.q1Quadrant = page.locator("[data-testid='quadrant-q1']");
    this.q2Quadrant = page.locator("[data-testid='quadrant-q2']");
    this.q3Quadrant = page.locator("[data-testid='quadrant-q3']");
    this.q4Quadrant = page.locator("[data-testid='quadrant-q4']");
    this.searchInput = page.locator("[data-testid='search-input']");
    this.navSettings = page.locator("[data-testid='nav-settings']");
    this.navDashboard = page.locator("[data-testid='nav-dashboard']");
    this.navMatrix = page.locator("[data-testid='nav-matrix']");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
    
    // Handle redirect to about page by navigating to matrix
    if (this.page.url().includes("/about")) {
      await this.navMatrix.click();
      await this.page.waitForLoadState("networkidle");
    }
    
    await this.page.waitForTimeout(2000); // Wait for app to fully render
    await this.matrixGrid.waitFor({ state: "visible", timeout: 20000 });
  }

  async createTask(title: string): Promise<void> {
    await this.captureBar.locator("[data-testid='capture-input']").fill(title);
    await this.captureBar.locator("[data-testid='submit-task']").click();
    await this.page.waitForTimeout(500);
  }

  async getTaskCount(): Promise<number> {
    return await this.page.locator("[data-testid='task-card']").count();
  }

  async getQuadrantTaskCount(quadrant: "q1" | "q2" | "q3" | "q4"): Promise<number> {
    const quadrantSelector = `[data-testid='quadrant-${quadrant}']`;
    await this.page.waitForSelector(quadrantSelector);
    return await this.page
      .locator(quadrantSelector)
      .locator("[data-testid='task-card']")
      .count();
  }

  async completeTask(title: string): Promise<void> {
    const taskCard = this.page.locator("[data-testid='task-card']").filter({ hasText: title });
    await taskCard.locator("[data-testid='complete-task']").click();
    await this.page.waitForTimeout(500);
  }

  async deleteTask(title: string): Promise<void> {
    const taskCard = this.page.locator("[data-testid='task-card']").filter({ hasText: title });
    // Hover over the task card to reveal desktop actions
    await taskCard.hover();
    // Click the delete button directly (desktop actions)
    await taskCard.locator("[data-testid='delete-task']").click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Opens the edit drawer for the task with the given title.
   * Uses the desktop edit button revealed on hover; the same testid
   * exists on mobile so this works for both viewports.
   */
  async openEditDrawer(title: string): Promise<void> {
    const taskCard = this.page.locator("[data-testid='task-card']").filter({ hasText: title });
    await taskCard.hover();
    await taskCard.locator("[data-testid='edit-task']").first().click();
    await this.page.locator("[data-testid='edit-drawer']").waitFor({ state: "visible" });
  }

  /**
   * Updates the open edit drawer's title, description, and quadrant, then saves.
   * Requires the drawer to be open (call openEditDrawer first).
   */
  async saveEditDrawer(updates: {
    title?: string;
    description?: string;
    quadrant?: "q1" | "q2" | "q3" | "q4";
  }): Promise<void> {
    const drawer = this.page.locator("[data-testid='edit-drawer']");
    if (updates.title !== undefined) {
      await drawer.locator("[data-testid='edit-title']").fill(updates.title);
    }
    if (updates.description !== undefined) {
      await drawer.locator("[data-testid='edit-description']").fill(updates.description);
    }
    if (updates.quadrant) {
      await drawer.locator(`[data-testid='edit-quadrant-${updates.quadrant}']`).click();
    }
    await drawer.locator("[data-testid='save-task']").click();
    await drawer.waitFor({ state: "hidden" });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.fill("");
    await this.page.waitForTimeout(300);
  }

  async openSettings(): Promise<void> {
    // Dismiss PWA install dialog if present (can block clicks in WebKit)
    const pwaDialog = this.page.locator("[role='dialog'][aria-labelledby='install-pwa-title']");
    if (await pwaDialog.isVisible().catch(() => false)) {
      await pwaDialog.locator("button[aria-label='Dismiss install prompt']").click();
      await this.page.waitForTimeout(200);
    }
    await this.navSettings.click();
    await this.page.waitForTimeout(500);
  }

  async openDashboard(): Promise<void> {
    // Dismiss PWA install dialog if present (can block clicks in WebKit)
    const pwaDialog = this.page.locator("[role='dialog'][aria-labelledby='install-pwa-title']");
    if (await pwaDialog.isVisible().catch(() => false)) {
      await pwaDialog.locator("button[aria-label='Dismiss install prompt']").click();
      await this.page.waitForTimeout(200);
    }
    await this.navDashboard.click();
    await this.page.waitForTimeout(500);
  }

  async openMatrix(): Promise<void> {
    // Dismiss PWA install dialog if present (can block clicks in WebKit)
    const pwaDialog = this.page.locator("[role='dialog'][aria-labelledby='install-pwa-title']");
    if (await pwaDialog.isVisible().catch(() => false)) {
      await pwaDialog.locator("button[aria-label='Dismiss install prompt']").click();
      await this.page.waitForTimeout(200);
    }
    await this.navMatrix.click();
    await this.page.waitForTimeout(500);
  }
}