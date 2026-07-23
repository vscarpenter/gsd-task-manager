---
name: branch-preflight
description: Sanity-check the working tree before starting plan execution or new branch work. Catches inherited damage that silently breaks verification later — merge conflict markers committed to tracked files, outstanding stash entries that may bleed into your work, uncommitted changes you may not realize you have. Runs in ~1 second. Trigger BEFORE invoking superpowers:executing-plans or superpowers:subagent-driven-development, BEFORE creating a new feature branch off main, or when verification mysteriously fails on files you did not touch.
disable-model-invocation: false
---

# branch-preflight — Catch inherited working-tree damage early

## When to invoke

Trigger this skill BEFORE any of:
- Starting plan execution (`superpowers:executing-plans`, `superpowers:subagent-driven-development`)
- Creating a new feature branch off `main` (`git switch -c feat/...`)
- Investigating a verification failure on files you do not recognize as yours

You should also volunteer to run it if the user mentions:
- "let's start implementing"
- "execute the plan"
- "kick off the work"

## Why it exists

A real session lost ~10 minutes when `tests/ui/edit-drawer.test.tsx` turned out to have unresolved merge conflict markers committed to `main` six commits before the session started (commit `62f3ab4`). The file failed to parse, blocking root `bun run test` and any PR CI. The damage was discovered mid-Task-2 of an implementation plan, requiring an out-of-plan fix and explicit scope-expansion approval from the user.

This script catches that class of damage in under a second, before it becomes a Task-6 surprise.

## What it checks

1. **Merge conflict markers in tracked files.** Greps `git ls-files` for `<<<<<<<`, `=======`, or `>>>>>>>` line prefixes. Tracked-files-only avoids false positives on `.Codex/` scratch notes.
2. **Stash entries.** A non-empty `git stash list` is a yellow flag — most users don't realize an autostash is sitting there.
3. **Uncommitted changes.** Surfaces both unstaged (`git diff`) and staged (`git diff --cached`) work.

## How to use

Just run it:

```bash
bash scripts/branch-preflight.sh
```

Exit code:
- `0` — clean, safe to proceed
- `1` — at least one finding; review the output before starting

## What to do with findings

| Finding | Suggested action |
|---|---|
| Merge conflict markers | Resolve them in a separate `fix(...)` commit on the current branch BEFORE starting plan execution. Do not stack feature work on top of broken files. |
| Stash entries | Run `git stash list` to inspect. If it's stale or unrelated, drop it (`git stash drop`). If it's intentional in-progress work, acknowledge and proceed. |
| Uncommitted changes | Either commit them, stash them deliberately, or revert. Don't start a plan with mystery diff in the working tree. |

## Out of scope

This script does NOT check:
- Whether the branch is up to date with `main` (use `git fetch && git status`)
- Whether dependencies are installed (use `bun install`)
- Whether tests currently pass (use `bun run test`)
- Whether CI is green for the branch (use `gh pr checks`)

These are different problems with different feedback loops. This skill is the cheapest possible "is the working tree sane?" check.

## Gotchas

- The merge-marker grep uses `^<<<<<<< ` / `^>>>>>>> ` / `^={7}$` regex anchored at line start, so it won't false-positive on documentation that mentions conflict markers in prose.
- The stash check counts ALL stash entries, including ones from other tools (autostash from `git pull --rebase`, IDE auto-stashes). It's a yellow flag, not a red one — the script exits non-zero but the message says "acknowledge before starting", not "fix immediately".
