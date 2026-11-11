import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-fixtures";
import { waitForAppLoad } from "./helpers/test-helpers";

/**
 * Sign-in through a real popup, with the provider and PocketBase stood in for.
 * The fake provider URL is this app's own callback page, so the popup runs the
 * real relay: BroadcastChannel message, acknowledgement, and window.close().
 */

const STATE = "e2e-state-0001";
const USER = {
  id: "e2eoauthuser0001",
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  email: "oauth-e2e@example.test",
  verified: true,
};

// Unsigned, and accepted only by the SDK's local expiry check. Every
// PocketBase request is intercepted below.
function syntheticToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 7200;
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: USER.id, exp })}.synthetic`;
}

/** Stands in for PocketBase. `providerUrl` is where the popup goes for every provider. */
async function mockBackend(page: Page, providerUrl: string): Promise<string[]> {
  const exchanges: string[] = [];
  await page.route("**/api/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 200, message: "Healthy", items: [], totalItems: 0 }),
    })
  );
  // Signing in starts realtime sync. WebKit reports a JSON answer to an
  // EventSource as a page error, so the stream gets a real connect event.
  await page.route("**/api/realtime", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          contentType: "text/event-stream",
          body: 'id:e2e-client\nevent:PB_CONNECT\ndata:{"clientId":"e2e-client"}\n\n',
        })
      : route.fulfill({ status: 204 })
  );
  await page.route("**/api/collections/users/auth-methods**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        password: { enabled: false, identityFields: [] },
        mfa: { enabled: false, duration: 0 },
        otp: { enabled: false, duration: 0 },
        oauth2: {
          enabled: true,
          providers: ["google", "apple", "github"].map((name) => ({
            name,
            displayName: name,
            state: STATE,
            authURL: providerUrl,
            codeVerifier: "e2e-verifier",
            codeChallenge: "e2e-challenge",
            codeChallengeMethod: "S256",
          })),
        },
      }),
    })
  );
  await page.route("**/api/collections/users/auth-with-oauth2**", async (route) => {
    exchanges.push(route.request().postData() ?? "");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ token: syntheticToken(), record: USER }),
    });
  });
  return exchanges;
}

async function openSignIn(page: Page) {
  await waitForAppLoad(page);
  await page.locator("button[aria-label='Sync not enabled']").click();
  const dialog = page.getByRole("dialog", { name: /sync settings/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("OAuth sign-in", () => {
  test.beforeEach(async ({ clearIndexedDB }) => {
    // Fixture clears IndexedDB
  });

  test("a waiting sign-in can be cancelled from the dialog", async ({ page, baseURL }) => {
    // A provider page that never comes back, like a popup the user walked away from.
    await mockBackend(page, `${baseURL}/about/?redirect=`);
    const dialog = await openSignIn(page);

    const popupOpened = page.waitForEvent("popup");
    await dialog.getByRole("button", { name: "Continue with GitHub" }).click();
    await popupOpened;

    await expect(dialog.getByRole("status")).toContainText("Waiting for GitHub");
    const cancel = dialog.getByRole("button", { name: "Cancel sign-in" });
    await expect(cancel).toBeFocused();
    await cancel.click();

    await expect(dialog.getByRole("status")).toBeEmpty();
    await expect(dialog.getByRole("alert")).toBeHidden();
    await expect(dialog.getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
  });

  test("the popup relays the code, closes itself, and the dialog signs in", async ({ page, baseURL, browserName }) => {
    const exchanges = await mockBackend(
      page,
      `${baseURL}/auth/callback/#state=${STATE}&code=e2e-code&redirect=`
    );
    const dialog = await openSignIn(page);

    const popupOpened = page.waitForEvent("popup");
    await dialog.getByRole("button", { name: "Continue with GitHub" }).click();
    const popup = await popupOpened;

    await popup.waitForEvent("close");
    await expect(page.getByText(`Signed in as ${USER.email}`).first()).toBeVisible();
    // Focus has to land somewhere after the buttons that held it are gone. WebKit
    // doesn't focus a button on click, so there the dialog has no opener to return to.
    if (browserName !== "webkit") {
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
    }
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]).toContain("e2e-code");
    expect(exchanges[0]).toContain("e2e-verifier");
  });

  test("the callback page says so when no tab is waiting for the sign-in", async ({ page }) => {
    await page.goto(`/auth/callback/#state=${STATE}&code=e2e-code`);

    // Next's route announcer is a second role="alert", so match on the text.
    await expect(page.getByText("GSD didn't pick up this sign-in")).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
  });

  test("the callback page says so when it was opened without a sign-in", async ({ page }) => {
    await page.goto("/auth/callback/");

    await expect(page.getByText("no sign-in to finish")).toBeVisible();
  });
});
