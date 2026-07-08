# Spec: Cycle B — The Builder + Gate 1 (local, blog-faithful)

- **Date:** 2026-07-07
- **Status:** Accepted (design approved 2026-07-07; proceeding to plan + implementation per standing correction)
- **Deciders:** Vinny Carpenter
- **Related:** `docs/superpowers/specs/2026-07-07-the-contract-design.md` (cycle A), `docs/agents/triage-labels.md` + `docs/agents/issue-tracker.md` (existing AFK-agent framework), `coding-standards.md`, blog "Two Gates and a Night Shift"

## Goal

A **local, scheduled** Claude Code routine that claims a fully-specified issue, writes a **risk-scaled plan**, stops for a **GitHub-native plan approval (Gate 1)**, and — once approved — builds the change to `coding-standards.md` and opens a pull request. The builder never merges. This is **cycle B** of five; it ends at "PR opened."

## Scope & non-goals

**In scope:**
- Label state machine extending the existing AFK-agent labels (`ready-for-agent`, `ready-for-human`) with planning states (`plan:pending`, `plan:approved`, `agent:building`) and a kill switch (`builder:paused`).
- A local launchd job + wrapper script (`scripts/builder-run.sh`) that pre-checks cheaply and invokes the builder only when there is work.
- The builder's versioned instructions: a slash command (`.claude/commands/build-next.md`) + an operating spec (`docs/agents/builder.md`).
- Risk-scaled behavior keyed off cycle A's `risk:*` labels: `docs`/`chore` auto-approved; `feature`/`risky` go through Gate 1.
- Separation-of-duties constraints enforced in the builder's instructions.

**Explicit non-goals (later cycles):**
- **No reviewer, no merge, no Gate 2.** The builder opens a PR and stops. Review + CI-as-gate (now enforced) + Gate 2 are cycle C.
- **No nightly triage** (cycle D). **No telemetry** (cycle E).
- **No Telegram/Roci** — Gate 1 is GitHub-native (label swap, approved from the GitHub mobile app).
- **No blocking wait** — the runner is stateless across runs; labels are the durable state.

## Background — current state

Cycle A gives every change an enforced contract with a `risk:*` tier. The repo already runs `anthropics/claude-code-action@v1` reactively (`claude.yml`, read-only, `@claude`-triggered) and documents an AFK-agent label vocabulary (`docs/agents/triage-labels.md`: `ready-for-agent` = "fully specified, ready for an AFK agent"; `ready-for-human` = "requires human implementation"). `main` is now protected by a ruleset requiring PR + passing CI (`lint`/`typecheck`/`test`/`build`) + thread resolution, so nothing the builder pushes can reach `main` without the gate.

The gap: nothing autonomously turns a `ready-for-agent` contract into a reviewed PR, and there is no plan-approval gate.

## Decision

A **local scheduled routine**, not a GitHub Action, per the blog's model. It is **non-blocking and stateless across runs**; a label state machine is its memory. Gate 1 approval is a **label swap** (`plan:pending` → `plan:approved`) done from GitHub mobile; `/revise <notes>` requests changes.

Why local over an Action: chosen explicitly (blog-faithful). Why non-blocking: a local process must not block for hours — a sleeping laptop would orphan the run; labels survive sleep. Why label-swap Gate 1: two-tap mobile approval, clean state machine, reuses the existing label framework.

## Design

### 1. Label state machine

```
needs-triage + risk:*        (cycle A output)
      │  human triages
      ▼
ready-for-agent ──run 1 (plan)──▶ plan:pending ──YOU: swap──▶ plan:approved ──run 2 (build)──▶ [PR opened]
      │                               │                                            │
      │ risk:docs|chore               │ /revise <notes>                            │ agent:building (claim-lock,
      │ (auto-approve: plan+build      ▼   (next run re-plans)                      │  removed when PR opened)
      │  in one pass, logged)     plan:pending
      │
      └── cannot proceed / needs judgment ──▶ ready-for-human + written reason (comment)
```

New labels (added to `scripts/setup-labels.sh`):

| Label | Meaning | Color |
|---|---|---|
| `plan:pending` | Plan posted, awaiting Gate 1 approval | `#fbca04` (yellow) |
| `plan:approved` | Human approved the plan; build may proceed | `#0e8a16` (green) |
| `agent:building` | Builder is actively building (claim-lock) | `#5319e7` (purple) |
| `builder:paused` | Kill switch — on the Builder Control issue, halts all runs | `#b60205` (red) |

Reused (unchanged): `ready-for-agent`, `ready-for-human`, `needs-triage`, `risk:*`.

### 2. `scripts/builder-run.sh` — launchd entry point

