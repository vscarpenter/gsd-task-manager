# Spec: Cycle E — Telemetry + the standards loop

- **Date:** 2026-07-08
- **Status:** Accepted (design approved 2026-07-08; proceeding to plan + implementation per standing correction)
- **Deciders:** Vinny Carpenter
- **Related:** cycles A–D, `coding-standards.md §4` (Deviations Ledger), `tasks/lessons.md` + `tasks/implementation-notes.md` (existing standards loop), `.github/workflows/openwiki-freshness.yml` (scheduled-workflow pattern), blog "Two Gates and a Night Shift"

## Goal

Record the metrics that tell you where the pipeline drags, and connect audit findings back into the standards — the learning loop that keeps the delivery and maintenance loops honest. This is **cycle E** of five, the last.

## Scope & non-goals

**In scope:**
- `telemetry-metrics.cjs` (+ test) — the pure aggregation for cycle time, plan-revision rate, and review findings per PR.
- `telemetry.yml` — a weekly workflow that fetches from the GitHub API, computes the metrics, updates a pinned **Pipeline Telemetry** issue (the dashboard), and commits a JSON snapshot to an unprotected **`telemetry` branch**.
- `docs/ops/pipeline-audit.md` — the audit→standards bridge, reusing the existing ledger/lessons loop.

**Explicit non-goals:**
- **No new standards-loop machinery.** `coding-standards.md §4`, `tasks/lessons.md`, and the self-improvement loop already exist; E only bridges pipeline findings into them.
- **`tokensPerPR` is stubbed** (`null`) this cycle — it needs the local builder/night-shift wrappers to emit token+PR records, a small follow-up once B/D run live.
- **No commits to `main` from the workflow** — the ruleset (correctly) requires a PR; JSON snapshots go to the `telemetry` branch.
- **No dashboard app** — the essay's point is "not to admire the dashboard." The Telemetry issue is the surface.

## Background — current state

The standards loop is already in the repo: `coding-standards.md §4` is a "Deviations Ledger & Stop Conditions"; `tasks/lessons.md` holds project learnings; the "Self-Improvement Loop" distills `tasks/implementation-notes.md` → `lessons.md` / `CLAUDE.md`. Cycles A–D emit the raw signals E measures: contract issues (A), `plan:pending`/`plan:revise` (B), reviewer threads + `release-ready` (C), fix PRs + escalations (D). Nothing aggregates them. `main` is protected by a ruleset requiring PRs, so a scheduled workflow cannot push to `main`.

## Decision

A **weekly scheduled workflow** computes three GitHub-API-derivable metrics via a **pure, unit-tested helper**, publishes a human dashboard to a **pinned Telemetry issue**, and archives a JSON snapshot to a **`telemetry` branch** (git history without bypassing the gate). `tokensPerPR` is schema-present but `null`. The standards loop is **reused**, bridged by one doc.

## Design

### 1. `scripts/telemetry-metrics.cjs` (+ `tests/telemetry-metrics.test.ts`)

Pure function `computeMetrics({ prs, plans })`, no network. Inputs (normalized by the workflow):
- `prs`: `[{ number, mergedAt, issueCreatedAt, prodDeployedAt, reviewFindings }]`
- `plans`: `[{ issue, revised }]` — issues that reached `plan:pending`.

Returns:
```
{
  cycleTime:           { medianHours, p90Hours, count },   // prodDeployedAt − issueCreatedAt, ≥0 only
  planRevisionRate:    { rate, revised, total },            // revised/total (from plan:revise)
  reviewFindingsPerPR: { mean, count },                     // mean reviewer threads over merged PRs
  tokensPerPR:         null                                 // schema-ready; needs run instrumentation
}
```
Empty inputs yield `null` values with `count`/`total` 0. `percentile` uses linear interpolation between closest ranks. Rounded to 1 dp (hours) / 2 dp (rate). `.cjs` so the workflow can `require` it and Vitest can test it. TDD.

### 2. `.github/workflows/telemetry.yml`

- **Triggers:** `schedule` (weekly cron) + `workflow_dispatch`.
- **Permissions:** `contents: write` (create the `telemetry` ref + put the snapshot file), `issues: write` (update the dashboard issue), `pull-requests: read`.
- **`github-script` step:**
  1. Fetch merged PRs in a rolling window (e.g. last 30 days), each PR's linked issue (parse `Closes #<n>`), its reviewer thread count (GraphQL `reviewThreads`), and the prod-deploy time (the `deploy-prod` run / release that shipped it, best-effort).
  2. Fetch issues that reached `plan:pending` and whether `plan:revise` was ever applied (label timeline).
  3. Normalize to `{ prs, plans }`; call `computeMetrics`.
  4. **Dashboard:** find the open issue titled `Pipeline Telemetry`; update its body with a metrics table + generated-at timestamp (skip with a log if absent).
  5. **Snapshot:** ensure a `telemetry` branch exists (create from `main` head via the Git refs API if missing), then `createOrUpdateFileContents` at `docs/ops/telemetry/<date>.json` on that branch.
- **Empty-window safe:** with no data the dashboard shows "no data yet" and the snapshot records zero counts.

### 3. `docs/ops/pipeline-audit.md`

The audit→standards bridge:
- The **spot-check discipline** — ~1 in 10 merged PRs reviewed by hand, including fast-lane and night-shift merges; agents keep their autonomy only while spot-checks stay clean (the essay's "audit has teeth").
- **How telemetry feeds it** — the Telemetry issue surfaces audit candidates (high `reviewFindings` PRs, long cycle times, night-shift/auto-approved merges).
- **How a finding becomes a rule** — a confirmed audit finding or recurring reviewer category is written into `coding-standards.md` via the **existing** `tasks/implementation-notes.md` (ledger) → `tasks/lessons.md` → self-improvement loop. Each mistake paid down once.

### 4. Pipeline Telemetry issue (rollout)

A pinned issue titled `Pipeline Telemetry` created at rollout; the workflow keeps its body current.

## Verification approach

- **`telemetry-metrics.cjs`:** Vitest — empty inputs (all null, zero counts); single PR cycle time; PRs missing issue/prod timestamps excluded; negative durations excluded; median/p90 on several durations; revision-rate math; findings mean over merged only; `tokensPerPR` always null.
- **`telemetry.yml`:** YAML parses; permissions minimal; the fetch→normalize→compute→publish path reviewed. (The branch-commit + issue-update behavior is a rollout verification — it needs the workflow to run.)
- **`pipeline-audit.md`:** references the existing `tasks/lessons.md` / `coding-standards.md` ledger.

## Rollback

Additive: one helper + test, one workflow, one doc; a self-contained `telemetry` branch. Rollback = revert the PR and delete the `telemetry` branch (`git push origin --delete telemetry`). No `main` code, runtime, or deploy surface is touched.
