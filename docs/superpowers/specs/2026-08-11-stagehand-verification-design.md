# Stagehand Verification Layer + Live Smoke Tests — Design

- **Date:** 2026-08-11
- **Status:** Approved
- **Deciders:** Vinny Carpenter, Claude

## Goal

Add an AI-driven browser layer on top of `@browserbasehq/stagehand` v4 that serves two workflows:

1. **Change verification** — a goal-driven CLI the `verify-frontend-change` skill invokes to confirm a frontend change works in the running app, headlessly, with real evidence (screenshots, console/network capture, an LLM verdict).
2. **Live smoke tests** — an on-demand runner that executes fixed, AI-resilient user journeys against the production app (`https://gsd.vinny.dev`), surviving selector/copy/layout churn that breaks Playwright specs.

Both share one harness. The LLM (Anthropic Haiku 4.5) does only what it is good at — grounding actions on the live DOM and judging rendered results. Control flow stays deterministic TypeScript.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Model | `anthropic/claude-haiku-4-5`, key via `ANTHROPIC_API_KEY` in `.env.local` (Bun auto-loads it; never committed) |
| Smoke cadence | On demand (`bun run smoke`); deploy-hook/scheduled runs can layer on later |
| Smoke style | Fixed journeys executed via `act`/`extract` — no open-ended exploration loop |
| Dependency placement | `@browserbasehq/stagehand` moves to `devDependencies`, caret range (`^4.0.0`), matching the `@playwright/test` precedent |
| Zod | Root `zod@4.4.3` is byte-identical to Stagehand's bundled version; schemas import from root `zod` |

## Architecture

```
tools/stagehand/
  harness.ts           # shared core: browser + Stagehand lifecycle, app-state control, evidence
  verify.ts            # CLI entry: goal-driven verification (the verify-frontend-change rung)
  smoke.ts             # CLI entry: fixed-journey runner (default target: https://gsd.vinny.dev)
  args.ts              # deterministic: CLI parsing for both entries (unit-tested)
  report.ts            # deterministic: result aggregation + verdict→exit-code mapping (unit-tested)
  journeys.ts          # checked-in journey definitions (data, not framework; unit-tested)
  page-scripts/        # browser-side JS, evaluated via page.evaluate()
    reset-app-state.js   # MOVED from .claude/skills/verify-frontend-change/scripts/ (byte-identical)
    seed-tasks.js        # MOVED from same (byte-identical)
    console-collector.js # NEW: records console errors/warnings + failed fetches on window
  evidence/            # gitignored + eslint-ignored: screenshots + JSON reports per run
```

Everything runs as plain TypeScript via `bun tools/stagehand/<entry>.ts` — no build step.

**Ownership move:** `reset-app-state.js` and `seed-tasks.js` relocate from the skill directory to `tools/stagehand/page-scripts/`. The harness is now their primary consumer (headless `page.evaluate()`); manual console-pasting becomes the fallback path, reading the same files. Dependency direction rule: agent config (`.claude/skills/`) may reference tooling; tooling never depends on agent config.

## Component: shared harness (`harness.ts`)

`createHarness({ url, headless = true })` returns a handle owning the lifecycle:

- **Launch & create** — `localBrowser.launch()` (chrome-launcher, fresh temp profile per run → prod smoke runs start with empty IndexedDB and never touch real user data), then `Stagehand.create()` with Haiku. Fails fast with a named-variable message if `ANTHROPIC_API_KEY` is unset, before any browser work.
- **`resetAppState()`** — evaluates `reset-app-state.js`, hard-reloads. Automates the SW-bust the skill mandates. Cheap insurance on fresh profiles; load-bearing against a long-lived dev origin.
- **`seed(scenario)`** — evaluates `seed-tasks.js`, calls `gsdSeed.matrix()` / `gsdSeed.dashboard()` / a custom spec array, reloads. Inherits the Zod-bypass field map and the `updatedAt` analytics bucketing invariant for free.
- **Console & network capture** — `console-collector.js` installed early; records `console.error`/`console.warn`, window `error`, `unhandledrejection`, and non-OK `fetch` responses into a `window.__gsdEvidence` buffer read at run end. Only assumes `evaluate()` — deliberately independent of Stagehand's event API surface.
- **`screenshot(name)` / `report(data)`** — outputs land in `evidence/<run-timestamp>/`; JSON report (agent-parseable) plus printed summary (human-readable).
- **`close()`** — `stagehand.close()` then `browser.close()`, in `finally`.
- **Navigation** handles the known first-visit redirect to `/about` centrally.

## Component: `verify.ts`

```
bun tools/stagehand/verify.ts --goal "<acceptance criteria in NL>" \
  [--seed matrix|dashboard|none] [--path /dashboard] \
  [--act "instruction"]... [--url http://localhost:3000] [--headed]
```

Flow: harness up → `resetAppState()` → `seed` → navigate to `--path` → each `--act` (ordered, repeatable) via **observe-then-act** (observe first, replay the returned `Action`) → one `extract()` judging the goal against the fixed verdict schema `{ observed: string, goalMet: boolean, evidence: string }` → screenshots before/after acts → console/network buffer read.

