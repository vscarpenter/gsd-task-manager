# Cycle E — Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly workflow that computes three pipeline metrics via a pure tested helper, publishes a Pipeline Telemetry issue dashboard, and archives JSON snapshots to a `telemetry` branch — plus a doc bridging audit findings into the existing standards loop.

**Architecture:** `telemetry-metrics.cjs` is pure and unit-tested. `telemetry.yml` (weekly) fetches from the GitHub API, normalizes, calls the helper, updates the dashboard issue, and commits a snapshot to the `telemetry` branch via the Contents API (no `main` writes — the ruleset forbids them).

**Tech Stack:** GitHub Actions (`actions/github-script@v7`, `schedule`), Node CommonJS (`.cjs`), Vitest.

## Global Constraints

- Additive; no `main` code touched by the workflow (snapshots go to the `telemetry` branch).
- `tokensPerPR` is `null` this cycle (needs run instrumentation — a B/D follow-up).
- Metrics are approximate v1 (prod-deploy time ≈ merge time until deploy↔PR correlation is added); documented as such.
- Node helpers `.cjs`; tests `.test.ts` under `tests/`. Commits: Conventional + `Vinny Carpenter <vscarpenter@gmail.com>` + `Claude-Session` trailer, no Co-Authored-By. Repo slug `vscarpenter/gsd-task-manager`.

---

### Task 1: `telemetry-metrics` helper (TDD)

**Files:**
- Create: `scripts/telemetry-metrics.cjs`
- Test: `tests/telemetry-metrics.test.ts`

**Interfaces:**
- `computeMetrics({ prs, plans }): { cycleTime, planRevisionRate, reviewFindingsPerPR, tokensPerPR }`; `percentile(sorted, p)`. Consumed by Task 2.

- [ ] **Step 1: Write the failing test** — `tests/telemetry-metrics.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeMetrics, percentile } from "../scripts/telemetry-metrics.cjs";

const day = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString();

describe("percentile", () => {
  it("interpolates between ranks", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
  });
  it("returns null for empty", () => expect(percentile([], 50)).toBeNull());
});

describe("computeMetrics", () => {
  it("returns nulls/zeros for empty input", () => {
    const m = computeMetrics({});
    expect(m.cycleTime).toEqual({ medianHours: null, p90Hours: null, count: 0 });
    expect(m.planRevisionRate).toEqual({ rate: null, revised: 0, total: 0 });
    expect(m.reviewFindingsPerPR).toEqual({ mean: null, count: 0 });
    expect(m.tokensPerPR).toBeNull();
  });

  it("computes cycle time in hours from issueCreatedAt to prodDeployedAt", () => {
    const m = computeMetrics({
      prs: [{ number: 1, mergedAt: day(2), issueCreatedAt: day(1), prodDeployedAt: day(2), reviewFindings: 2 }],
    });
    expect(m.cycleTime).toEqual({ medianHours: 24, p90Hours: 24, count: 1 });
    expect(m.reviewFindingsPerPR).toEqual({ mean: 2, count: 1 });
  });

  it("excludes PRs missing issue or prod timestamps from cycle time", () => {
    const m = computeMetrics({
      prs: [{ number: 1, mergedAt: day(2), issueCreatedAt: null, prodDeployedAt: day(2), reviewFindings: 0 }],
    });
    expect(m.cycleTime.count).toBe(0);
  });

  it("excludes negative durations", () => {
    const m = computeMetrics({
      prs: [{ number: 1, mergedAt: day(1), issueCreatedAt: day(3), prodDeployedAt: day(2), reviewFindings: 0 }],
    });
    expect(m.cycleTime.count).toBe(0);
  });

  it("takes the median of multiple durations", () => {
    const m = computeMetrics({
      prs: [
        { number: 1, mergedAt: day(2), issueCreatedAt: day(1), prodDeployedAt: day(2), reviewFindings: 0 },
        { number: 2, mergedAt: day(3), issueCreatedAt: day(1), prodDeployedAt: day(3), reviewFindings: 0 },
        { number: 3, mergedAt: day(4), issueCreatedAt: day(1), prodDeployedAt: day(4), reviewFindings: 0 },
      ],
    });
    expect(m.cycleTime.medianHours).toBe(48); // 24h, 48h, 72h -> median 48h
  });

  it("computes plan revision rate", () => {
    const m = computeMetrics({ plans: [{ revised: true }, { revised: false }, { revised: false }] });
    expect(m.planRevisionRate).toEqual({ rate: 0.33, revised: 1, total: 3 });
  });

  it("averages review findings over merged PRs only", () => {
    const m = computeMetrics({
      prs: [
        { number: 1, mergedAt: day(2), reviewFindings: 4 },
        { number: 2, mergedAt: null, reviewFindings: 100 },
      ],
    });
    expect(m.reviewFindingsPerPR).toEqual({ mean: 4, count: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `bun run test -- tests/telemetry-metrics.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write implementation** — `scripts/telemetry-metrics.cjs`

