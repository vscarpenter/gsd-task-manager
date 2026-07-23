# Autonomous delivery pipeline

This repo runs an **autonomous, AI-agent delivery pipeline**: a filed issue becomes a
reviewed PR and eventually a gated production release, with humans intervening at exactly two
approval points. The pipeline is built from small, single-purpose pieces (GitHub issue
templates, workflows, scheduled local Claude Code routines, and helper scripts) glued
together by **GitHub labels acting as durable state**.

The durable operating specs live under `/docs/agents/` and `/docs/ops/`; this page is the
navigable overview. Design docs (specs + plans) are under `/docs/superpowers/`.

---

## The cycles (A–E)

The pipeline was built in ordered cycles; each name below matches the labels and docs.

| Cycle | Name | What it adds | Key sources |
| --- | --- | --- | --- |
| A | **The Contract** | Enforced issue template + `risk:*` labels | `/.github/ISSUE_TEMPLATE/`, `/.github/workflows/apply-risk-label.yml`, `/scripts/parse-risk-tier.cjs` |
| B | **Builder + Gate 1** | Local autonomous builder; plan-approval gate | `/docs/agents/builder.md`, `/.claude/commands/build-next.md`, `/scripts/builder-run.sh` |
| C | **Review + Gate 2** | Required CI/review; production release-approval gate | `/docs/ops/gate2.md`, `/.github/workflows/deploy-prod.yml`, `/scripts/prev-release-tag.cjs` |
| D | **The Night Shift** | Nightly unattended triage of failing agent PRs | `/docs/agents/night-shift.md`, `/.claude/commands/triage-prs.md`, `/scripts/triage-run.sh`, `/scripts/failing-agent-prs.cjs` |
| E | **Standards loop** | Manual spot-checks feed a learning loop | `/docs/ops/pipeline-audit.md`, `/coding-standards.md` |

End-to-end flow:

```
Issue (Contract, risk:*) → ready-for-agent
  → Builder: plan (Gate 1) → build → PR on claude/issue-<n>-*
  → required CI + human review → human merges
  → running-app validation → /release → deploy-prod.yml (Gate 2) → PROD
Night Shift (nightly): fixes failing checks on claude/* PRs, never merges
Audit (manual): spot-checks → coding-standards.md
```

---

## Labels are the state machine

Runs are **non-blocking**: each scheduled wake-up does at most one unit of work and exits, so
a closed laptop never orphans anything. Labels carry state between runs. `/scripts/setup-labels.sh`
provisions them idempotently (`gh label create --force`):

- **`risk:*`** (`docs`, `chore`, `feature`, `risky`) — the contract's blast-radius tier; drives
  plan depth and whether Gate 1 applies.
- **`plan:pending` / `plan:revise` / `plan:approved`** — Gate 1 handshake.
- **`agent:building`** — builder claim-lock (removed when the PR opens).
- **`ready-for-agent` / `ready-for-human`** — AFK-ready vs. escalated.
- **`builder:paused` / `triage:paused`** — kill switches.

Label vocabulary and `gh` conventions the agents follow: `/docs/agents/triage-labels.md`,
`/docs/agents/issue-tracker.md`, indexed by `/docs/agents/README.md`.

---

## Cycle A — The Contract

Every change starts from a structured issue. The `change_request.yml` form
(`/.github/ISSUE_TEMPLATE/change_request.yml`) requires Summary, Acceptance criteria,
Constraints, Out of scope, Rollback, and a **Risk tier** dropdown. On issue open/edit,
`apply-risk-label.yml` parses the dropdown via `parse-risk-tier.cjs` and applies exactly one
`risk:*` label. That workflow holds no secrets and executes no issue-supplied content, so it
runs safely for any author.

---

## Cycle B — Builder + Gate 1

The **builder** is a local, scheduled Claude Code routine that turns a fully-specified issue
into a reviewed PR and **never merges**. Spec: `/docs/agents/builder.md`; executable summary:
`/.claude/commands/build-next.md`; launcher: `/scripts/builder-run.sh` (with
`/scripts/launchd/dev.vinny.gsd-builder.plist`).

- **Priority per run:** a `plan:approved` issue → build; else `plan:revise` → re-plan; else
  `ready-for-agent` → plan; else stop. At most one issue per run.
- **Risk → plan depth / Gate 1:** `risk:docs` / `risk:chore` plans are **auto-approved** (plan
  + build in one pass, logged); `risk:feature` / `risk:risky` require Gate 1 — post the plan,
  set `plan:pending`, and stop. Missing tier is treated as `risk:feature`.
- **Gate 1 handshake:** the human swaps `plan:pending` → `plan:approved` to proceed, or
  → `plan:revise` (+ a `/revise <notes>` comment) to iterate. The swap is a label change (not
  just a comment) because the scheduler's cheap pre-check counts labels and cannot see comments.
