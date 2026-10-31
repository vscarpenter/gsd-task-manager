import { test, expect } from "./fixtures/test-fixtures";
import { MatrixPage } from "./pages/matrix-page";

/**
 * A person signed in with Apple is told which account they landed on, as on iOS:
 * each provider is its own PocketBase account, so another provider elsewhere shows other tasks.
 * The signed-in state is seeded into IndexedDB; no backend is involved.
 */
test.describe("Apple sign-in account note", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {});
  // Reminder and sync background work may log while the seeded account tries to connect.
  test.use({ expectedConsoleErrors: /.*/ });

  async function seedAccount(page: import("@playwright/test").Page, email: string, provider: string) {
    await page.evaluate(
      ({ email, provider }) => {
        // An unexpired JWT is all the client checks, so no backend is involved.
        const b64 = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
        const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "u1", type: "authRecord", exp: 4102444800 })}.sig`;
        localStorage.setItem("pocketbase_auth", JSON.stringify({ token, record: { id: "u1", email } }));
        return new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("GsdTaskManager");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("syncMetadata", "readwrite");
            tx.objectStore("syncMetadata").put({
              key: "sync_config", enabled: true, userId: "u1", deviceId: "d1", deviceName: "Test",
              email, provider, lastSyncAt: null,
            });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => reject(tx.error);
          };
        });
      },
      { email, provider },
    );
  }

  // A signed-in account's button syncs instead of opening the dialog; the dialog opens on this event
  // (right after sign-in, and when a session needs re-login).
  async function openSyncDialog(page: import("@playwright/test").Page) {
    // The listener mounts with the top bar; the sync status text shows the page has hydrated.
    await expect(page.getByText(/Last sync/)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("gsd:open-sync")));
  }

  test("shows the note for a private relay sign-in, and not for Google", async ({ page }) => {
    // The seeded account tries to sync. Nothing may reach the production backend.
    await page.route(/api\.vinny\.io/, (route) => route.abort());
    const matrix = new MatrixPage(page);
    await matrix.goto();

    await seedAccount(page, "abc@privaterelay.appleid.com", "apple");
    await page.reload();
    await openSyncDialog(page);
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByRole("note")).toContainText("private relay email");

    await page.keyboard.press("Escape");
    await seedAccount(page, "me@example.com", "google");
    await page.reload();
    await openSyncDialog(page);
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  });
});
