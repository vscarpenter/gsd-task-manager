# Spec: Cycle D — The Night Shift

- **Date:** 2026-07-08
- **Status:** Accepted (design approved 2026-07-08; proceeding to plan + implementation per standing correction)
- **Deciders:** Vinny Carpenter
- **Related:** cycle B (`2026-07-07-builder-gate1-design.md`, whose wrapper/worktree/kill-switch patterns this reuses), `docs/agents/builder.md`, `coding-standards.md`, blog "Two Gates and a Night Shift"

## Goal

A nightly, unattended local routine that triages failing checks on the agent fleet's own open PRs — repairing the mechanical ones on fresh branches as fix PRs, escalating the ones that need judgment, and skipping the rest — with the same guardrails as the builder plus a self-audit report. It **never merges**. This is **cycle D** of five (the maintenance loop).

## Scope & non-goals

**In scope:**
- `triage-run.sh` — a nightly launchd wrapper (cycle B's skeleton) that checks the `triage:paused` kill switch and finds failing `claude/*` PRs before invoking the triage agent.
- `failing-agent-prs.cjs` (+ test) — the substantive filter: which open PRs are `claude/*` with a failing check.
- `.claude/commands/triage-prs.md` + `docs/agents/night-shift.md` — the triage brain and its operating spec.
- `triage:paused` label; a launchd plist at 20:00.

**Explicit non-goals:**
- **No merging, ever** (that stays the two gates). No pushing to a branch it did not create. No editing `.github/workflows/**` / deploy / security config.
- **Scope: `claude/*` PRs only** (agent-created). It never touches hand-authored WIP branches.
- **No telemetry** (cycle E).
- Not a re-implementation of the builder — it reuses B's wrapper/worktree/kill-switch/logging patterns.

## Background — current state

Cycle B built the local builder: `builder-run.sh` (launchd wrapper, kill switch, isolated worktree, scoped `claude -p`, logging), separation-of-duties limits, and `.claude/commands/build-next.md`. Cycle C added the reviewer gate + `release-ready`. The delivery loop and its gates exist; nothing clears the **mechanical** failures (lint drift, stale lockfile, branch behind main, trivial type errors) that accumulate on open PRs and steal attention.

## Decision

A **nightly local routine** modeled on the builder, **non-blocking** and stateless. It triages only `claude/*` PRs. Auto-fix set (chosen): formatting (`eslint --fix`, `prettier --write`), stale lockfile (`bun install`), branch-behind-main (merge `origin/main`), and simple typecheck/import fixes. Everything else escalates or is skipped. The broad auto-fix set is made safe by two invariants: **verify-before-submit** (only open a fix PR if the failing check now passes locally) and **fixes re-enter the gate** (CI-required + reviewer + thread-resolution; the night shift never merges).

## Design

### 1. `scripts/failing-agent-prs.cjs` (+ `tests/failing-agent-prs.test.ts`)

Pure filter, dual-mode (module + CLI). Exports:
- `isAgentBranch(headRefName): boolean` — `headRefName.startsWith("claude/")`.
- `isFailingCheck(check): boolean` — a `statusCheckRollup` entry whose `conclusion` ∈ {FAILURE, TIMED_OUT, CANCELLED, ACTION_REQUIRED, STARTUP_FAILURE} or `state` ∈ {FAILURE, ERROR} (case-insensitive). Pending/success/neutral/skipped are not failing.
- `failingAgentPRs(prs): PR[]` — the subset that are agent branches **and** have ≥1 failing check.
- CLI (`require.main === module`): read `gh pr list --json …` JSON from stdin, print `failingAgentPRs(...).length`.

`.cjs` (repo convention) so `triage-run.sh` can pipe `gh` output through it and Vitest can unit-test the classification. TDD.

### 2. `scripts/triage-run.sh` — nightly launchd wrapper

Mirrors `builder-run.sh`:
1. **Kill switch:** an open issue labeled `triage:paused` → post one line, exit 0.
2. **Work check:** `gh pr list --state open --json number,headRefName,statusCheckRollup` piped through `failing-agent-prs.cjs`. Zero → exit 0 (no Claude run). `gh` failure logs to `gh-errors.log` and fails safe to 0 (as in cycle B).
3. **Isolation:** refresh a dedicated worktree off latest `origin/main`.
4. **Invoke:** `claude -p "/triage-prs"` with a scoped tool allow-list, time-bounded.
5. **Log** to `docs/ops/night-shift-logs/`.
Modes `--check` / `--dry-run` for testing (observable `PAUSED` / `NO_WORK` / `WORK` sentinels).

### 3. `.claude/commands/triage-prs.md` — the triage command

Per run, oldest-first, **≤3 fix PRs total**. For each failing `claude/*` PR, per failing check:
1. **Reproduce** in the worktree (checkout the PR branch, run the check).
2. **Classify + act:**
   - **Fix classes** — `eslint --fix`; `prettier --write`; `bun install` (stale lockfile); merge `origin/main` (branch behind, trivial conflicts only); a targeted simple typecheck/import fix.
   - **Verify:** re-run the check. Proceed **only if it now passes**. If the fix does not make the check pass → escalate.
   - **Deliver:** commit to `claude/fix-<branch>-<runid>`, open a fix PR **targeting the failing branch** (`base` = failing branch). Comment the fix PR link on the original PR. Never merge.
3. **Escalate** — a logic **test** failure, **any security-scan failure**, an ambiguous type error, a non-trivial conflict, or a fix that failed to verify → add `ready-for-human` to the PR + a written reason. Never guess, never patch around security.
4. **Skip + log** — can't reproduce, flaky/external, or already `ready-for-human`.
Stop at 3 fix PRs; log the rest as skipped-for-budget.

### 4. `docs/agents/night-shift.md` — operating spec

The triage loop, the auto-fix/escalate/skip policy table, the hard limits (§ below), and the **self-audit report** format.

### 5. Hard limits (enforced in the command + wrapper)

Never: merge, force-push, push to a branch it did not create, edit `.github/workflows/**` / `docker/**` deploy / CloudFront / security config, or patch around a security-scan failure. Only: create `claude/fix-*` branches, open fix PRs targeting the failing branch, comment, apply `ready-for-human` / labels. ≤3 fix PRs per run; isolated worktree only.

### 6. Self-audit report + kill switch

A designated **Night Shift Control** issue holds `triage:paused` (kill switch: wrapper exits if present) and receives, at the end of each run, a report comment: fixed / escalated / skipped with PR links, count vs. the ≤3 budget, and any anomaly the agent noticed about its own run ("files its own incident report"). Reviewed with morning coffee.

### 7. Scheduling — launchd

`scripts/launchd/dev.vinny.gsd-night-shift.plist` — `StartCalendarInterval` Hour 20 (8 p.m. local), `RunAtLoad` false, non-overlapping. Installed manually at activation.

## Verification approach

- **`failing-agent-prs.cjs`:** Vitest — agent-branch failing (included), agent-branch passing/pending (excluded), non-agent failing (excluded), the several check shapes (CheckRun conclusion vs. StatusContext state), empty/malformed input. The substantive logic unit; real coverage.
- **`triage-run.sh`:** `bash -n`; a `--check` test against a stubbed `gh` (issue list → paused; pr list → PR JSON) exercising `PAUSED` / `NO_WORK` / `WORK` through the real helper.
- **plist:** `plutil -lint`. **`setup-labels.sh`:** idempotent; `triage:paused` created.
- **End-to-end (rollout):** create a `claude/*` PR with a lint failure → confirm a fix PR appears; a `triage:paused` drill → confirm the run exits `PAUSED`.

## Rollback

Additive: one label, two scripts, one command, one doc, one plist. Rollback = unload the launchd job (`launchctl bootout`), delete the files, `gh label delete triage:paused`. The kill-switch label halts it instantly with no code change. No runtime/deploy surface touched.
