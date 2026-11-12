# tools/stagehand/eval

## Overview

This directory holds an evaluation runner for the Stagehand judge. `run-eval.mjs` runs `verify.ts` once per case and compares the judge's verdict with the expected one. `summarize.mjs` turns the result rows into a short report. `cases.json` holds the cases.

## Interface

- `run-eval.mjs` command line: `node run-eval.mjs --flow DIR --variant ID [--model ID] [--reps N] [--concurrency N] [--timeout-s N] [--approve-harness]`.
  - Defaults from `parseArgs`: `--flow .claude/hillclimb/flow`, `--variant baseline`, `--reps 1`, `--concurrency 3`, `--timeout-s 240` (0 means no ceiling). `--model` defaults to `DEFAULT_MODEL` (`claude-haiku-4-5`). `-h` or `--help` prints usage and exits 0.
  - Environment: `JUDGE_EVAL_URL` (default `http://127.0.0.1:3100`) and `JUDGE_EVAL_ONLY` (comma-separated case ids). It sets `STAGEHAND_MODEL` for the child process.
  - Exit codes: 0 when no attempt throws, 1 when an attempt throws, 2 on a bad argument or a refused gate. It also exits 2 on an unparsable `_state.json`, a duplicate case id after sanitization, or a split id in `_state.json` that is not path-safe. A wrong judge verdict (`correct: 0`) counts as ok and does not change the exit code.
  - The header comment says to start `node scripts/lib/static-export-server.cjs` first.
- `run-eval.mjs` exports:
  - `PROTECTED_HARNESS_PATHS`: the harness files the integrity hash always covers.
  - `harnessPathsFor(listed)`: the sorted union of the protected paths and `listed`.
  - `checkManifest(stored, current, hasRows)`: returns `{ action: 'write' | 'ok' | 'refuse', reason? }`.
- `summarize.mjs` exports `summarize(vdir, cases)`. It returns seven lines: accuracy with a Wilson 95% interval, recall, specificity, precision, results by surface, errors by class, and cost. It has no command line.
- `summarize.mjs:PRICES` holds the per-model token prices the cost line uses.
- `cases.json` is an array of case objects. Each has `id`, `tags`, `seed`, `path`, `acts`, `expected`, `goal`, and `why`.

## Invariants

- `run-eval.mjs:parseArgs` requires `--variant` to match `baseline` or `v<number>`. `--reps` and `--concurrency` must be integers of 1 or more.
- `run-eval.mjs:checkHarness` hashes the runner and every harness path. The hash must equal `harness_sha` in `<flow>/_state.json`, or the run exits 2. `--approve-harness` is the only bypass.
- `run-eval.mjs:checkManifest` binds a variant folder to one model and one `cases.json` hash. A mismatch refuses the run.
- `run-eval.mjs:loadCases` throws when a `JUDGE_EVAL_ONLY` id is not in `cases.json`.
- `run-eval.mjs:withTimeout` applies the `--timeout-s` ceiling to each case.
- `run-eval.mjs:withBackoff` retries transient errors only, up to five tries, and never past the deadline.
- `run-eval.mjs:worker` writes a failed attempt to `errors.jsonl`, never to `results.jsonl`. A resumed run skips pairs of case and rep that already have a row.
- `run-eval.mjs:gradeCase` scores a case as correct only when `goalMet` equals the case's `expected` value. It throws when `goalMet` is not a boolean.
- `run-eval.mjs:runCase` fails an attempt when the verify report has no token usage.
- `run-eval.mjs:worker` fails an attempt with `failure_class: 'serving_substitution'` when the served model differs from `--model`. A dated snapshot suffix on the same base id passes.

## Side Effects

- `run-eval.mjs:runVerify` spawns `bun tools/stagehand/verify.ts ...`, up to `--concurrency` at once. Each child launches a browser and calls the model API. See [tools/stagehand](../README.md).
- `run-eval.mjs:main` writes under `<flow>/<variant>/`: `manifest.json`, `results.jsonl`, `errors.jsonl`, `traces/<id>_rep<n>.json`, and `progress.txt`.
- `run-eval.mjs:main` writes `<flow>/baseline/ref/<id>` once when the variant is `baseline`.
- `run-eval.mjs:keepScreenshots` copies screenshots to `<flow>/<variant>/out/`.
- `run-eval.mjs:checkHarness` rewrites `<flow>/_state.json` only with `--approve-harness` and a changed hash.
- `run-eval.mjs:main` calls `process.exit`.
- `run-eval.mjs:main` reads `train_ids`, `val_ids`, `test_ids`, and `harness_paths` from `<flow>/_state.json`. For a non-baseline variant it reads `<flow>/baseline/ref/<id>`.
- `summarize.mjs:summarize` reads `results.jsonl` and `errors.jsonl`. It writes nothing.
- `cases.json`: None.

## Verification

- Run: `bun run test` (Vitest; `tests/tools/stagehand-judge-runner.test.ts` covers this directory)
