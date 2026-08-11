# Stagehand Verification Layer + Live Smoke Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tools/stagehand/` — a shared AI-browser harness with a goal-driven `verify.ts` CLI (for the verify-frontend-change workflow) and a fixed-journey `smoke.ts` runner targeting `https://gsd.vinny.dev`.

**Architecture:** One harness owns browser + Stagehand lifecycle, SW-bust/seed via `page.evaluate()` of the existing page scripts, and console/network evidence via an injected collector. Two thin CLI entries sit on top. Deterministic logic (`args.ts`, `report.ts`, `journeys.ts`) is unit-tested; browser glue is verified by acceptance runs.

**Tech Stack:** Bun (runs TS directly, auto-loads `.env.local`), `@browserbasehq/stagehand@^4` (devDep), zod 4.4.3 (root pin, `import { z } from "zod"` — the `lib/zod` jitless wrapper is a browser-CSP concern, irrelevant Node-side), vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-11-stagehand-verification-design.md`

## Global Constraints

- Model: `anthropic/claude-haiku-4-5`, key from `process.env.ANTHROPIC_API_KEY` (Bun auto-loads `.env.local`). Fail fast with a named-variable message before any browser work if unset.
- Smoke default URL: `https://gsd.vinny.dev`. Verify default URL: `http://localhost:3000`.
- Journeys never authenticate against PocketBase.
- No changes to app code (`components/`, `app/`, `lib/`) — needing one is contract drift: STOP, re-approve.
- Exit contracts: verify → 0 iff `goalMet && no console/page errors`; smoke → 1 iff any journey FAIL.
- No magic numbers (named constants), functions ≤40 lines, strict TS, no `any` without justification comment.
- Conventional commits, one per task, `Claude-Session:` trailer, no Co-Authored-By footer.
- Known app behaviors: first `/` load redirects to `/about` and sets `localStorage["gsd-has-launched"]` (components/first-time-redirect.tsx) — one warm-up navigation absorbs it. Capture shorthand: `task !!`→Q1, `task *`→Q2, `task !`→Q3, bare→Q4; tokens must be space-bounded.
- Routes: matrix `/`, dashboard `/dashboard`, settings `/settings`, about `/about`.

---

### Task 1: Dependency placement + repo plumbing

**Files:**
- Modify: `package.json` (move stagehand to devDependencies; add `"smoke"` script)
- Modify: `.gitignore` (evidence dir)
- Modify: `eslint.config.mjs` (ignores)

**Interfaces:**
- Produces: `bun run smoke` script → `bun tools/stagehand/smoke.ts`; ignored paths `tools/stagehand/evidence/**` and `tools/stagehand/page-scripts/**` (browser-context IIFEs, same category as the already-ignored `.claude/skills/**`).

- [ ] **Step 1: Move the dependency and add the script**

```bash
bun remove @browserbasehq/stagehand && bun add -d '@browserbasehq/stagehand@^4.0.0'
```

Then in `package.json` scripts add: `"smoke": "bun tools/stagehand/smoke.ts",`

- [ ] **Step 2: Ignore evidence + page-scripts**

`.gitignore`: append `tools/stagehand/evidence/`.
`eslint.config.mjs` ignores array: append `"tools/stagehand/evidence/**", "tools/stagehand/page-scripts/**",`.

- [ ] **Step 3: Verify green**

Run: `bun run test 2>&1 | tail -3 && bun lint && bun typecheck`
Expected: suite passes, lint/typecheck clean.

- [ ] **Step 4: Commit**

`chore(tooling): move stagehand to devDependencies, wire smoke script and ignores` — stage `package.json bun.lock .gitignore eslint.config.mjs` only (NOT `next-env.d.ts`).

---

### Task 2: Page scripts — move + console collector (TDD)

**Files:**
- Move: `.claude/skills/verify-frontend-change/scripts/{reset-app-state.js,seed-tasks.js}` → `tools/stagehand/page-scripts/` (git mv, byte-identical)
- Create: `tools/stagehand/page-scripts/console-collector.js`
- Modify: `.claude/skills/verify-frontend-change/SKILL.md` (path references only; rung text is Task 8)
- Test: `tests/tools/console-collector.test.ts`

**Interfaces:**
- Produces: collector IIFE — idempotent; installs `window.__gsdEvidence = { consoleErrors: string[], consoleWarnings: string[], pageErrors: string[], failedRequests: string[] }`; patches `console.error`/`console.warn`, listens to `error` + `unhandledrejection`, wraps `window.fetch` (guarded — may be absent in jsdom) recording `"<status> <url>"` for non-OK responses.

- [ ] **Step 1: git mv the two scripts, update SKILL.md paths**

```bash
mkdir -p tools/stagehand/page-scripts
git mv .claude/skills/verify-frontend-change/scripts/reset-app-state.js tools/stagehand/page-scripts/
git mv .claude/skills/verify-frontend-change/scripts/seed-tasks.js tools/stagehand/page-scripts/
rmdir .claude/skills/verify-frontend-change/scripts
```

In SKILL.md, replace both `scripts/reset-app-state.js` and `scripts/seed-tasks.js` references with `tools/stagehand/page-scripts/<name>.js`.

- [ ] **Step 2: Write the failing collector test**

`tests/tools/console-collector.test.ts` (jsdom env is vitest default here):