```js
"use strict";

const HOUR_MS = 3600000;

function toMs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function round(x, dp) {
  if (x == null) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// Pure pipeline metrics. Inputs are normalized by the telemetry workflow:
//   prs:   [{ number, mergedAt, issueCreatedAt, prodDeployedAt, reviewFindings }]
//   plans: [{ issue, revised }]  (issues that reached plan:pending)
function computeMetrics(input) {
  const prs = Array.isArray(input && input.prs) ? input.prs : [];
  const plans = Array.isArray(input && input.plans) ? input.plans : [];

  const durations = prs
    .map((pr) => {
      const start = toMs(pr && pr.issueCreatedAt);
      const end = toMs(pr && pr.prodDeployedAt);
      return start != null && end != null ? (end - start) / HOUR_MS : null;
    })
    .filter((h) => h != null && h >= 0)
    .sort((a, b) => a - b);

  const total = plans.length;
  const revised = plans.filter((p) => p && p.revised).length;

  const merged = prs.filter((pr) => pr && pr.mergedAt);
  const findingsSum = merged.reduce((s, pr) => s + (Number(pr.reviewFindings) || 0), 0);

  return {
    cycleTime: {
      medianHours: round(percentile(durations, 50), 1),
      p90Hours: round(percentile(durations, 90), 1),
      count: durations.length,
    },
    planRevisionRate: {
      rate: total ? round(revised / total, 2) : null,
      revised,
      total,
    },
    reviewFindingsPerPR: {
      mean: merged.length ? round(findingsSum / merged.length, 1) : null,
      count: merged.length,
    },
    tokensPerPR: null,
  };
}

module.exports = { computeMetrics, percentile };
```

- [ ] **Step 4: Run test to verify it passes** — `bun run test -- tests/telemetry-metrics.test.ts` → PASS.

- [ ] **Step 5: Commit** `feat(pipeline): telemetry-metrics pure aggregation helper`

---

### Task 2: `telemetry.yml` weekly collector

**Files:** Create `.github/workflows/telemetry.yml`

**Interfaces:** Consumes `computeMetrics` (Task 1).

- [ ] **Step 1: Write the workflow** — weekly `schedule` + `workflow_dispatch`; `contents: write` + `issues: write` + `pull-requests: read`. A single `github-script` step that: (1) lists merged PRs in a 30-day window; (2) per PR resolves the linked issue's `created_at` (parse `Closes/Fixes/Resolves #n`) and the reviewer thread count (GraphQL `reviewThreads.totalCount`), using `mergedAt` as the cycle-time end (prod-deploy correlation is a follow-up); (3) lists `plan:pending` issues in-window and checks their timeline for a `plan:revise` label event; (4) calls `computeMetrics`; (5) finds the open issue titled `Pipeline Telemetry` and updates its body with a metrics table; (6) ensures a `telemetry` branch (create from `main` head via the refs API if absent) and `createOrUpdateFileContents` at `docs/ops/telemetry/<date>.json`. Empty-window safe. Full github-script written at implementation.

- [ ] **Step 2: Validate** — `node`-based YAML parse of `telemetry.yml`; confirm `permissions` = `{contents: write, issues: write, pull-requests: read}` and the parser require path matches Task 1's file.

- [ ] **Step 3: Commit** `feat(pipeline): weekly telemetry collector workflow`

---

### Task 3: `docs/ops/pipeline-audit.md` — audit→standards bridge

**Files:** Create `docs/ops/pipeline-audit.md`

- [ ] **Step 1: Write the doc** — sections: the ~1-in-10 spot-check discipline (incl. fast-lane + night-shift merges; autonomy retained only while spot-checks stay clean); how the Telemetry issue surfaces audit candidates (high findings, long cycle time, auto-approved/night-shift merges); and how a confirmed finding becomes a `coding-standards.md` rule via the **existing** `tasks/implementation-notes.md` ledger → `tasks/lessons.md` → self-improvement loop (reuse, not new machinery).

- [ ] **Step 2: Cross-reference check** — `grep -q "tasks/lessons.md" docs/ops/pipeline-audit.md && grep -q "coding-standards.md" docs/ops/pipeline-audit.md && grep -q "Pipeline Telemetry" docs/ops/pipeline-audit.md && echo OK`.

- [ ] **Step 3: Commit** `docs(pipeline): audit->standards bridge (spot-checks + telemetry -> standards)`

---

## Full-suite verification (after all tasks)

- [ ] `bun run test -- tests/telemetry-metrics.test.ts` — helper green.
- [ ] `bun run lint` — no new errors.
- [ ] `telemetry.yml` parses; permissions minimal; parser require path correct.
- [ ] Cross-refs in `pipeline-audit.md` resolve.

## Rollout (outside git — requires confirmation)

1. Push, open PR, merge (CI required; `release-ready.yml` runs on it).
2. Create the pinned **Pipeline Telemetry** issue.
3. `workflow_dispatch` the telemetry workflow once → confirm it updates the issue and creates the `telemetry` branch with a snapshot (data will be sparse until A–D run live).

## Self-review (plan vs. spec)

- Spec §1 helper → Task 1 (TDD). §2 workflow → Task 2. §3 bridge → Task 3. §4 issue → rollout. Verification → Task 1 test + full-suite. **All spec sections covered.**
- No placeholders in tested code (Task 1 full). `computeMetrics`/`percentile` names identical across Task 1 (def) and Task 2 (consumer). `telemetry` branch + `docs/ops/telemetry/<date>.json` path consistent between spec and Task 2.
