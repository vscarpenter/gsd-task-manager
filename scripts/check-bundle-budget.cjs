#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join, relative, resolve, sep } = require("node:path");
const { gzipSync } = require("node:zlib");

const OUT_DIR = resolve(__dirname, "../out");
const BUDGET_PATH = resolve(__dirname, "bundle-budget.json");
const BUDGET_LABEL = "scripts/bundle-budget.json";
const BYTES_PER_KB = 1024;
const GZIP_LEVEL = 9;
// Error pages ship in the export, but nobody lands on one first.
const SKIPPED_ROUTES = new Set(["/404", "/_not-found"]);
// Same-origin scripts only: the path starts with one slash, not a scheme or `//`.
const SCRIPT_SRC = /<script\b[^>]*\ssrc="(\/[^"/][^"]*\.js)"/g;

function findRoutePages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "_next" ? [] : findRoutePages(entryPath);
    return entry.name === "index.html" ? [entryPath] : [];
  });
}

function toRoute(outDir, pagePath) {
  const routeDir = relative(outDir, dirname(pagePath)).split(sep).join("/");
  return routeDir === "" ? "/" : `/${routeDir}`;
}

// First-load JavaScript per route: the gzip size of every script the
// prerendered page references. A lazy chunk is absent from the HTML, so moving
// code behind `import()` lowers the number and a new eager dependency raises it.
function measureFirstLoad(outDir = OUT_DIR) {
  if (!existsSync(join(outDir, "index.html"))) {
    throw new Error(`No static export at ${outDir}. Run \`bun run build\` first.`);
  }

  const gzipSizes = new Map();
  const gzipSize = (src) => {
    if (!gzipSizes.has(src)) {
      gzipSizes.set(src, gzipSync(readFileSync(join(outDir, src)), { level: GZIP_LEVEL }).length);
    }
    return gzipSizes.get(src);
  };

  const routes = [];
  for (const pagePath of findRoutePages(outDir)) {
    const route = toRoute(outDir, pagePath);
    if (SKIPPED_ROUTES.has(route)) continue;
    const html = readFileSync(pagePath, "utf8");
    const scripts = new Set([...html.matchAll(SCRIPT_SRC)].map((match) => match[1]));
    routes.push([route, [...scripts].reduce((total, src) => total + gzipSize(src), 0)]);
  }
  // Name order keeps a refreshed baseline diff limited to the bytes that moved.
  return Object.fromEntries(routes.sort(([a], [b]) => a.localeCompare(b)));
}

function compareBundleBudget(budget, current) {
  const failures = [];
  for (const [route, bytes] of Object.entries(current)) {
    const recorded = budget.routes[route];
    if (recorded === undefined) {
      failures.push(`${route} has no entry in ${BUDGET_LABEL}`);
    } else if (bytes > recorded + budget.allowanceBytes) {
      failures.push(
        `${route} loads ${bytes} bytes of first-load JavaScript, over its budget of ${recorded} plus ${budget.allowanceBytes}`
      );
    }
  }
  return failures;
}

function toBaseline(current, allowanceBytes) {
  return { allowanceBytes, routes: current };
}

function toKb(bytes) {
  return (bytes / BYTES_PER_KB).toFixed(1);
}

function summarize(budget, current) {
  return Object.entries(current)
    .map(([route, bytes]) => {
      const recorded = budget.routes[route];
      if (recorded === undefined) return `${route}: ${toKb(bytes)} KB gzip, no budget`;
      const line = `${route}: ${toKb(bytes)} KB gzip, budget ${toKb(recorded)} KB`;
      const isWellUnder = bytes < recorded - budget.allowanceBytes;
      return isWellUnder ? `${line} (well under: refresh with --write-baseline)` : line;
    })
    .join("\n");
}

function main() {
  const current = measureFirstLoad();
  const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8"));
  // The script writes the file itself. Redirecting stdout into the budget file
  // would truncate it before this run could read the allowance.
  if (process.argv.includes("--write-baseline")) {
    const baseline = toBaseline(current, budget.allowanceBytes);
    writeFileSync(BUDGET_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    process.stdout.write(`${summarize(baseline, current)}\nWrote ${BUDGET_LABEL}.\n`);
    return;
  }

  const failures = compareBundleBudget(budget, current);
  process.stdout.write(`${summarize(budget, current)}\n`);
  if (failures.length > 0) {
    process.stderr.write(`\nBundle budget failed:\n- ${failures.join("\n- ")}\n`);
    process.exitCode = 1;
  }
}

module.exports = { compareBundleBudget, measureFirstLoad, toBaseline };

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}
