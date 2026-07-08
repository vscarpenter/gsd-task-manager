# Spec: Tokens-per-PR instrumentation (cycle E follow-up)

- **Date:** 2026-07-08
- **Status:** Accepted (design approved 2026-07-08; extends cycle E / PR #429)
- **Deciders:** Vinny Carpenter
- **Related:** `2026-07-08-telemetry-design.md` (cycle E), `scripts/builder-run.sh` + `.claude/commands/build-next.md` (cycle B), `.github/workflows/telemetry.yml`

## Goal

Fill in the `tokensPerPR` metric that cycle E stubbed: record the token cost of the builder's run against the PR it opens, so the weekly telemetry can report tokens per merged PR.

## Scope & non-goals

- **In scope:** builder-only token capture (builder opens exactly one PR/run → clean attribution). Produce a token marker on the PR; telemetry sums markers; `computeMetrics` reports the mean.
- **Non-goals:** night-shift token tracking (≤3 PRs/run — ambiguous split; its files aren't on this branch) — a follow-up after cycle D merges. Reviewer token tracking (separate concern).

## Decision

The token data crosses a local→cloud boundary via a **machine-readable marker comment on the PR** (where the cloud workflow already has access). The local run reports which PR it opened; the wrapper posts the marker.

## Design

### 1. `scripts/extract-run-tokens.cjs` (+ test)

Pure, dual-mode. `extractRunTokens(json)` takes a `claude -p --output-format json` object (or JSON string) → `{ tokens, pr }`:
- `tokens` = sum of all `*_tokens` fields present in `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) — robust to which exist.
- `pr` = the number in `OPENED_PR=<n>` parsed from `result`, or `null`.
CLI (`require.main`): read the JSON from stdin, print `"<tokens> <pr|none>"`. TDD.

### 2. `.claude/commands/build-next.md`

Add a required final line to the builder's output: `OPENED_PR=<number>` when it opened a PR this run, else `OPENED_PR=none`.

### 3. `scripts/builder-run.sh`

Invoke `claude -p "/build-next" --output-format json` (stdout=JSON to the run log, stderr to `<log>.err`). After the run, pipe the JSON through `extract-run-tokens.cjs`; if a PR and non-zero tokens, `gh pr comment <pr> --body "<!-- gsd-tokens tokens=<n> -->"`. Best-effort — a failure here never fails the run.

### 4. `.github/workflows/telemetry.yml`

Per merged PR, read its comments for `<!-- gsd-tokens tokens=<n> -->` markers and sum them into `pr.tokens` (`null` if none). Errors logged, not swallowed. Update the dashboard row from "pending" to the computed mean.

### 5. `scripts/telemetry-metrics.cjs`

`tokensPerPR` becomes `{ mean, count }` over merged PRs that have a numeric `tokens` (`mean: null, count: 0` when none). Update its tests (the empty-input case changes shape).

## Verification

- `extract-run-tokens.cjs`: Vitest — full usage summed, missing usage → 0, `OPENED_PR` parsed / absent / `=none`, string vs object input, malformed → `{0, null}`.
- `telemetry-metrics.cjs`: updated tests — empty → `{mean:null,count:0}`; tokens averaged over PRs that have them; PRs without tokens excluded from the mean.
- `builder-run.sh`: `bash -n`. `build-next.md`: the `OPENED_PR=` instruction present. `telemetry.yml`: parses; marker regex correct.

## Rollback

Additive/edits confined to two scripts, one command, one workflow. Rollback = revert. Marker comments are inert HTML comments; the metric returns to `null` if the producer half is removed.
