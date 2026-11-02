import { test as base, expect, type ConsoleMessage, type Page, type Request } from "@playwright/test";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MatrixPage } from "../../../../tests/e2e/pages/matrix-page";

const EVIDENCE_DIR = process.env.GSD_VERIFY_EVIDENCE as string;
// gsd-verify runs Playwright from the repository root.
const SEED_SCRIPT = readFileSync("tools/stagehand/page-scripts/seed-tasks.js", "utf8");
const DB_NAME = "GsdTaskManager";
const SETTLE_INTERVAL_MS = 150;
const SETTLE_ATTEMPTS = 20;

// Chromium logs a failed resource as a console error. The network log already
// records these, and the DNS block makes them expected for anything off-origin.
const BLOCKED_REQUEST_ERROR = /net::ERR_NAME_NOT_RESOLVED/;

type SeedScenario = "matrix" | "dashboard" | "storage" | "trash";
type SeedSpec = Record<string, unknown> & { title: string };
type DbStore = "tasks" | "archivedTasks" | "deletedTasks";

export interface Proof {
  /** Waits for the page to stop moving, then saves a screenshot and an ARIA snapshot. */
  capture(name: string, page?: Page): Promise<void>;
  /** Saves and returns one store's rows, read from IndexedDB. A second view of a write. */
  rows(name: string, store?: DbStore, page?: Page): Promise<Array<Record<string, unknown>>>;
  /** Saves any JSON value, such as a parsed download. */
  write(name: string, value: unknown): void;
}

type Fixtures = {
  firstVisit: boolean;
  expectedConsoleErrors: RegExp | null;
  externalRequests: string[];
  runtimeGuard: void;
  proof: Proof;
  matrix: MatrixPage;
  seed: (scenario: SeedScenario | SeedSpec[]) => Promise<void>;
};

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function logLine(file: string, entry: Record<string, unknown>): void {
  appendFileSync(path.join(EVIDENCE_DIR, file), `${JSON.stringify(entry)}\n`);
}

// View transitions ghost the previous page, and Review's numbers count up in
// JavaScript, so an early frame shows values the page never settles on. Comparing
// frames catches both, which Playwright's animations: "disabled" does not.
async function settledScreenshot(page: Page, name: string): Promise<Buffer> {
  let frame = await page.screenshot();
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const next = await page.screenshot();
    if (next.equals(frame)) return next;
    frame = next;
  }
  logLine("unsettled-captures.jsonl", { name });
  return frame;
}

function readStore(page: Page, dbName: string, store: DbStore): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(
    ({ dbName, store }) =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction(store).objectStore(store).getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
        };
      }),
    { dbName, store },
  );
}

export const test = base.extend<Fixtures>({
  firstVisit: [false, { option: true }],
  expectedConsoleErrors: [null, { option: true }],

  context: async ({ context, firstVisit }, runTest) => {
    if (!firstVisit) {
      // A fresh origin redirects to /about and opens the welcome tour. Journeys
      // that test those paths opt in with test.use({ firstVisit: true }).
      // The script also runs on about:blank, whose opaque origin throws on localStorage.
      await context.addInitScript(() => {
        if (window.location.protocol !== "http:") return;
        window.localStorage.setItem("gsd-has-launched", "true");
        window.localStorage.setItem("gsd-onboarding-seen", "true");
      });
    }
    await runTest(context);
  },

  externalRequests: async ({ context, baseURL }, runTest, testInfo) => {
    const external: string[] = [];
    const onRequest = (request: Request) => {
      const url = request.url();
      if (url.startsWith(baseURL as string) || !url.startsWith("http")) return;
      external.push(url);
      logLine("network.jsonl", { test: testInfo.title, method: request.method(), url });
    };
    context.on("request", onRequest);
    await runTest(external);
    context.off("request", onRequest);
  },

  // Every journey fails on an uncaught error or a console.error, the way CI's
  // specs do, so a green journey means the console stayed clean.
  runtimeGuard: [
    async ({ context, expectedConsoleErrors, externalRequests: _ }, runTest, testInfo) => {
      const errors: string[] = [];
      const record = (kind: string, text: string) => {
        errors.push(`${kind}: ${text}`);
        logLine("console.jsonl", { test: testInfo.title, kind, text });
      };
      const onConsole = (message: ConsoleMessage) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (BLOCKED_REQUEST_ERROR.test(text) || expectedConsoleErrors?.test(text)) return;
        record("console.error", text);
      };
      const onWebError = (error: { error(): Error }) => record("pageerror", error.error().message);
      context.on("console", onConsole);
      context.on("weberror", onWebError);
      await runTest();
      context.off("console", onConsole);
      context.off("weberror", onWebError);
      expect(errors, "unexpected browser runtime errors").toEqual([]);
    },
    { auto: true },
  ],

  proof: async ({ page }, runTest, testInfo) => {
    const dir = path.join(EVIDENCE_DIR, slug(testInfo.title));
    mkdirSync(dir, { recursive: true });
    await runTest({
      capture: async (name, target = page) => {
        writeFileSync(path.join(dir, `${name}.png`), await settledScreenshot(target, name));
        writeFileSync(path.join(dir, `${name}.aria.txt`), await target.locator("body").ariaSnapshot());
      },
      rows: async (name, store = "tasks", target = page) => {
        const rows = await readStore(target, DB_NAME, store);
        writeFileSync(path.join(dir, `${name}.${store}.json`), JSON.stringify(rows, null, 2));
        return rows;
      },
      write: (name, value) => {
        writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value, null, 2));
      },
    });
  },

  matrix: async ({ page }, runTest) => {
    const matrix = new MatrixPage(page);
    await matrix.goto();
    await runTest(matrix);
  },

  // Seeding writes rows straight to IndexedDB. It sets up a precondition, and it
  // never counts as proof that the app can write those rows.
  seed: async ({ page }, runTest) => {
    await runTest(async (scenario) => {
      await page.evaluate(SEED_SCRIPT);
      await (typeof scenario === "string"
        ? page.evaluate((name) => (window as never as Record<string, Record<string, () => Promise<string>>>).gsdSeed[name](), scenario)
        : page.evaluate((specs) => (window as never as { gsdSeed: { seed(s: unknown): Promise<string> } }).gsdSeed.seed(specs), scenario));
      await page.reload();
    });
  },
});

export { expect, MatrixPage };
