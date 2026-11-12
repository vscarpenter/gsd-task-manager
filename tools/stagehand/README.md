# tools/stagehand

## Overview

This directory holds the Stagehand browser verification tools. `verify.ts` drives the app toward one goal and asks a model whether the page meets it. `smoke.ts` runs a fixed list of journeys. Both write evidence to `tools/stagehand/evidence/`, which git ignores.

The directory has no `package.json`. The repo root `package.json` declares its dependencies (`@browserbasehq/stagehand`, `zod`) and the `smoke` script.

## Interface

- `verify.ts` command line: `bun tools/stagehand/verify.ts --goal "<what to confirm>" [--seed matrix|dashboard|storage|trash|none] [--path /route] [--act "<instruction>"]... [--url URL] [--headed]`.
  - It prints a `VerifyReport` as JSON.
  - Exit codes: 0 when the goal is met with no blocking page evidence, 1 otherwise, 2 on a thrown error.
- `smoke.ts` command line: `bun tools/stagehand/smoke.ts [--url URL] [--journey NAME] [--headed]`, also `bun run smoke`.
  - It prints a result table and the evidence folder.
  - Exit codes: 0 when every journey passes with no blocking evidence, 1 otherwise, 2 on a thrown error.
- Both commands read `ANTHROPIC_API_KEY` (required) and `STAGEHAND_MODEL` (optional).
- `args.ts` exports `SeedScenario`, `VerifyArgs`, `SmokeArgs`, `parseVerifyArgs(argv)`, `parseSmokeArgs(argv, journeyNames)`, and `resolveStagehandModel(env)`.
  - `parseVerifyArgs` defaults: seed `none`, path `/`, url `http://localhost:3000`, headless.
  - `parseSmokeArgs` defaults: the production site URL, headless.
- `harness.ts` exports `HarnessOptions`, `Harness`, and `createHarness(options)`. A `Harness` has `goto`, `currentUrl`, `resetAppState`, `seed`, `screenshot`, `readEvidence`, `writeReport`, and `close`.
- `journeys.ts` exports `JourneyCheck`, `Journey`, and `journeys`. The list has six journeys: `first-visit-redirect`, `capture-to-quadrant`, `complete-task`, `search`, `settings`, and `dashboard`.
- `report.ts` exports the types `Verdict`, `LlmUsage`, `PageEvidence`, `JourneyResult`, `VerifyReport`, and `SmokeReport`. It also exports `hasBlockingPageEvidence`, `verifyExitCode`, `buildVerifyReport`, `buildSmokeReport`, and `formatSmokeTable`.
- `timeout.ts` exports `withTimeout(operation, ms)`.
- Subdirectories:
  - [eval](./eval/README.md): evaluation runner for the judge.
  - [page-scripts](./page-scripts/README.md): scripts the harness evaluates in the page.

## Invariants

- `args.ts:parseVerifyArgs` requires `--goal`. `--seed` must be one of `SEED_SCENARIOS`. Unknown flags throw.
- `args.ts:parseSmokeArgs` requires `--journey` to be a known journey name.
- `args.ts:resolveStagehandModel` requires `STAGEHAND_MODEL` to start with `anthropic/`.
- `harness.ts:requireApiKey` throws when `ANTHROPIC_API_KEY` is unset.
- `harness.ts:createHarness` adds an init script that sets `localStorage` key `gsd-onboarding-seen` on every document.
- `harness.ts:goto` waits `NAVIGATION_SETTLE_MS` after each navigation, then injects `console-collector.js`.
- `verify.ts:main` runs in a fixed order: warm-up load of `/`, reset, seed, load the path, screenshot, each `--act`, screenshot, extract.
- `verify.ts` throws when `observe()` finds no action for an `--act` instruction.
- `smoke.ts:JOURNEY_TIMEOUT_MS` limits each journey to 90 seconds through `withTimeout`.
- `smoke.ts:executeJourney` throws when an `act()` step does not report success.
- `report.ts:hasBlockingPageEvidence` treats any console error, page error, or failed request as blocking. Console warnings never block.
- `journeys.ts` predicates fail closed when the schema parse fails.

## Side Effects

- `harness.ts:createHarness` creates `tools/stagehand/evidence/<label>-<timestamp>/` and launches a local browser.
- `harness.ts:createHarness` creates a Stagehand instance. Its `act`, `observe`, and `extract` calls go to the model API with `ANTHROPIC_API_KEY`.
- `harness.ts:goto` loads pages from the `--url` target. For `smoke.ts` the default target is the production site.
- `harness.ts:resetAppState` evaluates `reset-app-state.js` in the page, which unregisters service workers and deletes caches.
- `harness.ts:seed` evaluates `seed-tasks.js`, which writes to the IndexedDB database `GsdTaskManager`.
- `harness.ts:screenshot` writes `<evidenceDir>/<name>.png`. `harness.ts:writeReport` writes `verify-report.json` or `smoke-report.json` there.
- `smoke.ts` journeys create and complete tasks in the target app's browser storage through `act()`.
- `verify.ts` and `smoke.ts` set `process.exitCode`.
- `args.ts`, `report.ts`, `timeout.ts`, `journeys.ts`: None.

## Verification

- Run: `bun run test` (Vitest; suites under `tests/tools/` cover `args.ts`, `report.ts`, `journeys.ts`, and the smoke timeout)
- No automated check found for `harness.ts`, `verify.ts`, and `smoke.ts`. `vitest.config.ts` says acceptance runs verify them.