```ts
import { readFileSync } from "node:fs";
import path from "node:path";

const collectorSource = readFileSync(
  path.join(__dirname, "../../tools/stagehand/page-scripts/console-collector.js"),
  "utf8"
);

interface GsdEvidence {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
}
const getEvidence = (): GsdEvidence =>
  (window as unknown as { __gsdEvidence: GsdEvidence }).__gsdEvidence;

describe("console-collector", () => {
  beforeEach(() => {
    delete (window as unknown as { __gsdEvidence?: GsdEvidence }).__gsdEvidence;
    // eslint-disable-next-line no-new-func -- evaluating the browser IIFE under test
    new Function(collectorSource)();
  });

  it("records console.error and console.warn", () => {
    console.error("boom", { code: 1 });
    console.warn("careful");
    expect(getEvidence().consoleErrors).toEqual(['boom {"code":1}']);
    expect(getEvidence().consoleWarnings).toEqual(["careful"]);
  });

  it("records window error events", () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "kaboom" }));
    expect(getEvidence().pageErrors).toEqual(["kaboom"]);
  });

  it("is idempotent — double install keeps one buffer", () => {
    const first = getEvidence();
    new Function(collectorSource)();
    expect(getEvidence()).toBe(first);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `bun run test -- tests/tools/console-collector.test.ts` → FAIL (file missing / `__gsdEvidence` undefined).

- [ ] **Step 4: Write the collector**

```js
/*
 * console-collector.js — records console errors/warnings, uncaught errors,
 * and failed fetches into window.__gsdEvidence for the Stagehand harness.
 * Evaluated via page.evaluate() after every navigation (navigation wipes it).
 */
(() => {
  if (window.__gsdEvidence) return;
  const evidence = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
  window.__gsdEvidence = evidence;
  const toText = (parts) =>
    parts
      .map((part) => {
        if (typeof part === "string") return part;
        try {
          return JSON.stringify(part);
        } catch {
          return String(part);
        }
      })
      .join(" ");
  const originalError = console.error.bind(console);
  console.error = (...parts) => {
    evidence.consoleErrors.push(toText(parts));
    originalError(...parts);
  };
  const originalWarn = console.warn.bind(console);
  console.warn = (...parts) => {
    evidence.consoleWarnings.push(toText(parts));
    originalWarn(...parts);
  };
  window.addEventListener("error", (event) => {
    evidence.pageErrors.push(String(event.message));
  });
  window.addEventListener("unhandledrejection", (event) => {
    evidence.pageErrors.push(`unhandledrejection: ${String(event.reason)}`);
  });
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...fetchArgs) => {
      const response = await originalFetch(...fetchArgs);
      if (!response.ok) evidence.failedRequests.push(`${response.status} ${response.url}`);
      return response;
    };
  }
})();
```

- [ ] **Step 5: Run to verify pass** — same command → PASS. Also `bun run test 2>&1 | tail -3` (nothing else broke).

- [ ] **Step 6: Commit** — `feat(tooling): relocate page scripts to tools/stagehand, add console collector` (stage the moved files, collector, SKILL.md, test).

---

### Task 3: `args.ts` — CLI parsing (TDD) + coverage include

**Files:**
- Create: `tools/stagehand/args.ts`
- Modify: `vitest.config.ts` (coverage include)
- Test: `tests/tools/stagehand-args.test.ts`

**Interfaces:**
- Produces:
  - `type SeedScenario = "matrix" | "dashboard" | "none"`
  - `interface VerifyArgs { goal: string; seed: SeedScenario; path: string; acts: string[]; url: string; headless: boolean }`
  - `interface SmokeArgs { url: string; journey?: string; headless: boolean }`
  - `parseVerifyArgs(argv: string[]): VerifyArgs` — throws `Error` on missing `--goal`, bad `--seed`, unknown flag, flag without value. Defaults: url `http://localhost:3000`, seed `none`, path `/`, acts `[]`, headless `true`. Repeated `--act` preserves order.
  - `parseSmokeArgs(argv: string[], journeyNames: string[]): SmokeArgs` — default url `https://gsd.vinny.dev`; `--journey` must be in `journeyNames` (error lists valid names); `--headed` → headless false.

- [ ] **Step 1: Write failing tests**

```ts
import { parseSmokeArgs, parseVerifyArgs } from "@/tools/stagehand/args";

describe("parseVerifyArgs", () => {
  it("applies defaults with only --goal", () => {
    expect(parseVerifyArgs(["--goal", "badge shows"])).toEqual({
      goal: "badge shows",
      seed: "none",
      path: "/",
      acts: [],
      url: "http://localhost:3000",
      headless: true,
    });
  });
  it("preserves repeated --act order", () => {
    const args = parseVerifyArgs(["--goal", "g", "--act", "first", "--act", "second"]);
    expect(args.acts).toEqual(["first", "second"]);
  });
  it("parses seed, path, url, headed", () => {
    const args = parseVerifyArgs([
      "--goal", "g", "--seed", "dashboard", "--path", "/dashboard", "--url", "http://x", "--headed",
    ]);
    expect(args).toMatchObject({ seed: "dashboard", path: "/dashboard", url: "http://x", headless: false });
  });
  it("throws on missing --goal", () => {
    expect(() => parseVerifyArgs([])).toThrow(/--goal/);
  });
  it("throws on invalid seed", () => {
    expect(() => parseVerifyArgs(["--goal", "g", "--seed", "bogus"])).toThrow(/matrix, dashboard, or none/);
  });
  it("throws on unknown flag", () => {
    expect(() => parseVerifyArgs(["--goal", "g", "--wat"])).toThrow(/Unknown flag/);
  });
  it("throws when a flag is missing its value", () => {
    expect(() => parseVerifyArgs(["--goal"])).toThrow(/requires a value/);
  });
});

describe("parseSmokeArgs", () => {
  const names = ["first-visit-redirect", "search"];
  it("defaults to the production url", () => {
    expect(parseSmokeArgs([], names)).toEqual({ url: "https://gsd.vinny.dev", headless: true });
  });
  it("accepts a known journey and url override", () => {
    expect(parseSmokeArgs(["--journey", "search", "--url", "http://l"], names)).toEqual({
      url: "http://l",
      journey: "search",
      headless: true,
    });
  });
  it("rejects unknown journey, listing valid names", () => {
    expect(() => parseSmokeArgs(["--journey", "nope"], names)).toThrow(/first-visit-redirect, search/);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `bun run test -- tests/tools/stagehand-args.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type SeedScenario = "matrix" | "dashboard" | "none";

