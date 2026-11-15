const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const { allowPublicRequest } = require("./browser-policy.cjs");

const SITE = "https://gsd.vinny.dev";
const FIRST = "Monitoring task one";
const SECOND = "Monitoring task two";
const EDITED = "Monitoring task edited";

function addDiagnostics(page, state) {
  page.on("pageerror", () => { state.unexpectedErrors += 1; });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (state.offline && /^(Failed to (preconnect|load resource)|\[JavaScript Error: "Failed to load)/.test(text)) {
      state.offlineDiagnostics += 1;
    } else if (/^Fetch API cannot load https:\/\/gsd\.vinny\.dev\/(?:[a-z0-9-]+\/)*__next\.[^/?\s]+\.txt\?_rsc=[A-Za-z0-9_-]+ due to access control checks\.$/.test(text)) {
      state.cancellations += 1;
    } else {
      state.unexpectedErrors += 1;
    }
  });
  page.on("requestfailed", (request) => {
    if (state.offline) state.offlineDiagnostics += 1;
    else if (["net::ERR_ABORTED", "NS_BINDING_ABORTED", "cancelled"].includes(request.failure()?.errorText)) state.cancellations += 1;
    else state.unexpectedErrors += 1;
  });
  page.on("response", (response) => {
    if (!state.offline && response.status() >= 400) state.unexpectedErrors += 1;
  });
}

async function ready(page) {
  await page.getByTestId("capture-input").waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="submit-task"]')?.disabled);
}

function card(page, title) {
  return page.getByTestId("task-card").filter({ hasText: title });
}

async function capture(page) {
  const input = page.getByTestId("capture-input");
  await input.fill(FIRST);
  await input.evaluate((field) => field.blur());
  await page.getByTestId("submit-task").click();
  await expect(card(page, FIRST)).toBeVisible();
  await expect(input).toBeFocused();
  await page.keyboard.type(SECOND);
  await page.keyboard.press("Enter");
  await expect(card(page, SECOND)).toBeVisible();
  await expect(input).toBeFocused();
}

async function edit(page) {
  await card(page, FIRST).hover();
  await card(page, FIRST).getByTestId("edit-task").first().click();
  await page.locator('[data-testid="edit-title"]:focus').waitFor();
  await page.getByTestId("edit-title").fill(EDITED);
  await page.getByTestId("edit-subtask-input").fill("Monitoring subtask");
  await page.getByTestId("edit-drawer").getByTestId("save-task").click();
  await expect(page.getByTestId("edit-drawer")).toBeHidden();
  const persisted = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("GsdTaskManager");
    request.onerror = () => reject(new Error("LocalProbeStorageFailure"));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("tasks");
      const query = transaction.objectStore("tasks").getAll();
      transaction.oncomplete = () => {
        const found = query.result.some((task) => task.title === "Monitoring task edited" && task.subtasks?.[0]?.title === "Monitoring subtask");
        db.close(); resolve(found);
      };
      transaction.onerror = () => { db.close(); reject(new Error("LocalProbeStorageFailure")); };
    };
  }));
  assert.equal(persisted, true);
}

async function releaseViews(page) {
  const response = await page.request.get(`${SITE}/sw.js`);
  const version = (await response.text()).match(/\bCACHE_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1];
  assert.ok(version);
  await page.goto(`${SITE}/settings#about`, { waitUntil: "domcontentloaded" });
  await page.getByText("Privacy First", { exact: true }).waitFor();
  await expect(page.getByText(version, { exact: true })).toBeVisible();
  await page.goto(`${SITE}/settings#whats-new`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: `Version ${version}`, exact: true }).waitFor();
  return version;
}

async function offlineViews(page, context, state, version) {
  await page.goto(`${SITE}/settings#whats-new`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: `Version ${version}`, exact: true }).waitFor();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  state.offline = true;
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await expect(card(page, EDITED)).toBeVisible();
    await expect(card(page, SECOND)).toBeVisible();
    await page.goto(`${SITE}/settings#whats-new`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: `Version ${version}`, exact: true }).waitFor();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await ready(page);
  } finally {
    await context.setOffline(false);
    state.offline = false;
  }
}

async function finishTasks(page) {
  await card(page, SECOND).getByTestId("complete-task").click();
  await expect(card(page, SECOND)).toBeHidden();
  await card(page, EDITED).hover();
  await card(page, EDITED).getByTestId("delete-task").click();
  await expect(card(page, EDITED)).toHaveCount(0);
}

async function exercise(page, context, state) {
  const step = async (name, operation) => {
    state.step = name;
    const result = await operation();
    state.checks.push(name);
    return result;
  };
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await ready(page);
  state.step = "startup-local-auth";
  assert.equal(await page.evaluate(() => {
    const stored = localStorage.getItem("pocketbase_auth");
    if (!stored) return false;
    try {
      const auth = JSON.parse(stored);
      return Boolean(auth.token || auth.record?.id);
    } catch {
      return true;
    }
  }), false);
  state.step = "startup-worker-active";
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === "activated");
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  state.step = "startup-worker-control";
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await step("capture", () => capture(page));
  await step("pending-subtask", () => edit(page));
  const version = await step("version-and-notes", () => releaseViews(page));
  await step("offline-persistence-and-notes", () => offlineViews(page, context, state, version));
  await step("complete-delete", () => finishTasks(page));
  await step("privacy-and-runtime", async () => {
    assert.equal(state.blockedRequests, 0);
    assert.equal(state.unexpectedErrors, 0);
  });
}

async function browserCheck() {
  const browser = await chromium.launch({ channel: "chromium" });
  const context = await browser.newContext();
  const state = { browser: "chromium", checks: [], step: "startup", offline: false, blockedRequests: 0, unexpectedErrors: 0, offlineDiagnostics: 0, cancellations: 0 };
  try {
    await context.addInitScript(() => {
      localStorage.setItem("gsd-has-launched", "true");
      localStorage.setItem("gsd-onboarding-seen", "true");
    });
    await context.route("**/*", (route) => {
      const request = route.request();
      if (allowPublicRequest(request.url(), request.method())) return route.continue();
      state.blockedRequests += 1;
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    addDiagnostics(page, state);
    await exercise(page, context, state);
    return { ...state, success: true };
  } catch {
    return { ...state, success: false, code: "BROWSER_CHECK_FAILED" };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runBrowserChecks() {
  const result = await browserCheck();
  return { success: result.success, profilesClosed: true, results: [result] };
}

module.exports = { runBrowserChecks };
