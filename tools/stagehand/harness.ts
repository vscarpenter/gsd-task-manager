import { localBrowser, Stagehand, type Page, type StagehandBrowser } from "@browserbasehq/stagehand";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PageEvidence } from "./report";

const STAGEHAND_MODEL = "anthropic/claude-haiku-4-5";
const NAVIGATION_SETTLE_MS = 1500;
const PAGE_SCRIPTS_DIR = path.join(import.meta.dirname, "page-scripts");
const EVIDENCE_ROOT = path.join(import.meta.dirname, "evidence");

export interface HarnessOptions {
  url: string;
  headless?: boolean;
  label: string;
}

export interface Harness {
  stagehand: Stagehand;
  evidenceDir: string;
  goto(routePath: string): Promise<void>;
  currentUrl(): Promise<string>;
  resetAppState(): Promise<void>;
  seed(scenario: "matrix" | "dashboard"): Promise<void>;
  screenshot(name: string): Promise<string>;
  readEvidence(): Promise<PageEvidence>;
  writeReport(name: string, data: unknown): string;
  close(): Promise<void>;
}

const emptyEvidence = (): PageEvidence => ({
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
});

const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, NAVIGATION_SETTLE_MS);
  });

const readPageScript = (name: string): string =>
  readFileSync(path.join(PAGE_SCRIPTS_DIR, name), "utf8");

function mergeEvidence(target: PageEvidence, harvested: unknown): void {
  if (typeof harvested !== "object" || harvested === null) return;
  const source = harvested as Partial<PageEvidence>;
  target.consoleErrors.push(...(source.consoleErrors ?? []));
  target.consoleWarnings.push(...(source.consoleWarnings ?? []));
  target.pageErrors.push(...(source.pageErrors ?? []));
  target.failedRequests.push(...(source.failedRequests ?? []));
}

function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (Bun auto-loads it) or export it in your shell."
    );
  }
  return apiKey;
}

async function acquirePage(browser: StagehandBrowser): Promise<Page> {
  const active = await browser.context.activePage();
  if (active) return active;
  return browser.context.newPage();
}

export async function createHarness(options: HarnessOptions): Promise<Harness> {
  const apiKey = requireApiKey();
  const collectorSource = readPageScript("console-collector.js");
  const resetSource = readPageScript("reset-app-state.js");
  const seedSource = readPageScript("seed-tasks.js");
  const evidenceDir = path.join(
    EVIDENCE_ROOT,
    `${options.label}-${new Date().toISOString().replaceAll(":", "-")}`
  );
  mkdirSync(evidenceDir, { recursive: true });

  const browser = await localBrowser.launch({ headless: options.headless !== false });
  const stagehand = await Stagehand.create({
    browser,
    model: { modelName: STAGEHAND_MODEL, apiKey },
    logging: { level: "error", format: "pretty" },
  });
  const page = await acquirePage(browser);
  const accumulated = emptyEvidence();
  let lastPath = "/";

  const harvest = async (): Promise<void> => {
    const harvested = await page.evaluate("window.__gsdEvidence");
    mergeEvidence(accumulated, harvested);
  };

  const goto = async (routePath: string): Promise<void> => {
    await harvest().catch(() => undefined); // no page loaded yet on first goto
    await page.goto(new URL(routePath, options.url).toString());
    await settle();
    await page.evaluate(collectorSource);
    lastPath = routePath;
  };

  return {
    stagehand,
    evidenceDir,
    goto,
    currentUrl: () => page.url(),
    resetAppState: async () => {
      await page.evaluate(resetSource);
      await goto(lastPath);
    },
    seed: async (scenario) => {
      await page.evaluate(seedSource);
      await page.evaluate(`gsdSeed.${scenario}()`);
      await goto(lastPath);
    },
    screenshot: async (name) => {
      const filePath = path.join(evidenceDir, `${name}.png`);
      const bytes = await page.screenshot();
      writeFileSync(filePath, bytes);
      return filePath;
    },
    readEvidence: async () => {
      await harvest();
      return accumulated;
    },
    writeReport: (name, data) => {
      const filePath = path.join(evidenceDir, `${name}.json`);
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      return filePath;
    },
    close: async () => {
      try {
        await stagehand.close();
      } finally {
        await browser.close();
      }
    },
  };
}
