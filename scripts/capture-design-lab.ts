import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "@playwright/test";

const baseUrl = process.env.DESIGN_LAB_BASE_URL ?? "http://localhost:3000";
const artifactRoot = path.resolve("artifacts/design-exploration");

const directions = [
  { slug: "refined-evolution", folder: "01-refined-evolution" },
  { slug: "editorial-planner", folder: "02-editorial-planner" },
  { slug: "precision-utility", folder: "03-precision-utility" },
  { slug: "spatial-focus", folder: "04-spatial-focus" },
  { slug: "native-calm", folder: "05-native-calm" },
] as const;

const browser = await chromium.launch();
const failures: string[] = [];

try {
  const context = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Chicago",
  });
  await primeContext(context);
  const page = await context.newPage();
  observeFailures(page, failures);

  for (const direction of directions) {
    const outputDir = path.join(artifactRoot, direction.folder);
    await mkdir(outputDir, { recursive: true });
    const route = `/design-lab/${direction.slug}`;

    await capture(page, route, outputDir, "01-desktop-matrix.png", 1440, 1000);
    await capture(page, route, outputDir, "02-laptop-matrix.png", 1280, 800);
    await capture(page, route, outputDir, "03-mobile-matrix.png", 390, 844);

    await openRoute(page, route, 1440, 1000);
    await page.getByTestId("prototype-task-renewal").click();
    if (direction.slug === "native-calm") {
      await page.getByRole("button", { name: "Edit task" }).click();
    }
    await page.getByRole("dialog", { name: "Edit task" }).waitFor();
    // The Spatial Focus route has a large blurred canvas behind the dialog.
    // Give Chromium a full paint cycle after the entrance animation so the
    // artifact never captures partially rasterized form controls.
    await page.waitForTimeout(900);
    await page.screenshot({
      path: path.join(outputDir, "04-edit-dialog.png"),
      animations: "disabled",
    });

    await openRoute(page, route, 1440, 1000);
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await page.getByTestId("prototype-review").waitFor();
    await page.screenshot({ path: path.join(outputDir, "05-review.png") });

    await openRoute(page, route, 1440, 1000);
    await page.getByRole("button", { name: /Use dark theme/i }).click();
    await page.getByTestId("prototype-workspace").getAttribute("data-theme").then((theme) => {
      if (theme !== "dark") failures.push(`${direction.slug}: dark theme did not activate`);
    });
    await page.screenshot({ path: path.join(outputDir, "06-dark-matrix.png") });

    process.stdout.write(`Captured ${direction.folder}\n`);
  }

  await context.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  throw new Error(`Design-lab capture found runtime failures:\n${failures.join("\n")}`);
}

async function primeContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
    window.localStorage.setItem("gsd-has-launched", "true");
    window.localStorage.setItem("gsd-onboarding-seen", "true");
    window.localStorage.setItem("gsd-pwa-dismissed", Date.now().toString());
  });
}

function observeFailures(page: Page, failureList: string[]): void {
  page.on("pageerror", (error) => failureList.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("frame-ancestors")) {
      failureList.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      failureList.push(`${response.status()} ${response.url()}`);
    }
  });
}

async function capture(
  page: Page,
  route: string,
  outputDir: string,
  filename: string,
  width: number,
  height: number,
): Promise<void> {
  await openRoute(page, route, width, height);
  await page.screenshot({ path: path.join(outputDir, filename) });
}

async function openRoute(page: Page, route: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("prototype-workspace").waitFor();
  await page.getByTestId("prototype-workspace").waitFor({ state: "visible" });
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="prototype-workspace"]')?.getAttribute("data-ready") === "true"
  ));
  await page.evaluate(async () => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    portals.forEach((portal) => portal.setAttribute("style", "display:none!important"));
  });
}