Responsibilities, in order:
1. **Kill switch:** if any open issue has `builder:paused`, log one line and exit 0.
2. **Cheap work check:** `gh issue list` for `ready-for-agent` (unplanned) or `plan:approved` (ready to build). If none, exit 0 without invoking Claude (most wake-ups cost zero tokens).
3. **Isolation:** create/refresh a dedicated git worktree (`$BUILDER_WORKTREE`, default `~/.gsd-builder/worktree`) off latest `origin/main` — never the user's active checkout.
4. **Invoke:** `claude -p "/build-next"` in the worktree with a scoped permission profile (git, `gh`, bun/test, in-repo edits; see §5). Timeout-bounded.
5. **Log:** append run output to `docs/ops/builder-logs/` (or a configured dir) with a UTC-less run id.
6. Supports `--dry-run` (print the decision + what it would invoke, without invoking Claude) for testing/verification, and `--check` (kill-switch + work-check only, print state, exit).

Structured so the decision logic (`paused` / `no-work` / `work`) is observable via `--dry-run` against a stubbed `gh`.

### 3. `.claude/commands/build-next.md` — the builder command

Invoked headlessly. Instructs Claude to, in one run, process **at most one** issue:
- **Plan pass:** pick the oldest open `ready-for-agent` issue. Read the contract (cycle A fields). Write a risk-scaled plan:
  - `risk:docs`/`risk:chore` → lightweight plan; **auto-approve**: post the plan as a comment noting "auto-approved (risk:<tier>)", then proceed straight to the build pass in the same run.
  - `risk:feature`/`risk:risky` → full plan (approach, files, test strategy, open questions, following the `docs/superpowers/` plan format). Post as a comment, swap `ready-for-agent` → `plan:pending`, and **stop**.
- **Build pass:** pick the oldest `plan:approved` issue (or the just-auto-approved one). Claim it (`plan:approved`/`ready-for-agent` → `agent:building`). Build to `coding-standards.md` (TDD, tests, docs). Commit to `claude/issue-<n>-<slug>`, push, open a PR (cycle A PR template; `Closes #<n>`; carry `risk:*`; rollback from the contract). Remove `agent:building`. Comment the PR link on the issue.
- **Revise:** if a `plan:pending` issue has a newer `/revise <notes>` comment, re-plan addressing the notes; re-post; keep `plan:pending`.
- **Escalate:** if the contract is ambiguous, the change needs judgment, or a hard limit is hit → add `ready-for-human`, remove agent labels, and comment a written reason (never guess).

### 4. `docs/agents/builder.md` — operating spec

The durable "standard spec" the command references: risk-tier → plan-depth mapping; the label protocol; the plan format (reuse `docs/superpowers/`); `coding-standards.md` as definition of done; and the separation-of-duties limits (§5). Extends the existing `docs/agents/` set.

### 5. Separation of duties (hard limits, enforced in the instructions + permission profile)

The builder **must never**: merge, push to `main`, force-push, or edit `.github/workflows/**`, `docker/**` deploy config, CloudFront config, or `SECURITY.md`/security config. On needing any of those → escalate (`ready-for-human`).
The builder **may only**: create/commit to a `claude/issue-<n>-*` branch, open a PR, comment on issues/PRs, and move the workflow labels in §1.
Bounded blast radius: **≤1 issue planned and ≤1 issue built per run**; per-run timeout; operates only in the isolated worktree.

### 6. Scheduling — launchd

`scripts/launchd/dev.vinny.gsd-builder.plist` (versioned template) → installed to `~/Library/LaunchAgents/`. Runs `builder-run.sh` every **30 minutes**, `StartInterval`-based, non-overlapping (launchd serializes a single label). The cheap pre-check keeps empty wake-ups free. Install/load is a documented rollout step (`launchctl bootstrap`/`load`), not run by CI.

## Verification approach

Cycle B is prompts + scripts + a plist, not pure logic — so verification is behavioral and static, not a single unit test:
- `builder-run.sh`: `bash -n`, shellcheck, and **`--dry-run` executed against a stubbed `gh`** to observe correct branching (paused → exit; no-work → exit; work → would-invoke). This is the real behavioral test.
- `plist`: `plutil -lint`.
- `setup-labels.sh`: idempotent re-run creates the four new labels.
- Cross-reference check: labels named in `build-next.md`/`builder.md` exist in `setup-labels.sh`; the plan/PR formats referenced exist.
- End-to-end (rollout): file a real `risk:chore` contract → `ready-for-agent` → observe auto-approve + PR; and a `risk:feature` one → observe `plan:pending`, approve, observe build + PR.

## Rollback

Everything is additive: new labels, one wrapper script, one command, one doc, one plist template. Rollback = unload the launchd job (`launchctl bootout`), delete the added files, and `gh label delete` the four new labels. No runtime/app/deploy surface is touched. The kill-switch label halts the builder instantly without any rollback.