- **Build:** claim with `agent:building`, build to `coding-standards.md` (TDD, tests, coverage),
  commit to `claude/issue-<n>-<slug>`, open a PR with `Closes #<n>` and the carried `risk:*` +
  rollback, then hand off.
- **Isolation & safety:** `builder-run.sh` runs in a dedicated git worktree off `origin/main`
  (never the user's checkout), invokes `claude -p /build-next` with a scoped tool allow-list
  (git/gh/bun + in-repo edits — never `--dangerously-skip-permissions`), and logs each run.
- **Hard limits:** never merge, push to `main`, force-push, or edit `.github/workflows/**`,
  `docker/**` deploy config, CloudFront config, or `SECURITY.md`. Anything else → escalate with
  `ready-for-human` + a written reason.
- **Kill switch:** an open issue labeled `builder:paused` makes every run exit immediately.

---

## Cycle C — Review + Gate 2

The PR gate is now the repository's required CI checks, Code Owner/human review,
and resolved review threads. The automated Claude reviewer and deterministic
`release-ready` label have been retired.

**Gate 2** is the release runbook (`/docs/ops/gate2.md`): merge the PR, validate the release
candidate in a running app, then `/release` bumps + tags `v*.*.*`. The former automatic DEV
deployment is disabled. The tag-triggered `deploy-prod.yml` runs an ungated **evidence job**
(prints the deploying version, previous prod version via `prev-release-tag.cjs`, and the exact
rollback command) then **pauses at the `production` environment gate** for your approval.
Policy: **no rollback path, no approval.** Rollback is redeploying the previous tag through
the same gated path.

See [Build, deploy & ops](build-deploy-and-ops.md) for the deploy workflows themselves.

---

## Cycle D — The Night Shift

The **night shift** is a nightly (20:00), unattended local Claude Code routine that triages
failing checks on the fleet's own **`claude/*`** open PRs and **never merges**. Spec:
`/docs/agents/night-shift.md`; command: `/.claude/commands/triage-prs.md`; launcher:
`/scripts/triage-run.sh` (+ `dev.vinny.gsd-night-shift.plist`); PR selector:
`/scripts/failing-agent-prs.cjs`.

- **Auto-fix** mechanical failures (lint/format drift, stale `bun.lock`, branch-behind, simple
  typecheck/import errors). **Escalate** logic-test failures, any security-scan failure,
  ambiguous type errors, and non-trivial conflicts. **Skip + log** flaky/external/unreproducible.
- **Two invariants:** verify a fix locally before submitting, and deliver it as a fix PR on a
  fresh `claude/fix-<branch>-<runid>` branch targeting the failing branch so it re-enters the
  gate. **≤3 fix PRs per run.**
- Posts a **self-audit report** to the Night Shift Control issue each run; `triage:paused` on
  that issue is the kill switch.

---

## Cycle E — Standards loop

The scheduled telemetry collector is retired. Historical metric scripts and snapshots may
remain as reference, but they do not update a dashboard or participate in a gate.

The **standards loop** (`/docs/ops/pipeline-audit.md`) is the learning mechanism: spot-check
~1 in 10 merged PRs (over-sampling low-human-contact and high-churn changes), then convert
recurring findings into durable rules in `coding-standards.md` — which the builder and night
shift both read — so each mistake is paid down once. Autonomy is earned continuously
and can be revoked if audits surface escaped defects.

---

## Where to start when changing the pipeline

- **Change the contract fields / risk parsing:** `/.github/ISSUE_TEMPLATE/change_request.yml`
  and `/scripts/parse-risk-tier.cjs` (tested by `/tests/parse-risk-tier.test.ts`).
- **Change builder or night-shift behavior:** edit the operating spec in `/docs/agents/` and
  the matching `/.claude/commands/*.md` together — they must stay consistent. Wrappers:
  `/scripts/builder-run.sh`, `/scripts/triage-run.sh`.
- **Change release/gate logic:** `/.github/workflows/deploy-prod.yml` and
  `/docs/ops/gate2.md`. Note the builder must never edit the production workflow.
- **Change historical metric tooling:** `/scripts/telemetry-metrics.cjs`.
- **Tests to run:** `/tests/data/pipeline-workflows.test.ts` (risk-workflow invariants),
  `/tests/{builder-run,triage-run,failing-agent-prs,telemetry-metrics,extract-run-tokens,prev-release-tag}.test.ts`,
  and `/tests/parse-risk-tier.test.ts`.

New pipeline labels must exist in the tracker — re-run `/scripts/setup-labels.sh` after adding
one. Design specs/plans for each cycle are under `/docs/superpowers/`.
