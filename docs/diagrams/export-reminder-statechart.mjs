// Export reminder-statechart.html to PNG: each figure at its viewBox width x 2, plus a full-page poster.
//
//     node docs/diagrams/export-reminder-statechart.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "reminder-statechart.html");
const base = src.replace(/\.html$/, "");
const FIGURE_WIDTH = 1280;
const POSTER_WIDTH = 1328;
const SCALE = 2;

async function launch() {
  try {
    return await chromium.launch();
  } catch (error) {
    // The cache can lack the Chromium build this Playwright wants; installed Chrome renders the same page.
    console.error(`bundled chromium failed (${error.message.split("\n")[0]}), trying channel chrome`);
    return chromium.launch({ channel: "chrome" });
  }
}

async function open(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: SCALE });
  await page.goto(`file://${src}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  return page;
}

const browser = await launch();

// Figure exports: drop the page's max width so each svg renders at its viewBox width.
const figures = await open(browser, 1600);
await figures.addStyleTag({
  content: `.container{max-width:none!important}.frame{overflow:visible!important;border:0!important;width:max-content}.frame svg{width:${FIGURE_WIDTH}px!important}`,
});
for (const [index, name] of [[0, "before"], [1, "after"]]) {
  const out = `${base}-${name}.png`;
  await figures.locator("svg").nth(index).screenshot({ path: out, omitBackground: true });
  console.log(`wrote ${out}`);
}

const poster = await open(browser, POSTER_WIDTH);
await poster.screenshot({ path: `${base}.png`, fullPage: true });
console.log(`wrote ${base}.png`);

await browser.close();
