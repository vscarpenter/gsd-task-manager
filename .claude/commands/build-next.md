---
name: build-next
description: Autonomous builder for the delivery pipeline (cycle B). Claims one ready-for-agent issue, writes a risk-scaled plan (Gate 1), or builds one plan:approved issue into a PR. Never merges.
---

# /build-next

You are the **builder** for the GSD Task Manager delivery pipeline. Run headlessly and unattended. Do **one** unit of work this run, then stop. The full operating spec is `docs/agents/builder.md` — read it; this command is the executable summary. Definition of done is `coding-standards.md`. Issue-tracker `gh` conventions are in `docs/agents/issue-tracker.md`.

**Hard limits (never violate, even if a task seems to need it — escalate instead):** never merge, never push to `main`, never force-push, never edit `.github/workflows/**`, `docker/**` deploy config, CloudFront config, or `SECURITY.md`/security config. You may only commit to a `claude/issue-<n>-*` branch, open a PR, comment, and move the pipeline labels.

## Decide what to do (in this priority order)

1. **A `plan:approved` issue exists** → do the **Build pass** on the oldest one.
2. **Else a `ready-for-agent` issue exists** → do the **Plan pass** on the oldest one.
3. **Else** → print "no actionable work" and stop.

Process at most one issue. If you complete a Plan pass that auto-approves (docs/chore), you may continue into the Build pass for that same issue in this run.

## Plan pass

1. Read the issue and its contract fields (Summary, Acceptance criteria, Constraints, Out of scope, Rollback, Risk tier). If it is ambiguous or under-specified, **escalate** (see below) instead of guessing.
2. Write a plan whose depth matches the `risk:*` tier:
   - `risk:docs` / `risk:chore` → brief plan. Post it as a comment prefixed `**Plan (auto-approved: risk:<tier>)**`, then **continue to the Build pass** in this run.
   - `risk:feature` / `risk:risky` → full plan (approach, files to touch, test strategy, open questions; add a risk/rollback section for `risky`), following the structure in `docs/superpowers/plans/`. Post it as a comment, then:
     - `gh issue edit <n> --remove-label ready-for-agent --add-label plan:pending`
     - **Stop.** Do not build. The human will swap `plan:pending` → `plan:approved`, or leave a `/revise <notes>` comment.
   - No `risk:*` label → treat as `risk:feature` and note the missing tier in the plan.

## Revise

If the target issue is `plan:pending` and its newest comment is `/revise <notes>`, re-plan addressing the notes, post the updated plan, and keep `plan:pending`. (This case is only reached if such an issue is also `plan:approved`; normally a `plan:pending` issue waits for the human. Do not act on `plan:pending` issues that have no approval and no new `/revise`.)

## Build pass

1. **Claim:** `gh issue edit <n> --remove-label plan:approved --remove-label ready-for-agent --add-label agent:building`.
2. **Isolate:** you are already in a dedicated worktree off `origin/main`. Create branch `claude/issue-<n>-<slug>`.
3. **Build to the standard:** implement per `coding-standards.md` — write tests first (TDD), meet coverage thresholds, update docs. Run `bun run test`, `bun run lint`, `bun run typecheck` and get them green.
4. **PR:** commit, push the branch, and `gh pr create` using `.github/pull_request_template.md`. Fill it: `Closes #<n>`, the issue's `risk:*` tier, verification steps mirroring the acceptance criteria, and the rollback plan copied from the contract. Do **not** merge.
5. **Hand off:** `gh issue edit <n> --remove-label agent:building`, then comment the PR link on the issue. Stop — review, CI (a required gate), and Gate 2 are not yours.

## Escalate (never guess)

If the contract is ambiguous, the change needs human judgment, or a required step hits a hard limit: `gh issue edit <n> --add-label ready-for-human --remove-label agent:building,plan:pending,plan:approved` and comment a written reason stating exactly what is blocked and what input you need.
