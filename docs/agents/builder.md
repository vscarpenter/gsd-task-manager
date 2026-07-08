# Builder — operating spec

The builder is a **local, scheduled** Claude Code routine (cycle B of the delivery pipeline). It turns a fully-specified issue into a reviewed pull request, pausing once for human plan approval (Gate 1). It **never merges**. It is launched by `scripts/builder-run.sh`; its per-run instructions live in `.claude/commands/build-next.md`; this file is the durable operating spec both reference.

For all issue-tracker operations, follow `docs/agents/issue-tracker.md` (the `gh` conventions). For triage-label vocabulary, see `docs/agents/triage-labels.md`.

## The loop (label state machine)

The builder is **non-blocking**: each run does one unit of work and exits. Labels carry state between runs, so a closed laptop never orphans anything.

```
needs-triage + risk:*            (a filed contract, cycle A)
      │  human triages a well-specified one
      ▼
ready-for-agent ──run 1 (plan)──▶ plan:pending ──human swaps──▶ plan:approved ──run 2 (build)──▶ [PR opened]
      │                               │                                            │
      │ risk:docs | risk:chore        │ human swaps + /revise <notes>              │ agent:building
      │ auto-approve (plan+build       ▼                                           │  (claim-lock, removed
      │  in one pass, logged)     plan:revise ──run (re-plan)──▶ plan:pending      │  when the PR is opened)
      │
      └── ambiguous / needs judgment / hard limit hit ──▶ ready-for-human + written reason
```

Process **at most one** issue per run (one planned OR one built), so a single run has a bounded blast radius.

## Risk → plan depth

The `risk:*` label (from the contract) decides how deep the plan is and whether Gate 1 applies:

| Risk | Plan depth | Gate 1 |
|---|---|---|
| `risk:docs` | One or two lines: what changes, how verified. | **Auto-approved** — post the plan as a comment noting `auto-approved (risk:docs)`, then build in the same run. |
| `risk:chore` | Short: approach + files touched + how verified. | **Auto-approved** — same, `auto-approved (risk:chore)`. |
| `risk:feature` | Full plan: approach, files to touch, test strategy, open questions. Follow the structure in `docs/superpowers/plans/`. | **Required** — post plan, label `plan:pending`, stop. |
| `risk:risky` | Full plan **plus** an explicit risk/rollback section and the specific safeguards. | **Required** — post plan, label `plan:pending`, stop. |

If an issue has no `risk:*` label, treat it as `risk:feature` (require Gate 1) and note the missing tier in the plan.

## Gate 1 protocol

1. Write the plan and post it as an issue comment.
2. Move labels: remove `ready-for-agent`, add `plan:pending`.
3. **Stop.** Do not build.
4. The human either:
   - **approves** — swaps `plan:pending` → `plan:approved` (two taps on the GitHub mobile app); or
   - **requests changes** — swaps `plan:pending` → `plan:revise` and comments `/revise <notes>`.
5. On the next run: a `plan:approved` issue proceeds to build; a `plan:revise` issue is re-planned (address the notes, post the updated plan, then swap back to `plan:pending` for another approval round). A bare `plan:pending` issue is left alone — it is waiting on the human.

Why "request changes" is a label swap and not just a comment: the scheduler's cheap pre-check counts labels and cannot see comments without an expensive query. Signalling a revise with the `plan:revise` label lets the builder wake for it without polling every pending plan on every run.

## Build

Only after `plan:approved` (or auto-approval):

1. **Claim:** remove `plan:approved` / `ready-for-agent`, add `agent:building` (prevents a concurrent run from double-processing).
2. **Build to the standard:** implement the change following `coding-standards.md` as the definition of done — TDD, tests, docs, coverage thresholds. The standards define done, not the builder's confidence.
3. **Branch:** commit to `claude/issue-<n>-<slug>`. Never commit to `main`.
4. **PR:** open a pull request using the repo's PR template. Include `Closes #<n>`, carry the issue's `risk:*` tier, and copy the rollback plan from the contract into the PR's rollback section.
5. **Hand off:** remove `agent:building`, comment the PR link on the issue. The PR now enters review + CI (a required gate) + Gate 2 — none of which the builder performs.

## Separation of duties — hard limits

The builder **must never**:
- merge any PR, push to `main`, or force-push anything;
- edit `.github/workflows/**`, `docker/**` deploy config, CloudFront config/functions, or `SECURITY.md` / security configuration.

The builder **may only**: create and commit to a `claude/issue-<n>-*` branch, open a PR, comment on issues/PRs, and move the workflow labels above.

If a task genuinely requires any forbidden action, **escalate** — do not work around it.

## Escalation

When the contract is ambiguous, the change needs human judgment, a required change hits a hard limit, or the build cannot meet `coding-standards.md`: add `ready-for-human`, remove `agent:building`/`plan:*`, and comment a **written reason** explaining exactly what is blocked and what input is needed. Never guess and never silently proceed.

## Kill switch

`scripts/builder-run.sh` checks for an open issue labeled `builder:paused` before doing anything and exits if found. To halt the builder with no code change and no shell access, add `builder:paused` to the designated Builder Control issue; remove it to resume.
