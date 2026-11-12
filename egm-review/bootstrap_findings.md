# EGM Bootstrap: Run Notes and Findings

**Date:** 2026-11-11
**Scope:** repo root, full tree, `README.md` as the contract file

## What was written

* 72 new `README.md` files and 5 existing ones extended (root, `docker/`, `packages/mcp-server/`, `docs/diagrams/reminder-model/`, `docs/diagrams/task-lifecycle-model/`). About 6,100 lines in total.
* Existing READMEs were edited by addition only. `git diff --numstat` shows 0 removed lines in each.
* No source file changed. Nothing was staged or committed.

| Partition | Directories | Notes |
| --- | --- | --- |
| `components/` | 15 | 15 scouts in three waves after a concurrency limit refused the first launch |
| `lib/` | 13 | All scout launches were refused. The worker read every file itself. See "Limits". |
| `packages/` | 14 | npm README extended under `## Package contract` |
| `app/`, `config/` | 15 | |
| `scripts/`, `docker/`, `tools/`, `docs/` | 19 | Three existing READMEs extended under `## Directory contract` |
| root | 1 | `## Repository blueprint` inserted before "Contributing and security" |

Left out on purpose: `tests/` (test-only tree) and `public/` (the static export copies everything in `public/` to the live site, so a README there would be published). The root README describes both.

## Checks run on the output

* Every relative link in the 76 worker files resolves to an existing file.
* 1,434 `file:symbol` citations in 57 files were checked against the named source file. Every symbol is present.
* In the 14 `app/` and `config/` READMEs, 165 of 169 backticked identifiers appear in that directory's source. The other 4 are child component names that `app/README.md` mentions.
* Every package README has Interface, Invariants, Side Effects, and Verification sections.
* No em dash, en dash, or double hyphen in new prose. Three hits are in text that predates this run.

## Limits

* The citation check proves a symbol exists in the file. It does not prove the sentence about it is true. Four files were read in full as samples.
* `lib/` did not get fresh-context scouts. One worker read about 17,700 lines and wrote 13 READMEs from its own reading. `lib/README.md` (409 lines) and `lib/sync/README.md` (320 lines) are the files most worth a second reader.
* `lib/whats-new/whats-new.json` was read for shape only (first 40 lines).
* No worker ran a script, a build, or TLC. Statements about script behavior come from reading.
* Several READMEs quote numbers that will change (dependency versions in the npm README contract, coverage thresholds, `PULL_CURSOR_VERSION` 4, schema version 17). These are new places for drift.
* `docs/README.md` lists only the two child directories that hold source (`diagrams`, `formal`). The other eleven folders under `docs/` are not indexed.

## Disagreements between existing docs and code

Workers left the existing text alone and reported these. None was verified by running anything.

### `packages/mcp-server/README.md` (published to npm)

1. Says writes are paced and retried once after a 429. In code `WriteRateLimiter` is used only by `deleteTask` and bulk writes. `createTask` and `updateTask` call PocketBase without it.
2. Says the cache is invalidated after every write. The dependency-cleanup updates that follow a delete (`src/write-ops/dependency-cleanup.ts`) do not invalidate it.
3. "Available Tools" documents 19 tools and has no entry for `get_top_three`. The Architecture tree in the same file says 20 tools.
4. The Architecture tree omits several source files (`top-three.ts`, `types.ts`, `input-schemas.ts`, `recurrence.ts`, `dependency-cleanup.ts`, `write-rate-limiter.ts`, `tools/prompts.ts`).
5. `test-in-claude.sh` prints a v0.5.0 banner and suggests a path without this checkout's `GSD/` segment.

### `docker/README.md`

6. "Custom PocketBase Version" says to override only `POCKETBASE_VERSION`. The Dockerfile checks the archive against `POCKETBASE_SHA256_AMD64` and `POCKETBASE_SHA256_ARM64`, so another version fails unless those are passed too.
7. Says to set `NEXT_PUBLIC_POCKETBASE_URL` at build time. The Dockerfile declares no `ARG` or `ENV` for it, and `.dockerignore` leaves out `.env` files.
8. The diagram shows all `/api/*` going to PocketBase. The Caddyfile returns 404 for the superuser, admin, feedback-controls, and `oauth2-redirect` paths.
9. The Tasks Collection Schema table omits `focus_date` and `focus_rank`. It calls the default certificate "self-signed"; the Caddyfile uses `tls internal`, a local CA.

### `docs/diagrams/`

10. `reminder-model/README.md` says each `Break*` config checks only the rule its break should break. All three also list `INVARIANT TypeOK`.
11. `reminder-model/README.md` says `RemindersFixed.cfg` has 76 states. `generate-reminder-statechart.py:PAGE` hard-codes "41 states checked".
12. Both model READMEs say the comment above each action names the function it models. Several actions have no such comment.

### Workspace notes

13. The workspace `CLAUDE.md` (not in this repo) says the pull contract version is 3. `lib/constants/sync.ts` sets `PULL_CURSOR_VERSION` to 4.
14. `lib/feedback/nudge-eligibility.ts:utcDay` has a comment saying it matches how streaks bucket days. `lib/analytics/streaks.ts` buckets by local day.
15. `components/about`: only two of nine files declare `"use client"`. The repo `CLAUDE.md` says all components use it.
16. `tools/stagehand` has no `package.json` of its own. Its dependencies and the `smoke` script live in the root `package.json`. Project notes describe it as an isolated package.

## Possible script defects seen while reading

Not documented as facts in any README. None was reproduced.

* `docs/formal/sync-convergence/check.sh` may abort under `set -e` and `pipefail` before printing its error line when the TLC log has no state-count line.
* `docker-entrypoint.sh` has a comment "wait for either process", but `wait PID PID` waits for both.
* `scripts/setup-pocketbase-collections.sh` prints that the third index is on `updated`. The code indexes `client_updated_at`.
* `scripts/verify-pb-encryption.sh` names PocketBase 0.39.10 in its header. `run-pocketbase-system-test.sh` pins 0.40.4.
* `scripts/build-local.sh` deletes `.next-cache`, `.next`, and `out` relative to the current directory, not the repo root.
* `tools/stagehand/verify.ts` usage text omits the `storage` and `trash` seeds that `args.ts` accepts.
* `docs/diagrams/generate-reminder-statechart.py` overwrites its output at import time, with no `__main__` guard.
* `docs/formal/sync-convergence/check.sh` and `task-tombstones/check.sh` leave their temp folder under `TMPDIR`.

## A test that is red, and was red before this run

`tests/data/documentation-currentness.test.ts` fails on "keeps the README release and shipped-shell claims current". The root `README.md` line 7 says `Current version: 14.8.1` and `package.json` is at 14.8.5. This run did not touch line 7 (the root diff is 99 added lines, 0 removed). The latest commit on `main`, `chore: updated version number`, bumped the package without the README. The other four tests in that file pass with the new blueprint section in place. The full suite was not run, since no source changed.

## Link to the earlier review

The review of `docs/uml-diagrams.md` (action A7 in `consolidated_review_report.md`) found that the rule "a task write and its sync queue row share one transaction" had no written home for ordinary writes. It now has two: `lib/tasks/crud/README.md` (Invariants) and the root README's Global Invariants, both citing `lib/tasks/crud/helpers.ts:runTaskSyncTransaction`.
