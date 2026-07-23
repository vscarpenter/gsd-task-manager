---
name: triage-prs
description: Night-shift maintenance routine (cycle D). Triages failing checks on the agent fleet's own (claude/*) open PRs — auto-fixing mechanical classes as fix PRs, escalating judgment ones, skipping the rest. Never merges.
---

# /triage-prs

You are the **night shift** for the GSD Task Manager pipeline. Run headlessly and unattended. Triage failing checks on the fleet's own open PRs, then stop. The full operating spec is `docs/agents/night-shift.md` — read it; this command is the executable summary. Definition of done is `coding-standards.md`. Issue/PR ops follow `docs/agents/issue-tracker.md`.

**Hard limits (never violate — escalate instead):** never merge, never force-push, never push to a branch you did not create, never edit `.github/workflows/**`, `docker/**` deploy config, CloudFront config, or `SECURITY.md`/security config, and **never patch around a security-scan failure**. You may only create `claude/fix-*` branches, open fix PRs targeting the failing branch, comment, and apply `ready-for-human` / labels. **At most 3 fix PRs this run.**

## Select work

List open PRs whose head branch starts with `claude/`, that **originate from this repository itself** (not a fork), and that have at least one failing check (use `gh pr list --state open --json number,headRefName,headRepositoryOwner,isCrossRepository,statusCheckRollup`). A `claude/` branch name alone is **not** proof the PR is the fleet's own — a fork author picks their own branch names — so a PR only counts when `isCrossRepository` is `false` (equivalently, `headRepositoryOwner.login` equals this repo's owner). **Never check out or run a fork PR's branch** (`isCrossRepository: true`): skip it and record it as skipped with the reason. Process oldest-first. Skip any PR already labeled `ready-for-human`. Stop once you have opened **3 fix PRs**.

## For each failing check on a PR

1. **Reproduce.** In this worktree, check out the PR's head branch and run the failing check locally (`bun run lint` / `bun run typecheck` / `bun run test` / `bun run build`). If you cannot reproduce it (flaky, external, environment) → **skip + log**.
2. **Classify and act:**
   - **Formatting / lint** → `bun run lint` issues fixable by `eslint . --fix`; style drift by `prettier --write`.
   - **Stale lockfile** → `bun install` to regenerate `bun.lock`.
   - **Branch behind main** (fails only because it is out of date) → merge `origin/main`. Trivial conflicts (lockfile, generated files) only.
   - **Simple typecheck / import error** → a targeted fix (unused import, missing import, obvious type annotation). Do **not** attempt logic changes.
3. **Verify before submitting.** Re-run the failing check. **Only proceed if it now passes.** If your fix does not make the check pass, revert it and **escalate**.
4. **Deliver a fix PR.** Commit the verified fix to a fresh `claude/fix-<branch>-<runid>` branch, push, and `gh pr create --base <failing-branch>` (the fix targets the failing branch, so it re-enters review + CI). Comment the fix PR link on the original PR. **Do not merge.**

## Escalate (never guess)

A logic **test** failure, **any security-scan failure**, an ambiguous type error, a non-trivial merge conflict, or a fix that failed to verify → `gh pr edit <n> --add-label ready-for-human` and comment a written reason stating exactly what is blocked and what input is needed. Security failures are always escalated, never worked around.

## Skip + log

Anything you cannot reproduce, that is flaky/external, or that is already `ready-for-human` → record it in your report as skipped, with the reason.

## Self-audit report (always, at the end)

Post one comment to the **Night Shift Control** issue (the pinned issue that also carries the `triage:paused` kill switch) summarizing this run: for each PR touched, what you **fixed** (with fix-PR links), **escalated** (with reasons), or **skipped** (with reasons); the fix-PR count vs. the 3-PR budget; and **any anomaly you noticed about your own run** (a check you couldn't classify, a fix you were unsure about, a limit you hit). If you did nothing, say so in one line.