export interface VerifyArgs {
  goal: string;
  seed: SeedScenario;
  path: string;
  acts: string[];
  url: string;
  headless: boolean;
}

export interface SmokeArgs {
  url: string;
  journey?: string;
  headless: boolean;
}

const VERIFY_DEFAULT_URL = "http://localhost:3000";
const SMOKE_DEFAULT_URL = "https://gsd.vinny.dev";
const SEED_SCENARIOS: readonly SeedScenario[] = ["matrix", "dashboard", "none"];

function expectValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseVerifyArgs(argv: string[]): VerifyArgs {
  const args: VerifyArgs = {
    goal: "",
    seed: "none",
    path: "/",
    acts: [],
    url: VERIFY_DEFAULT_URL,
    headless: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--goal") args.goal = expectValue(argv, (i += 1), flag);
    else if (flag === "--seed") {
      const value = expectValue(argv, (i += 1), flag);
      if (!SEED_SCENARIOS.includes(value as SeedScenario)) {
        throw new Error(`--seed must be matrix, dashboard, or none (got "${value}")`);
      }
      args.seed = value as SeedScenario;
    } else if (flag === "--path") args.path = expectValue(argv, (i += 1), flag);
    else if (flag === "--act") args.acts.push(expectValue(argv, (i += 1), flag));
    else if (flag === "--url") args.url = expectValue(argv, (i += 1), flag);
    else if (flag === "--headed") args.headless = false;
    else throw new Error(`Unknown flag: ${flag}`);
  }
  if (!args.goal) throw new Error('Missing required --goal "<what to confirm>"');
  return args;
}

