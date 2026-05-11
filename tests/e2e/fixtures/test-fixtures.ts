import { test as base } from "@playwright/test";

export const test = base.extend({
  // Custom fixture to clear IndexedDB before each test
  clearIndexedDB: async ({ page }, use) => {
    await use(page);
    // Clear IndexedDB after each test
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("gsd-taskmanager");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  },
});

export const expect = test.expect;