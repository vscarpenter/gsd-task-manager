---
name: cleaning-up-merged-branches
description: Syncs main and deletes the local feature branch after a PR is merged on GitHub. Use when the user says they merged or squash-merged a PR ("I merged PR 411 on GitHub", "merged the PR", "clean up the branch"). Codifies this repo's squash-merge default, where `git branch -d` wrongly reports "not fully merged" and a verified force-delete is required.
---

# Cleaning up merged branches

Sync `main` and remove the now-stale local feature branch after the user merges a
PR on GitHub. This repo squash-merges PRs by default, so the plain `git branch -d`
refuses to delete the branch — verify the content actually landed in `main`, then
force-delete.

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
   - Non-empty output → the branch has unmerged changes. Stop, show the diff to the
     user, and do NOT force-delete.
5. Force-delete the redundant local branch:
   `git branch -D <branch>`

## Verify

- `git branch` shows the feature branch is gone and you are on `main`.
- `git log --oneline -1` shows `main` at the squash-merge commit.

## Gotchas

- Deleting **multiple** branches at once: zsh does not word-split an unquoted
  variable (unlike bash), so `git branch -D $branches` passes the whole list as one
  bad refspec and deletes nothing. Pipe the list through `xargs` instead:
  `... | xargs git branch -D`.
- Deleting **remote** branches (`git push origin --delete <branch>`) is externally
  visible — confirm with the user first. Local cleanup above does not require it;
  `git fetch origin --prune` already drops stale remote-tracking refs.