export function parseSmokeArgs(argv: string[], journeyNames: string[]): SmokeArgs {
  const args: SmokeArgs = { url: SMOKE_DEFAULT_URL, headless: true };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--url") args.url = expectValue(argv, (i += 1), flag);
    else if (flag === "--journey") {
      const name = expectValue(argv, (i += 1), flag);
      if (!journeyNames.includes(name)) {
        throw new Error(`Unknown journey "${name}". Valid: ${journeyNames.join(", ")}`);
      }
      args.journey = name;
    } else if (flag === "--headed") args.headless = false;
    else throw new Error(`Unknown flag: ${flag}`);
  }
  return args;
}
```

- [ ] **Step 4: Add coverage include** — in `vitest.config.ts` coverage `include`, after the `scripts/**` entries add:

```ts
        "tools/stagehand/args.ts",
        "tools/stagehand/report.ts",
        "tools/stagehand/journeys.ts",
```

(Deliberately NOT `harness.ts`/`verify.ts`/`smoke.ts` — browser glue is verified by acceptance runs.)

- [ ] **Step 5: Run to verify pass** — targeted test PASS, then `bun typecheck`.

- [ ] **Step 6: Commit** — `feat(tooling): stagehand CLI arg parsing` (args.ts, test, vitest.config.ts).

---

### Task 4: `report.ts` — verdicts, aggregation, formatting (TDD)

**Files:**
- Create: `tools/stagehand/report.ts`
- Test: `tests/tools/stagehand-report.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure module).
- Produces:
  - `interface Verdict { observed: string; goalMet: boolean; evidence: string }`
  - `interface PageEvidence { consoleErrors: string[]; consoleWarnings: string[]; pageErrors: string[]; failedRequests: string[] }`
  - `interface JourneyResult { name: string; status: "PASS" | "FAIL"; detail: string; durationMs: number; screenshot?: string }`
  - `interface VerifyReport { goal: string; verdict: Verdict; pageEvidence: PageEvidence; screenshots: string[]; evidenceDir: string; exitCode: 0 | 1 }`
  - `interface SmokeReport { url: string; results: JourneyResult[]; pageEvidence: PageEvidence; evidenceDir: string; exitCode: 0 | 1 }`
  - `verifyExitCode(verdict, pageEvidence): 0 | 1` — 0 iff `goalMet` AND no consoleErrors AND no pageErrors (warnings/failedRequests reported, not failing).
  - `buildVerifyReport(goal, verdict, pageEvidence, screenshots, evidenceDir): VerifyReport`
  - `buildSmokeReport(url, results, pageEvidence, evidenceDir): SmokeReport` — exitCode 1 iff any result FAIL.
  - `formatSmokeTable(report: SmokeReport): string` — one line per journey `PASS  name  (1.2s)  detail`, plus a summary line `N passed, M failed` and, when non-empty, `console errors: N`.

- [ ] **Step 1: Write failing tests**

```ts
import {
  buildSmokeReport,
  buildVerifyReport,
  formatSmokeTable,
  verifyExitCode,
  type JourneyResult,
  type PageEvidence,
} from "@/tools/stagehand/report";

const cleanEvidence: PageEvidence = {
  consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [],
};
const pass: JourneyResult = { name: "search", status: "PASS", detail: "found task", durationMs: 1234 };
const fail: JourneyResult = { name: "settings", status: "FAIL", detail: "no sections", durationMs: 900 };

describe("verifyExitCode", () => {
  it("returns 0 for met goal with clean console", () => {
    expect(verifyExitCode({ observed: "", goalMet: true, evidence: "" }, cleanEvidence)).toBe(0);
  });
  it("returns 1 when goal met but console has errors", () => {
    expect(
      verifyExitCode({ observed: "", goalMet: true, evidence: "" }, { ...cleanEvidence, consoleErrors: ["x"] })
    ).toBe(1);
  });
  it("returns 1 when goal unmet", () => {
    expect(verifyExitCode({ observed: "", goalMet: false, evidence: "" }, cleanEvidence)).toBe(1);
  });
  it("ignores warnings and failed requests", () => {
    expect(
      verifyExitCode(
        { observed: "", goalMet: true, evidence: "" },
        { ...cleanEvidence, consoleWarnings: ["w"], failedRequests: ["404 x"] }
      )
    ).toBe(0);
  });
});

describe("buildSmokeReport", () => {
  it("exits 0 when all pass", () => {
    expect(buildSmokeReport("u", [pass], cleanEvidence, "dir").exitCode).toBe(0);
  });
  it("exits 1 on any failure", () => {
    expect(buildSmokeReport("u", [pass, fail], cleanEvidence, "dir").exitCode).toBe(1);
  });
});

describe("formatSmokeTable", () => {
  it("renders one row per journey plus a summary", () => {
    const table = formatSmokeTable(buildSmokeReport("u", [pass, fail], cleanEvidence, "dir"));
    expect(table).toContain("PASS  search  (1.2s)  found task");
    expect(table).toContain("FAIL  settings  (0.9s)  no sections");
    expect(table).toContain("1 passed, 1 failed");
  });
  it("surfaces console error count when present", () => {
    const report = buildSmokeReport("u", [pass], { ...cleanEvidence, consoleErrors: ["a", "b"] }, "dir");
    expect(formatSmokeTable(report)).toContain("console errors: 2");
  });
});

describe("buildVerifyReport", () => {
  it("threads exit code from verdict + evidence", () => {
    const report = buildVerifyReport(
      "goal", { observed: "o", goalMet: true, evidence: "e" }, cleanEvidence, ["a.png"], "dir"
    );
    expect(report.exitCode).toBe(0);
    expect(report.screenshots).toEqual(["a.png"]);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `bun run test -- tests/tools/stagehand-report.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export interface Verdict {
  observed: string;
  goalMet: boolean;
  evidence: string;
}

export interface PageEvidence {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
}

export interface JourneyResult {
  name: string;
  status: "PASS" | "FAIL";
  detail: string;
  durationMs: number;
  screenshot?: string;
}

export interface VerifyReport {
  goal: string;
  verdict: Verdict;
  pageEvidence: PageEvidence;
  screenshots: string[];
  evidenceDir: string;
  exitCode: 0 | 1;
}

export interface SmokeReport {
  url: string;
  results: JourneyResult[];
  pageEvidence: PageEvidence;
  evidenceDir: string;
  exitCode: 0 | 1;
}

const MS_PER_SECOND = 1000;

export function verifyExitCode(verdict: Verdict, pageEvidence: PageEvidence): 0 | 1 {
  const clean = pageEvidence.consoleErrors.length === 0 && pageEvidence.pageErrors.length === 0;
  return verdict.goalMet && clean ? 0 : 1;
}

export function buildVerifyReport(
  goal: string,
  verdict: Verdict,
  pageEvidence: PageEvidence,
  screenshots: string[],
  evidenceDir: string
): VerifyReport {
  return { goal, verdict, pageEvidence, screenshots, evidenceDir, exitCode: verifyExitCode(verdict, pageEvidence) };
}

export function buildSmokeReport(
  url: string,
  results: JourneyResult[],
  pageEvidence: PageEvidence,
  evidenceDir: string
): SmokeReport {
  const exitCode: 0 | 1 = results.some((result) => result.status === "FAIL") ? 1 : 0;
  return { url, results, pageEvidence, evidenceDir, exitCode };
}

export function formatSmokeTable(report: SmokeReport): string {
  const rows = report.results.map((result) => {
    const seconds = (result.durationMs / MS_PER_SECOND).toFixed(1);
    return `${result.status}  ${result.name}  (${seconds}s)  ${result.detail}`;
  });
  const passed = report.results.filter((result) => result.status === "PASS").length;
  const failed = report.results.length - passed;
  const lines = [...rows, `${passed} passed, ${failed} failed`];
  if (report.pageEvidence.consoleErrors.length > 0) {
    lines.push(`console errors: ${report.pageEvidence.consoleErrors.length}`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify pass** — targeted test PASS, `bun typecheck` clean.

- [ ] **Step 5: Commit** — `feat(tooling): stagehand report building and exit-code contracts`.

---

### Task 5: `harness.ts` + live API probe

**Files:**
- Create: `tools/stagehand/harness.ts`
- Probe (temp, deleted after): `<scratchpad>/probe-harness.ts`

**Interfaces:**
- Consumes: `PageEvidence` from `tools/stagehand/report.ts`; page scripts from Task 2.
- Produces:
  - `interface HarnessOptions { url: string; headless?: boolean; label: string }`
  - `interface Harness { stagehand: Stagehand; evidenceDir: string; goto(routePath: string): Promise<void>; resetAppState(): Promise<void>; seed(scenario: "matrix" | "dashboard"): Promise<void>; screenshot(name: string): Promise<string>; readEvidence(): Promise<PageEvidence>; writeReport(name: string, data: unknown): string; close(): Promise<void> }`
  - `createHarness(options: HarnessOptions): Promise<Harness>` — throws before any browser work if `ANTHROPIC_API_KEY` unset: `"ANTHROPIC_API_KEY is not set. Add it to .env.local (Bun auto-loads it) or export it in your shell."`
- Model constant: `const STAGEHAND_MODEL = "anthropic/claude-haiku-4-5"`.

**Behavioral contract (implementation adapts to the probed Stagehand page API, the interface above stays fixed):**
- `goto(routePath)`: harvest current collector buffer into a Node-side accumulator → navigate to `new URL(routePath, options.url)` → brief settle wait (named constant, e.g. `NAVIGATION_SETTLE_MS = 1500`) → re-install `console-collector.js` via `page.evaluate(source)`. Track `lastPath` for reloads.
- `resetAppState()`: harvest → `page.evaluate(resetAppStateSource)` → `goto(lastPath)` (the hard-reload the skill mandates).
- `seed(scenario)`: harvest → `page.evaluate(seedTasksSource)` → `page.evaluate("gsdSeed." + scenario + "()")` (evaluate awaits the returned promise) → `goto(lastPath)` to render seeded data.
- `readEvidence()`: harvest → return merged accumulator (arrays concatenated across navigations).
- `screenshot(name)`: writes `<evidenceDir>/<name>.png`, returns absolute path.
- `writeReport(name, data)`: writes pretty JSON to `<evidenceDir>/<name>.json`, returns path.
- `close()`: `try { await stagehand.close() } finally { await browser.close() }`.
- Evidence dir: `tools/stagehand/evidence/<label>-<ISO timestamp with ':' replaced by '-'>/`, `mkdirSync recursive`.
- Page scripts read once at startup with `readFileSync(path.join(import.meta.dirname, "page-scripts", <name>))`.
- Page typing: inspect `node_modules/@browserbasehq/stagehand/dist/index.d.ts` for the exported page type; if none is usable, declare a local structural interface for exactly the methods used (`goto`, `evaluate`, `screenshot`, `url`) with a justification comment for the single cast.

- [ ] **Step 1: Inspect Stagehand's actual exports/types** — `grep -o "export [^;]*" node_modules/@browserbasehq/stagehand/dist/index.d.ts | head -40` and locate the page/context types + whether `page.goto/evaluate/screenshot/url/reload` exist.

- [ ] **Step 2: Write `harness.ts`** per the contract above (structure below; adapt method plumbing to Step 1 findings):

```ts
import { localBrowser, Stagehand } from "@browserbasehq/stagehand";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PageEvidence } from "./report";

const STAGEHAND_MODEL = "anthropic/claude-haiku-4-5";
const NAVIGATION_SETTLE_MS = 1500;
const PAGE_SCRIPTS_DIR = path.join(import.meta.dirname, "page-scripts");
const EVIDENCE_ROOT = path.join(import.meta.dirname, "evidence");

const emptyEvidence = (): PageEvidence => ({
  consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [],
});

export async function createHarness(options: HarnessOptions): Promise<Harness> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (Bun auto-loads it) or export it in your shell."
    );
  }
  const collectorSource = readFileSync(path.join(PAGE_SCRIPTS_DIR, "console-collector.js"), "utf8");
  const resetSource = readFileSync(path.join(PAGE_SCRIPTS_DIR, "reset-app-state.js"), "utf8");
  const seedSource = readFileSync(path.join(PAGE_SCRIPTS_DIR, "seed-tasks.js"), "utf8");
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
  // ...page acquisition per Step 1 findings, then the methods per the contract,
  // accumulating harvested PageEvidence arrays across navigations...
}
```

- [ ] **Step 3: Probe against the live dev server** — ensure `bun dev` is running (`curl -sf http://localhost:3000 >/dev/null || (start it)`), confirm `ANTHROPIC_API_KEY` present, then write `<scratchpad>/probe-harness.ts`:

```ts
import { createHarness } from "@/tools/stagehand/harness";
import { z } from "zod";

const harness = await createHarness({ url: "http://localhost:3000", label: "probe" });
try {
  await harness.goto("/");           // fresh profile: may redirect to /about — fine
  await harness.goto("/");           // second visit: matrix
  await harness.resetAppState();
  await harness.seed("matrix");
  const shot = await harness.screenshot("probe");
  const { data } = await harness.stagehand.extract(
    "How many task cards are visible across the four quadrants?",
    z.object({ taskCount: z.number() })
  );
  const evidence = await harness.readEvidence();
  console.log(JSON.stringify({ shot, data, evidence }, null, 2));
} finally {
  await harness.close();
}
```

Run: `bun <scratchpad>/probe-harness.ts`
Expected: screenshot file exists, `taskCount` ≥ 4 (seeded matrix has one task per quadrant), evidence object well-formed. Fix harness plumbing until this passes — this step IS the harness verification.

- [ ] **Step 4: Also probe the failure path** — `ANTHROPIC_API_KEY= bun <scratchpad>/probe-harness.ts` → expect immediate named-variable error, no browser launch.

- [ ] **Step 5: Delete the probe file, verify gates** — `rm <scratchpad>/probe-harness.ts`; `bun typecheck && bun lint`.

- [ ] **Step 6: Commit** — `feat(tooling): stagehand browser harness with evidence capture`.

---

### Task 6: `verify.ts` — goal-driven verification CLI + acceptance

**Files:**
- Create: `tools/stagehand/verify.ts`

**Interfaces:**
- Consumes: `parseVerifyArgs` (Task 3), `buildVerifyReport`/`Verdict` (Task 4), `createHarness` (Task 5).
- Produces: CLI `bun tools/stagehand/verify.ts --goal "..." [--seed matrix|dashboard|none] [--path /route] [--act "..."]... [--url ...] [--headed]`. JSON `VerifyReport` on stdout; `process.exitCode = report.exitCode`. Arg errors print message + usage to stderr, exit 2.

- [ ] **Step 1: Implement**

```ts
import { z } from "zod";
import { parseVerifyArgs } from "./args";
import { createHarness } from "./harness";
import { buildVerifyReport, type Verdict } from "./report";

const USAGE =
  'Usage: bun tools/stagehand/verify.ts --goal "<what to confirm>" ' +
  "[--seed matrix|dashboard|none] [--path /route] " +
  '[--act "<atomic instruction>"]... [--url http://localhost:3000] [--headed]';

const verdictSchema = z.object({
  observed: z.string(),
  goalMet: z.boolean(),
  evidence: z.string(),
});

async function main(): Promise<void> {
  const args = parseVerifyArgs(process.argv.slice(2));
  const harness = await createHarness({ url: args.url, headless: args.headless, label: "verify" });
  const screenshots: string[] = [];
  try {
    await harness.goto("/"); // warm-up: absorbs the first-visit /about redirect
    await harness.resetAppState();
    if (args.seed !== "none") await harness.seed(args.seed);
    await harness.goto(args.path);
    screenshots.push(await harness.screenshot("before"));
    for (const instruction of args.acts) {
      const { data: actions } = await harness.stagehand.observe(instruction);
      const action = actions[0];
      if (!action) throw new Error(`observe() found no action for: "${instruction}"`);
      await harness.stagehand.act(action);
    }
    screenshots.push(await harness.screenshot("after"));
    const { data: verdict } = await harness.stagehand.extract(
      `Goal under verification: "${args.goal}". Describe exactly what the page shows that is ` +
        "relevant to this goal (observed), state whether the goal is met (goalMet), and name " +
        "the specific visible evidence (evidence). Judge only what is visible.",
      verdictSchema
    );
    const pageEvidence = await harness.readEvidence();
    const report = buildVerifyReport(args.goal, verdict as Verdict, pageEvidence, screenshots, harness.evidenceDir);
    harness.writeReport("verify-report", report);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode;
  } finally {
    await harness.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exitCode = 2;
});
```

Note: arg errors currently reach the catch AFTER harness creation only if parsing passed — `parseVerifyArgs` throws before `createHarness`, so the catch handles both arg errors (exit 2) and runtime errors (exit 2, distinct from verdict-FAIL exit 1). That is the intended contract.

- [ ] **Step 2: Acceptance — true goal exits 0**

Dev server running, then:

```bash
bun tools/stagehand/verify.ts --goal "the matrix shows four quadrants each containing at least one task" --seed matrix
echo "exit: $?"
```

Expected: JSON report with `goalMet: true`, exit 0, `before.png`/`after.png` + `verify-report.json` in the evidence dir.

- [ ] **Step 3: Acceptance — false goal exits 1**

```bash
bun tools/stagehand/verify.ts --goal "the matrix displays a giant purple unicorn banner" --seed matrix
echo "exit: $?"
```

Expected: `goalMet: false`, exit 1.

- [ ] **Step 4: Acceptance — an --act drives the page**

```bash
bun tools/stagehand/verify.ts --goal "the settings page is open showing grouped settings sections" \
  --act "click the settings button in the app header"
echo "exit: $?"
```

Expected: exit 0.

- [ ] **Step 5: Gates + commit** — `bun typecheck && bun lint`; commit `feat(tooling): goal-driven stagehand verify CLI`.

---

### Task 7: `journeys.ts` (TDD) + `smoke.ts` + local acceptance

**Files:**
- Create: `tools/stagehand/journeys.ts`
- Create: `tools/stagehand/smoke.ts`
- Test: `tests/tools/stagehand-journeys.test.ts`

**Interfaces:**
- Consumes: `parseSmokeArgs` (Task 3), `buildSmokeReport`/`formatSmokeTable`/`JourneyResult` (Task 4), `createHarness` (Task 5).
- Produces:
  - `interface JourneyCheck { instruction: string; schema: z.ZodType; predicate: (data: unknown) => boolean; expectation: string }`
  - `interface Journey { name: string; path: string; seed?: "matrix" | "dashboard"; urlIncludes?: string; steps: string[]; check: JourneyCheck }`
  - `export const journeys: Journey[]` — six entries below, order matters (`first-visit-redirect` must be first: it both proves the redirect and sets `gsd-has-launched` for the rest).
  - CLI `bun run smoke [-- --url ...] [--journey <name>] [--headed]`.

- [ ] **Step 1: Write failing journey-validity tests**

```ts
import { journeys } from "@/tools/stagehand/journeys";

describe("journeys", () => {
  it("has six journeys with first-visit-redirect first", () => {
    expect(journeys).toHaveLength(6);
    expect(journeys[0]?.name).toBe("first-visit-redirect");
  });
  it("has unique names", () => {
    const names = journeys.map((journey) => journey.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("every journey has a path, expectation, and parseable check schema", () => {
    for (const journey of journeys) {
      expect(journey.path.startsWith("/")).toBe(true);
      expect(journey.check.instruction.length).toBeGreaterThan(0);
      expect(journey.check.expectation.length).toBeGreaterThan(0);
    }
  });
  it("predicates hold on representative data", () => {
    const byName = Object.fromEntries(journeys.map((journey) => [journey.name, journey]));
    expect(byName["first-visit-redirect"].check.predicate({ isAboutPage: true })).toBe(true);
    expect(byName["capture-to-quadrant"].check.predicate({ q1Titles: ["Smoke test task"] })).toBe(true);
    expect(byName["capture-to-quadrant"].check.predicate({ q1Titles: [] })).toBe(false);
    expect(byName["complete-task"].check.predicate({ activeTitles: ["Other"] })).toBe(true);
    expect(byName["complete-task"].check.predicate({ activeTitles: ["Complete me smoke"] })).toBe(false);
    expect(byName["search"].check.predicate({ resultTitles: ["Findable smoke task"] })).toBe(true);
    expect(byName["settings"].check.predicate({ sectionNames: ["Appearance", "Data"] })).toBe(true);
    expect(byName["settings"].check.predicate({ sectionNames: [] })).toBe(false);
    expect(byName["dashboard"].check.predicate({ showsNonZeroAnalytics: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**, then implement `journeys.ts`:

```ts
import { z } from "zod";

export interface JourneyCheck {
  instruction: string;
  schema: z.ZodType;
  predicate: (data: unknown) => boolean;
  expectation: string;
}

export interface Journey {
  name: string;
  path: string;
  seed?: "matrix" | "dashboard";
  urlIncludes?: string;
  steps: string[];
  check: JourneyCheck;
}

const parseWith = <T>(schema: z.ZodType<T>, data: unknown): T | null => {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
};

const aboutSchema = z.object({ isAboutPage: z.boolean() });
const q1Schema = z.object({ q1Titles: z.array(z.string()) });
const activeSchema = z.object({ activeTitles: z.array(z.string()) });
const searchSchema = z.object({ resultTitles: z.array(z.string()) });
const settingsSchema = z.object({ sectionNames: z.array(z.string()) });
const dashboardSchema = z.object({ showsNonZeroAnalytics: z.boolean() });

export const journeys: Journey[] = [
  {
    name: "first-visit-redirect",
    path: "/",
    urlIncludes: "/about",
    steps: [],
    check: {
      instruction:
        "Is this an About/landing page introducing the GSD task manager app (rather than the task matrix itself)?",
      schema: aboutSchema,
      predicate: (data) => parseWith(aboutSchema, data)?.isAboutPage === true,
      expectation: "fresh visit to / lands on the about page",
    },
  },
  {
    name: "capture-to-quadrant",
    path: "/",
    steps: [
      'type "Smoke test task !!" into the task capture input at the top of the matrix',
      "press Enter in the task capture input",
    ],
    check: {
      instruction:
        "List the task titles visible in the urgent-and-important quadrant (the one labeled 'Do first').",
      schema: q1Schema,
      predicate: (data) =>
        (parseWith(q1Schema, data)?.q1Titles ?? []).some((title) => title.includes("Smoke test task")),
      expectation: "captured '!!' task lands in Q1 (Do first)",
    },
  },
  {
    name: "complete-task",
    path: "/",
    steps: [
      'type "Complete me smoke !!" into the task capture input',
      "press Enter in the task capture input",
      "click the complete/done control on the task card titled 'Complete me smoke'",
    ],
    check: {
      instruction: "List the titles of active (not completed) task cards visible in the matrix.",
      schema: activeSchema,
      predicate: (data) =>
        !(parseWith(activeSchema, data)?.activeTitles ?? ["Complete me smoke"]).some((title) =>
          title.includes("Complete me smoke")
        ),
      expectation: "completing a task removes it from the active matrix",
    },
  },
  {
    name: "search",
    path: "/",
    steps: [
      'type "Findable smoke task" into the task capture input',
      "press Enter in the task capture input",
      "open the task search",
      'type "Findable" into the search input',
    ],
    check: {
      instruction: "List the task titles shown as search results.",
      schema: searchSchema,
      predicate: (data) =>
        (parseWith(searchSchema, data)?.resultTitles ?? []).some((title) =>
          title.includes("Findable smoke task")
        ),
      expectation: "search finds a just-created task by title",
    },
  },
  {
    name: "settings",
    path: "/settings",
    steps: [],
    check: {
      instruction: "List the settings section or group headings visible on this page.",
      schema: settingsSchema,
      predicate: (data) => (parseWith(settingsSchema, data)?.sectionNames ?? []).length >= 2,
      expectation: "settings page renders its grouped sections",
    },
  },
  {
    name: "dashboard",
    path: "/dashboard",
    seed: "dashboard",
    steps: [],
    check: {
      instruction:
        "Does the dashboard show analytics content with non-zero data (completed counts, charts, or streaks)?",
      schema: dashboardSchema,
      predicate: (data) => parseWith(dashboardSchema, data)?.showsNonZeroAnalytics === true,
      expectation: "seeded history renders non-empty analytics",
    },
  },
];
```

Run tests → PASS.

- [ ] **Step 3: Implement `smoke.ts`**

```ts
import { parseSmokeArgs } from "./args";
import { createHarness, type Harness } from "./harness";
import { buildSmokeReport, formatSmokeTable, type JourneyResult } from "./report";
import { journeys, type Journey } from "./journeys";

const JOURNEY_TIMEOUT_MS = 90_000;

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`journey timed out after ${ms}ms`)), ms);
  });

async function runJourney(harness: Harness, journey: Journey): Promise<JourneyResult> {
  const startedAt = Date.now();
  try {
    await Promise.race([executeJourney(harness, journey), timeout(JOURNEY_TIMEOUT_MS)]);
    return {
      name: journey.name,
      status: "PASS",
      detail: journey.check.expectation,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    const screenshot = await harness.screenshot(`fail-${journey.name}`).catch(() => undefined);
    return {
      name: journey.name,
      status: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      screenshot,
    };
  }
}

async function executeJourney(harness: Harness, journey: Journey): Promise<void> {
  if (journey.seed) await harness.seed(journey.seed);
  await harness.goto(journey.path);
  if (journey.urlIncludes && !harness.currentUrl().includes(journey.urlIncludes)) {
    throw new Error(`expected URL to include "${journey.urlIncludes}", got "${harness.currentUrl()}"`);
  }
  for (const instruction of journey.steps) {
    await harness.stagehand.act(instruction);
  }
  const { data } = await harness.stagehand.extract(journey.check.instruction, journey.check.schema);
  if (!journey.check.predicate(data)) {
    throw new Error(`check failed: ${journey.check.expectation}. Extracted: ${JSON.stringify(data)}`);
  }
}

async function main(): Promise<void> {
  const args = parseSmokeArgs(process.argv.slice(2), journeys.map((journey) => journey.name));
  const selected = args.journey ? journeys.filter((journey) => journey.name === args.journey) : journeys;
  const harness = await createHarness({ url: args.url, headless: args.headless, label: "smoke" });
  try {
    if (selected[0]?.name !== "first-visit-redirect") {
      await harness.goto("/"); // warm-up: absorb the first-visit redirect
    }
    const results: JourneyResult[] = [];
    for (const journey of selected) {
      results.push(await runJourney(harness, journey));
    }
    const report = buildSmokeReport(args.url, results, await harness.readEvidence(), harness.evidenceDir);
    harness.writeReport("smoke-report", report);
    console.log(formatSmokeTable(report));
    console.log(`report: ${harness.evidenceDir}`);
    process.exitCode = report.exitCode;
  } finally {
    await harness.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
```

Note: `Harness` needs a `currentUrl(): string` method — add it to the interface and implementation in this task (returns the page's current URL; trivial accessor over the probed API).

Design note (steps as plain `act(instruction)` here vs observe-then-act in verify): journeys are pre-vetted instructions run repeatedly — single-call `act` halves the LLM round-trips; verify handles novel ad-hoc instructions where the observe step guards against misgrounding.

- [ ] **Step 4: Local acceptance** — `bun run smoke -- --url http://localhost:3000` → all six journeys PASS, table printed, `smoke-report.json` written, exit 0. Iterate on instruction wording (not framework) if a journey misgrounds.

- [ ] **Step 5: Failure-path acceptance** — `bun run smoke -- --url http://localhost:3000 --journey dashboard` after temporarily changing the dashboard predicate to require `false`... NO — never fake. Instead: `bun tools/stagehand/smoke.ts --url http://localhost:3000 --journey settings --headed` with the dev server STOPPED for one run → journey FAILs on navigation, run completes, exit 1, `fail-settings.png` attempted. Restart dev server after.

- [ ] **Step 6: Gates + commit** — `bun run test 2>&1 | tail -3 && bun typecheck && bun lint`; commit `feat(tooling): stagehand smoke journeys and runner`.

---

### Task 8: Production smoke run + skill rung + memory

**Files:**
- Modify: `.claude/skills/verify-frontend-change/SKILL.md` (evidence rung)
- Modify: session memory `verify-skill-scripts-location.md` (post-move truth)

- [ ] **Step 1: Prod acceptance** — `bun run smoke` (defaults to `https://gsd.vinny.dev`) → expect all six PASS, exit 0. If prod legitimately fails a journey, that is a finding to report, not a test bug — verify against local before concluding.

- [ ] **Step 2: SKILL.md rung update** — in "If you don't have a live browser" ladder, extend rung 1 to: live browser driven interactively via Chrome tools **or headlessly via the Stagehand runner**: `bun tools/stagehand/verify.ts --goal "<acceptance criteria>" [--seed matrix|dashboard] [--path /route] [--act "..."]` — JSON verdict + screenshots + console/network evidence in `tools/stagehand/evidence/`; exit 0 = goal met with clean console. Also note in step 3/4 that the runner automates the SW-bust and seeding.

- [ ] **Step 3: Update memory** — rewrite `~/.claude/projects/-Users-vinnycarpenter-Projects-gsd-taskmanager/memory/verify-skill-scripts-location.md`: scripts now live in `tools/stagehand/page-scripts/`; the Stagehand runner (`verify.ts`/`smoke.ts`) is the automated path; MEMORY.md hook line updated to match.

- [ ] **Step 4: Commit** — `docs(skill): stagehand runner rung for verify-frontend-change`.

---

### Task 9: Final gates + handoff

- [ ] **Step 1: Full verification** — `bun run test -- --coverage 2>&1 | tail -20` (args/report/journeys ≥80% stmts/lines/functions), `bun typecheck`, `bun lint`.
- [ ] **Step 2: Re-read every changed file** — typos, debug code, dead imports, naming drift, stray TODOs.
- [ ] **Step 3: Version bump** — `package.json` 11.2.1 → 11.3.0 (minor: new tooling feature).
- [ ] **Step 4: Spec acceptance sweep** — walk the spec's 7 acceptance criteria, confirm each with evidence.
- [ ] **Step 5: Update `tasks/todo.md`** — "Resuming From Here" (done/next/blockers); distill any lessons.
- [ ] **Step 6: Commit** — `chore(release): bump to 11.3.0` — then produce the change report + comprehension quiz (non-trivial tier) and ask about push/PR.