**Output contract:** JSON verdict on stdout + evidence dir path. **Exit 0 iff `goalMet && no console errors`** — the exit code alone is a trustworthy branch signal for the calling agent; the JSON carries nuance for the skill's report template.

## Component: `smoke.ts` + `journeys.ts`

```
bun run smoke [-- --url http://localhost:3000] [--journey <name>]
```

Defaults to `https://gsd.vinny.dev`. New package.json script: `"smoke": "bun tools/stagehand/smoke.ts"`.

Each journey is a data object: `{ name, path, seed?, steps: [act instructions], check: { instruction, schema, predicate } }`. Adding coverage = adding an entry, never framework code. Journeys are **independent** (each creates its own state), run sequentially, continue-on-failure, per-journey 90s timeout via `Promise.race`.

| Journey | Proves |
|---|---|
| `first-visit-redirect` | Fresh origin lands on `/about` and it renders |
| `capture-to-quadrant` | `Smoke test !!` in the capture bar lands the task in Q1 |
| `complete-task` | Creating then completing a task removes it from the active matrix |
| `search` | `/`-search finds a just-created task by title |
| `settings` | Settings page opens with grouped sections rendered |
| `dashboard` | Seeded history renders non-empty analytics cards |

Prod safety: fresh temp profile + journeys never authenticate → all created state is client-side and dies with the profile. Cost: roughly cents per full run on Haiku.

Output: per-journey PASS/FAIL table + JSON report in `evidence/`; exit 1 if any journey failed.

## Error handling

- Missing API key / Chrome not found → fail fast before browser work, fix named in the message.
- Failed `act`/`extract` → journey marked FAIL with the verbatim error + failure-point screenshot; smoke continues, verify exits non-zero.
- Nothing swallowed — every error lands in the JSON report.
- `try/finally` guarantees `stagehand.close()` → `browser.close()` on all paths.

## Skill integration + repo plumbing

- **`verify-frontend-change/SKILL.md`**: script references updated to `tools/stagehand/page-scripts/`; evidence rung 1 becomes "live browser — driven interactively via Chrome tools, or headlessly via the Stagehand runner" with the `verify.ts` invocation inline. Manual console-pasting stays documented as fallback.
- **`.gitignore`**: add `tools/stagehand/evidence/`.
- **`eslint.config.mjs`**: ignore `tools/stagehand/evidence/`; `tools/**/*.ts` lints clean (Stop hook lints untracked files).
- **`bun typecheck`** must stay green with `tools/` included.
- Session memory note about seed-script location updated after the move.

## Testing

- **Unit (TDD, vitest):** deterministic logic only — `args.ts` (CLI parsing), `report.ts` (aggregation, verdict→exit mapping), `journeys.ts` (definition validity). Tests live in `tests/tools/` (vitest's default test glob discovers them; nothing in the exclude list blocks them). Coverage: add exactly `tools/stagehand/args.ts`, `tools/stagehand/report.ts`, `tools/stagehand/journeys.ts` to the vitest coverage `include` list — the browser glue (`harness.ts`, `verify.ts`, `smoke.ts`) stays out of coverage deliberately because it is verified by the acceptance runs, not mocked unit tests.
- **Acceptance:** one real `verify.ts` run against local dev; one real `bun run smoke` against prod. Both must produce evidence dirs and correct verdicts before ship.
- Browser-driving glue is exercised by the acceptance runs, not mocked unit tests.

## Out of scope

- Open-ended exploration mode (`--explore`), deploy-hook or scheduled smoke runs — all layer on later without rework.
- Playwright/CI integration of journeys.
- Any change to app code under `components/`, `app/`, `lib/` (except none is expected; a `data-testid` addition would be contract drift → stop and re-approve).
- PocketBase-authenticated flows in smoke journeys.

## Acceptance criteria

1. `bun tools/stagehand/verify.ts --goal ... --seed matrix` against local dev exits 0 on a true goal, non-zero on a false goal, and writes JSON verdict + screenshots to `evidence/`.
2. `bun run smoke` against `https://gsd.vinny.dev` runs all six journeys, prints a PASS/FAIL table, writes a JSON report, and exits 0 when the app is healthy.
3. A journey failure (simulated) does not abort the run and yields exit 1 + failure screenshot.
4. Missing `ANTHROPIC_API_KEY` produces an immediate, named-variable error — no browser launched.
5. `bun run test`, `bun typecheck`, `bun lint` all green; `args.ts`, `report.ts`, and `journeys.ts` reach ≥80% statements/lines/functions under `bun run test -- --coverage`.
6. `verify-frontend-change` SKILL.md references the new script paths and the Stagehand rung; manual paste path still works from the new location.
7. Stagehand sits in `devDependencies`; `tools/stagehand/evidence/` is git- and eslint-ignored.

## Test stubs

- `parseVerifyArgs`: goal required; defaults (url, seed=none, headless); repeatable `--act` preserves order; unknown flag → error.
- `parseSmokeArgs`: default url is prod; `--journey` filters to a known name, unknown name → error listing valid names.
- `journeys`: every entry has non-empty name/path/steps/check; names unique.
- `aggregateReport`: mixed PASS/FAIL → exit 1 and correct table rows; all PASS → exit 0.
- `verdictToExit`: goalMet+clean console → 0; goalMet+console error → 1; !goalMet → 1.
