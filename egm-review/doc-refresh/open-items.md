# Document refresh, 2026-11-12: open items

The refresh corrected documents against the code. It changed no code. This page lists what the reviewers found that a document edit could not settle. Each item came from reading the code. Nothing here was run, so treat every code item as a lead to confirm.

The round reports in the folders beside this file hold the evidence for each item.

## Questions only the owner can answer

1. Which hooks does the hosted server load? ADR 0016, `lib/sync/pb-account-deletion.ts:18`, and `lib/sync/sign-out-everywhere.ts:7` say none. Web sign-in needs `/api/gsd/oauth-callback`, which only `docker/pb_hooks/oauth_web_redirect.pb.js` serves. The feedback and account deletion specs also rely on hooks.
2. How did `saved_at` reach the hosted collection? ADR 0018 says to deploy the backend migration first. The repo rule says hosted never runs `docker/pb_migrations`, and `scripts/update-pocketbase-tasks-schema.sh` does not add the field.
3. Does the hosted PocketBase have a backup? `docs/architecture.html` still says it has none. The repo shows only a manual `docker cp` in `docker/README.md`.
4. Should `docs/architecture.html` and `docs/cloud-sync-explainer.html` stay living overviews? Neither covers weekly sweep, top three, account deletion, or resurrect on sight.
5. Should the pipeline page be redrawn? Its three diagrams and the separation matrix still draw the July 2026 design. Captions now say so.
6. Should the privacy page list more flows? It omits account deletion, sign out everywhere, token refresh, the sign-in hover prefetch, the share dialog, and WebMCP registration.
7. `SECURITY.md` says local-only mode makes no background network calls. `app/layout.tsx:250` always emits a preconnect to the hosted sync server. Change the code or the claim.
8. `coding-standards.md` names Biome, a commitlint hook, and a magic-number lint rule. None exists in the repo.
9. `README.md` says update prompts are user-controlled. `public/sw.js:48` calls `skipWaiting()` with no condition.
10. Three `SECURITY.md` edits need a second look: the sign-in hover prefetch is now disclosed, the history rewrite must cover commit `f3e5edf`, and `NEXT_PUBLIC_BASE_URL` replaced the Sentry variable in the permitted list.
11. `tasks/formal-findings-backlog.md` marks `WEB-LATE-AUTH-REFRESH` as fixed. Only half shipped: `refreshAuthOutcome` in `lib/sync/pb-auth.ts` still saves a late refresh response with no session check.
12. The escalation spec says its corpus pins dependencies, tags, subtasks, and archive and Trash rows. `escalation-corpus.json` covers recurrence and snooze only. Closing this may need new cases in three repos.
13. The conditional delete spec describes work that is not built. iOS and Android send a delete even when the remote has no usable stamp, which the design does not cover.

## Possible code defects

### Sync and data

