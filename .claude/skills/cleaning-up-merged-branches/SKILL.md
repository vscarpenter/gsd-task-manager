---
name: cleaning-up-merged-branches
description: Syncs main and deletes the local feature branch after a PR is merged on GitHub. Use when the user says they merged or squash-merged a PR ("I merged PR 411 on GitHub", "merged the PR", "clean up the branch"). Codifies this repo's squash-merge default, where `git branch -d` wrongly reports "not fully merged" and a verified force-delete is required.
---

# Cleaning up merged branches

Sync `main` and remove the now-stale local feature branch after the user merges a
PR on GitHub. This repo squash-merges PRs by default, so the plain `git branch -d`
refuses to delete the branch. Verify the content actually landed in `main`, then
force-delete.

Verification is two-tier on purpose. The cheap local check (step 4) is conclusive
only for a branch cut from the current `main`; it decays into false alarms as the
branch ages. When it comes back dirty, step 5 asks GitHub, which is authoritative
regardless of how the merge rewrote history. Never force-delete on a `[gone]`
upstream marker alone: that only means the remote branch was deleted, which says
nothing about whether the work merged.

## Steps

1. Fetch, prune stale remote-tracking refs, and note the current branch:
   `git fetch origin --prune && git branch --show-current`
2. Switch to `main` and pull the merge (local `main` still points at the pre-merge
   commit until you do this):
   `git checkout main && git pull origin main`
3. Try the safe delete of the feature branch:
   `git branch -d <branch>`
   - Succeeds → done; go to Verify.
   - Fails with `error: the branch '<branch>' is not fully merged` → expected for a
     squash merge. GitHub squashed the branch into one new commit, so its original
     commits are not ancestors of `main` even though the content landed. Continue.
4. Confirm the branch's content is fully in `main` before force-deleting. The
   `':!.blume'` pathspec excludes local `.blume/` tool artifacts that are never
   committed:
   `git diff main <branch> -- . ':!.blume'`
   - Empty output → content is fully in `main`; safe to force-delete.
   - Non-empty output → **this check has expired, not failed.** It only proves a
     merge for a branch cut from the current `main`. Fall through to step 5.
5. Only when step 4 came back non-empty, ask GitHub whether the branch was merged.
   This is the authoritative answer, because it survives any history rewrite:
   `gh pr list --state all --head <branch> --json number,state,mergedAt,title`
   - A `MERGED` PR → the content landed; safe to force-delete.
   - No PR, or an `OPEN`/`CLOSED` one → genuinely unmerged. Stop, show the user the
     branch's commits (`git cherry -v main <branch>`), and do NOT force-delete.
6. Force-delete the redundant local branch:
   `git branch -D <branch>`

## Verify

- `git branch` shows the feature branch is gone and you are on `main`.
- `git log --oneline -1` shows `main` at the squash-merge commit.

## Gotchas

- **`git diff main <branch>` is bidirectional, so it expires.** It reports work that
  landed in `main` *after* the branch was cut as though the branch removed it. That
  is harmless right after a merge, which is the case this skill was written for, but
  a branch left sitting for a few weeks reports thousands of diff lines even when its
  content merged cleanly. A non-empty diff on an older branch is not evidence of
  unmerged work; it is the check aging out. That is what step 5 is for.
- **`git cherry main <branch>` is not a fix for that.** It compares patch-ids, and a
  squash-merge collapses N commits into one that matches none of the N originals.
  The tell is a perfect correlation between commit count and verdict: every
  single-commit branch reads "already upstream" and every multi-commit branch reads
  "not in main". That pattern means squash-merge, not lost work. It is still useful
  as evidence *for* deletion (nothing flagged → definitely merged), never against.
- **`git worktree remove --force` discards uncommitted work silently.** Run
  `git -C <worktree> status --short` first and show the user anything it finds.
- Deleting **multiple** branches at once: zsh does not word-split an unquoted
  variable (unlike bash), so `git branch -D $branches` passes the whole list as one
  bad refspec and deletes nothing. Pipe the list through `xargs` instead:
  `... | xargs git branch -D`.
- Deleting **remote** branches (`git push origin --delete <branch>`) is externally
  visible — confirm with the user first. Local cleanup above does not require it;
  `git fetch origin --prune` already drops stale remote-tracking refs.
