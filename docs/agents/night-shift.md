# Night shift — operating spec

The night shift is a **nightly, unattended** local Claude Code routine (cycle D — the maintenance loop). At 20:00 it triages failing checks on the agent fleet's own open PRs, clearing mechanical failures before they cost you attention. It **never merges**. It is launched by `scripts/triage-run.sh`; its per-run instructions live in `.claude/commands/triage-prs.md`; this file is the durable operating spec both reference.

Issue/PR operations follow `docs/agents/issue-tracker.md`. Triage-label vocabulary is in `docs/agents/triage-labels.md`. Definition of done for any fix is `coding-standards.md`.

## The nightly loop

```
20:00 launchd → triage-run.sh
   triage:paused set? → post one line, exit                       (kill switch)
   find open claude/* PRs with a failing check → none? exit
   else: worktree off origin/main → claude -p "/triage-prs"
         → for each failing claude/* PR (oldest first, ≤3 fix PRs):
              reproduce → classify → fix+verify → fix PR   |  escalate  |  skip
         → post self-audit report to the Night Shift Control issue
```

Scope is **`claude/*` PRs only** — the fleet's own output. It never touches hand-authored branches.

## Auto-fix / escalate / skip policy

| Failing check | Action |
|---|---|
| Lint / formatting drift | **Fix** — `eslint . --fix`, `prettier --write` |
| Stale `bun.lock` | **Fix** — `bun install` |
| Branch behind `main` (fails only for being out of date) | **Fix** — merge `origin/main` (trivial conflicts only) |
| Simple typecheck / import error (unused/missing import, obvious annotation) | **Fix** — targeted, no logic changes |
| Logic **test** failure | **Escalate** (`ready-for-human` + reason) |
| **Any security-scan failure** | **Escalate** — never patch around |
| Ambiguous type error / non-trivial conflict / a fix that didn't verify | **Escalate** |
| Can't reproduce / flaky / external / already `ready-for-human` | **Skip + log** |

Every fix is delivered as a fix PR on a fresh `claude/fix-<branch>-<runid>` branch **targeting the failing branch**, so it re-enters review + CI. The night shift never merges.

## The two safety invariants

The broad auto-fix set is safe only because both hold:

1. **Verify before submit.** After applying a fix, re-run the failing check. Open a fix PR **only if it now passes** locally. A fix that doesn't make the check green is reverted and escalated — a plausible-but-wrong fix never leaves the machine.
2. **Fixes re-enter the gate.** Fix PRs face the same CI-required + reviewer + thread-resolution gate as daytime work, and the night shift **never merges**. Nothing it produces reaches a branch without human/gate sign-off.

## Hard limits

Never: merge, force-push, push to a branch it did not create, edit `.github/workflows/**` / `docker/**` deploy config / CloudFront config / `SECURITY.md` / security config, or patch around a security-scan failure. Only: create `claude/fix-*` branches, open fix PRs targeting the failing branch, comment, and apply `ready-for-human` / labels. **≤3 fix PRs per run.** Operate only in the isolated worktree.

## Escalation

When a check needs judgment (logic test, security, ambiguity, non-trivial conflict) or a fix fails to verify: add `ready-for-human` to the PR and comment a written reason stating exactly what is blocked and what input is needed. Never guess; never silently proceed.

## Self-audit report

At the end of every run, post one comment to the **Night Shift Control** issue (pinned; also carries the `triage:paused` kill switch): what was **fixed** (fix-PR links), **escalated** (reasons), and **skipped** (reasons); the fix-PR count vs. the 3-PR budget; and **any anomaly the run noticed about itself** — a check it couldn't classify, a fix it was unsure about, a limit it hit. An unattended agent that files its own incident report is one you can leave alone at night. If it did nothing, it says so in one line.

## Kill switch

`scripts/triage-run.sh` checks for an open issue labeled `triage:paused` before doing anything and exits if found. To halt the night shift with no code change and no shell access, add `triage:paused` to the Night Shift Control issue; remove it to resume.