- `lib/tasks/import-export.ts:244` and `:373`: an import can leave one id in two lifecycle tables (issue #724).
- `lib/tasks/crud/helpers.ts:66`, `lib/trash.ts:49`, `lib/archive.ts:83`, `:152`, `:202`, `lib/tasks/import-export.ts:222`: `sync_config` is read before the transaction opens (issue #735).
- `lib/sync/pb-sync-engine.ts:254` and `:338`: the pull contract stamp and the backfill push ignore `skippedCount`. A skipped row gets no repair, and its next push can clear the server's top three pick.
- Dependency cycles: `updateTask`, JSON import, and sync pull store a cycle with no check. `validateDependencies` and `addDependency` have no production caller. The edit drawer and the MCP server do check (ADR 0008).
- `lib/sync/pb-pull.ts:168`, `lib/sync/pb-sync-engine.ts:134`, `lib/tasks/import-export.ts:284`: three ways out of Trash do not forget the resurrect id.
- `lib/sync/pb-push.ts:278` and `:323`: push does not check that the task is still live on this device (`WEB-STALE-DELETE-RESTORE`, `WEB-RETRIED-EDIT-RECREATES`).
- `lib/sync/queue.ts:150` with `lib/sync/health-monitor.ts:104`: a row that runs out of retries never sends again. The hint tells the user to clear it in sync history, and no UI does that.
- `lib/sync/pb-auth.ts:369-392`: a 403 counts as a rejected session. The rule says only a 401 counts.
- `lib/sync/sync-coordinator.ts:113-131`: a user-triggered sync skips the backoff and the retry cap.
- `lib/sync/sync-status-store.ts:200`: a running background sync is not rescheduled when the interval changes (CFG-01).
- `lib/sync/pb-sync-helpers.ts:293`: the far-future hold-off runs on every pull and on realtime. Top three C4-7 limits it to a backfill.
- `lib/top-three.ts`: the corpus pins `pullMerge`, and no engine code calls it. Lines 99 and 153 compare dates as raw text.
- `lib/tasks/crud/list.ts:28-33`: `clearTasks` clears `tasks` with no transaction and has no known caller.

### App behavior

- `components/delete-account-dialog.tsx:79-89`: a rejected session shows a toast and clears no auth, except for a 401 at the first step.
- `lib/reset-local-data.ts:126-138` and `lib/reset-everything.ts`: a throw from `resetWeeklySweepState()` fails the step after IndexedDB is empty, and the reset marker is written before `disableSync`.
- `components/settings-page/use-settings-data.ts:78-83`: a failed Settings load leaves the spinner up.
- `components/settings/sweep-reminder-rows.tsx`: a denied notification permission still saves the reminder as on.
- `components/weekly-sweep/use-sweep-session.ts:81` and `:90`: the end links stamp a second time. New date and Add date have no Undo.
- `lib/escalation.ts:35-58`: an unparseable `dueDate` gives `NaN` days, and the task escalates.
- `lib/utils.ts:96-106` with the due chip: a task due earlier today never reads as late.
- `components/today-strip/today-menu-context.tsx:40`: an overflow pick shows a disabled "Today is full", not "Remove from today".
- `handleSaveForLater` passes `error.message` to a toast. `importTasks` does not report dropped records.
- `public/sw.js:163`, `:184`, `:347`: the page cache path has no basic-response check, a failed path falls back to `/`, and one `console.error` prints a raw error object.
- `lib/logger.ts:212-223` and `lib/error-logger.ts:48-50`: error message text reaches the console with token masking only.
- No route to "Sign out of all devices" for a healthy signed-in session (`components/sync/sync-button.tsx`).

### Tooling, tests, and scripts

- `.agents/skills/source-command-build-next/SKILL.md` and `.agents/skills/source-command-triage-prs/SKILL.md`: live copies of the retired builder and night shift procedures.
- `scripts/triage-run.sh:34-58`: a failed lookup prints `NO_WORK`, and the pause check fails open.
- `.claude/commands/release.md` step 8 tags local HEAD, not `main`.
- `tests/fixtures/index.ts:424-436`: `expectToReject` can pass wrongly.
- `tests/data/weekly-sweep-preferences.test.ts:59-77`: nothing pins the clearing of the third sweep key.
- Two tests the notify-before spec names were never written, one on web and one in the MCP server.
- `scripts/prev-release-tag.cjs`, `scripts/telemetry-metrics.cjs`, `scripts/extract-run-tokens.cjs`: no caller outside their own tests.
- `.github/ISSUE_TEMPLATE/change_request.yml:57-58`: says the risk tier drives the builder. Nothing reads the label.
- `scripts/verify-pb-encryption.sh:16` names PocketBase 0.39.10. The image pins 0.40.4.
- `.claude/hooks/block-sensitive-files.sh` and `.claude/hooks/no-main-commits.sh`: a pattern gap and a working-directory issue.
- Knip does not check unused exports in CI. The Phase 5 restructure is unfinished, with a 2026-12-31 deadline.
- MCP server: the README pins 1.4.1 and describes unreleased behavior, and `refreshPrincipal` renews the token against the "no renewal" decision.
- The Docker Caddyfile `form-action` lacks Apple.

### Stale code comments

- `lib/sync/types.ts:90`, `lib/sync/pb-push.ts:5`, `lib/sync/pocketbase-client.ts:5-6`, `lib/sync/pb-realtime.ts:89`, `tests/e2e/recurring-tasks.spec.ts:7`.

## Design system mismatches

- Card radius is 14px in code and 12px in `DESIGN.md`. Dialog radii sit off the ladder.
- The Q4 color marks blocking status and Snooze. Tide appears on non-interactive marks.
- `.matrix-grid`, `.matrix-card`, and `--shadow-fab` are unused. The Inkwell version comment says 1.3.1, and the system is 1.4.0.
- `.ui-craft/patterns.md` is an unfilled template.

## Documents not fully settled

These batches hit the five-round cap without two clean rounds in a row. No Blocker or Major is open in any of them.

- L1 core docs, L2 security docs, L3 design docs, L4 rules and ops, L5 MCP and Docker, S1 `tasks/spec.md`.
- S2 sync specs: one clean round.
- S3 product specs: one round 5 fix has no later review.
- H1 HTML: the two round 5 fixes were checked against the code by hand.

## What nobody could check

- Anything about the live hosted server, GitHub settings, or the launchd jobs on the host.
- Every iOS and Android statement that is not in this repo.
- PR numbers and dates beyond what `git log` shows locally.
- How the HTML pages render. The new diagram labels were sized by character count.
