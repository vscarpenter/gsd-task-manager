# Doc refresh: D1-adr-early, round 1

Status: resolved
Clean round: no

Targets: `docs/adr/0001` to `0010` (mode NOTE). The resolver left every status line and all Context, Decision, Consequences, and Alternatives text alone. It added one `Status note, 2026-11-12` block to 8 files, after the Deciders line or after an existing amendment note. Every note claim was confirmed in the code first. `git diff -- docs/adr` was empty for these 10 files at the start. No test under `tests/` asserts a string from these files.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A | 0001 to 0005, full files | ran |
| egm-codebase-details B | 0006 to 0010, full files | ran |

## Findings

Line numbers are the pre-edit ones.

### D1-adr-early-1-1 [accuracy A] Severity: Major
* Target: 0001 line 27
* Finding: migrations are said to live in `lib/db.ts`. `lib/db.ts:29` calls `registerDatabaseVersions`; versions 1 to 17 are registered in `lib/db-migrations.ts:217-236`.
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: status note, first sentence.

### D1-adr-early-1-2 [accuracy A] Severity: Major
* Target: 0001 line 20
* Finding: "no data leaves the device unless the user opts into sync". `lib/feedback/submit-feedback.ts:50-60` posts a feedback payload with no sign-in; `components/settings/use-feedback-form.ts:70` calls it on send.
* Decision: PROPOSE FIX
* Reason: Confirmed. The note states the fact and does not rewrite the privacy statement.
* Edit: status note, third sentence.

### D1-adr-early-1-3 [accuracy A] Severity: Nit
* Target: 0001 line 13
* Finding: the export is now a versioned envelope (ADR 0014).
* Decision: PROPOSE FIX
* Reason: One pointer sentence, since a note was being added anyway.
* Edit: status note, second sentence.

### D1-adr-early-1-4 [accuracy A] Severity: Major
* Target: 0002 lines 15, 28
* Finding: "stored as plaintext". `docker/docker-entrypoint.sh:6-9` refuses to start without a 32-character `GSD_TASKS_ENC_KEY`, and `docker/pb_hooks/tasks_encryption.pb.js` exists. The existing note covers only the hosted service.
* Decision: PROPOSE FIX
* Reason: Confirmed in the entrypoint and the hooks folder.
* Edit: status note, third and fourth sentences.

### D1-adr-early-1-5 [accuracy A] Severity: Major
* Target: 0002 line 23
* Finding: the SDK is said to refresh the token. `ensureValidAuth` (`lib/sync/pb-auth.ts:412-425`) refreshes within `AUTH_REFRESH_THRESHOLD_SECONDS`, 7 days (`:38`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, second sentence.

### D1-adr-early-1-6 [accuracy A] Severity: Major
* Target: 0002 lines 15, 21
* Finding: sign-in uses the manual code flow with PKCE (`pb-auth.ts:1-11`, `:203`; `lib/sync/oauth-callback.ts:19`), not the SDK's realtime `authWithOAuth2` form.
* Decision: PROPOSE FIX
* Reason: Confirmed in the file header and the call site.
* Edit: status note, first sentence.

### D1-adr-early-1-7 [accuracy A] Severity: Nit
* Target: 0002 line 15
* Finding: Apple provider missing.
* Decision: DECLINE
* Reason: The existing amendment note already covers it.
* Edit: none

### D1-adr-early-1-8 [accuracy A] Severity: Nit
* Target: 0002 line 22
* Finding: the API rule is quoted without its `@request.auth.id != ""` half.
* Decision: DECLINE
* Reason: Small, and the rule's intent is unchanged.
* Edit: none

### D1-adr-early-1-9 [accuracy A] Severity: Major
* Target: 0003 line 15
* Finding: plain "newer wins" now has exceptions: tombstones (`lib/sync/pb-pull.ts:154-157`), equal timestamps during a backfill (`pb-pull.ts:73-77`), far-future stamps, and queued deletes.
* Decision: PROPOSE FIX
* Reason: Confirmed the tombstone and backfill rules in `pb-pull.ts`. ADRs 0013, 0015, 0019, and 0020 own them. The far-future rule is in the existing amendment note.
* Edit: status note, sentences 1 to 3.

### D1-adr-early-1-10 [accuracy A] Severity: Major
* Target: 0003 line 28
* Finding: "the entire task record is overwritten". `pocketBaseToTaskRecord` keeps local reminder state and `parentTaskId` (`lib/sync/task-mapper.ts:226-236`, `:273-274`); `unreadFieldRepair` copies unread fields into a winning local row (`pb-pull.ts:86-101`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, sentences 3 and 4.

### D1-adr-early-1-11 [accuracy A] Severity: Major
* Target: 0003 line 21
* Finding: "Deterministic" no longer holds, since outcomes depend on device-local tombstones and queue rows.
* Decision: DECLINE
* Reason: It follows from 1-9 and 1-10, which the note covers. A separate sentence would restate them. Severity unchanged.
* Edit: none

### D1-adr-early-1-12 [accuracy A] Severity: Nit
* Target: 0003 line 7 (existing note), line 20
* Finding: `isBeyondClockSkew` has one caller; two other ceiling checks are inline.
* Decision: DECLINE
* Reason: The existing note is not wrong, and the brief says to leave existing text alone.
* Edit: none

### D1-adr-early-1-13 [accuracy A] Severity: Blocker
* Target: 0004 lines 15, 17-20
* Finding: the worker is said to cache the whole shell on install in one cache. `public/sw.js:20-50` precaches 8 page URLs and 5 runtime files into two of three caches (`lib/sw-cache-logic.ts:67-76`). ADR 0012 made that change.
* Decision: PROPOSE FIX
* Reason: Confirmed in `sw.js`, `sw-cache-logic.ts`, and ADR 0012.
* Edit: status note, sentences 1 to 3.

### D1-adr-early-1-14 [accuracy A] Severity: Major
* Target: 0004 line 15
* Finding: "serves cached assets". Pages are network-first (`sw.js:150-190`); only `/_next/static/` and a runtime allowlist are cache-first.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, sentences 3 to 5.

### D1-adr-early-1-15 [accuracy A] Severity: Major
* Target: 0004 line 19
* Finding: no `fonts/` directory under `public/`; the worker does not precache fonts.
* Decision: PROPOSE FIX
* Reason: `ls public` shows no fonts folder. The existing note says where fonts live; the new note says what the install step precaches.
* Edit: covered by status note, sentence 2.

### D1-adr-early-1-16 [accuracy A] Severity: Nit
* Target: 0004 line 28 and the existing note
* Finding: three small points: first-load offline, the scope of `test:pwa`, and exceptions to the rewrite rule.
* Decision: DECLINE
* Reason: Small, and two concern existing note text.
* Edit: none

### D1-adr-early-1-17 [accuracy A] Severity: Nit
* Target: 0005 lines 22, 28, 35
* Finding: deletes default to dry run; create skips the cycle search because the id is new; a setup wizard exists.
* Decision: DECLINE
* Reason: The ADR's claims hold (20 tools, names, Node 18+, env names, TTL cache, dryRun on all 5 write tools). The code still follows the decision, so no note.
* Edit: none

### D1-adr-early-1-18 [accuracy B] Severity: Major
* Target: 0006 line 15
* Finding: `trends.ts` exports `getCompletionTrend` and `getRecurrenceBreakdown` (`lib/analytics/trends.ts:9`, `:64`), no week-over-week comparison. `metrics.ts` has no score (`:53`, `:180`).
* Decision: PROPOSE FIX
* Reason: Confirmed by the export list and a search for "score".
* Edit: status note, sentences 1 and 2.

### D1-adr-early-1-19 [accuracy B] Severity: Major
* Target: 0006 lines 15, 20
* Finding: the functions read the clock (`metrics.ts:54`, `streaks.ts:57`, `:93`, `trends.ts:10`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, sentence 4.

### D1-adr-early-1-20 [accuracy B] Severity: Nit
* Target: 0006 lines 15, 23
* Finding: module list omits `completion-day.ts`; a module-level import reaches the database layer; composition examples differ.
* Decision: PROPOSE FIX for `completion-day.ts` (one sentence), DECLINE for the rest.
* Reason: `ls lib/analytics` confirms the file. The other two are small.
* Edit: status note, sentence 3.

### D1-adr-early-1-21 [accuracy B] Severity: Blocker
* Target: 0007 line 13
* Finding: `settings.ts` is said to hold per-task preferences. It reads and writes one row, `db.notificationSettings.get("settings")` (`lib/notifications/settings.ts:18`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, sentence 1.

### D1-adr-early-1-22 [accuracy B] Severity: Major
* Target: 0007 lines 13, 20
* Finding: nothing queries the `notificationSent` index. The checker filters the table (`lib/notification-checker.ts:94`) and reads the field (`:157`). It is one flag per task, reset on a due-date or offset change (`lib/tasks/crud/update.ts:138-148`) and on snooze (`lib/tasks/crud/snooze.ts:17`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, sentences 2 and 3.

### D1-adr-early-1-23 [accuracy B] Severity: Major
* Target: 0007 line 22
* Finding: the badge is not an overdue count. `getDueSoonCount` counts open, non-saved tasks inside their reminder window (`notification-checker.ts:312-340`).
* Decision: PROPOSE FIX
* Reason: Confirmed. ADR 0018 lines 13-14 exclude Saved items.
* Edit: status note, sentence 4.

### D1-adr-early-1-24 [accuracy B] Severity: Major
* Target: 0007 line 13
* Finding: "four files" is out of date; the folder also holds `reminder-window.ts` and others, and the checker sits outside it. The check also gates on quiet hours, snooze, and a reset lock.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls lib/notifications`. The note names the two files a reader needs and does not list every gate.
* Edit: status note, sentences 2 and 5.

### D1-adr-early-1-25 [accuracy B] Severity: Nit
* Target: 0007 lines 13, 27
* Finding: a `new Notification()` fallback exists; permission also prompts from the sweep reminder; a code comment disagrees on Safari badge support.
* Decision: DECLINE
* Reason: Small. Browser support cannot be settled from the code.
* Edit: none

### D1-adr-early-1-26 [accuracy B] Severity: Blocker
* Target: 0008 line 20
* Finding: `addDependency` (`lib/tasks/dependencies.ts:12-28`) does not call `wouldCreateCircularDependency`.
* Decision: PROPOSE FIX for the note; ESCALATE the code gap.
* Reason: Confirmed by reading the file. The ADR decided the rule, so the gap is listed under "Possible code defects". The note states where the check runs today and does not bless the gap.
* Edit: status note, sentences 1 and 2.

### D1-adr-early-1-27 [accuracy B] Severity: Blocker
* Target: 0008 lines 20, 26
* Finding: no single gate exists. `addDependency` and `removeDependency` have no caller outside tests; `lib/dependencies.ts:validateDependencies` (`:165`) has none either. `updateTask` merges `dependencies` unchecked (`lib/tasks/crud/update.ts:111`). The web check is `findDependencyCycleError` (`components/matrix-simplified/edit-drawer-dependencies.tsx:19-33`), called at save in `use-drawer-save.ts:38-44`. JSON import and sync pull do no cycle check.
* Decision: PROPOSE FIX for the note; ESCALATE the code gap.
* Reason: Confirmed each path with `rg` and by reading the files. No match for "circular" or "cycle" in `lib/tasks/import-*.ts` or `lib/sync/`.
* Edit: status note, sentences 2, 3, and 5.

### D1-adr-early-1-28 [accuracy B] Severity: Major
* Target: 0008 lines 20, 26
* Finding: the MCP server uses its own copy (`packages/mcp-server/src/dependencies.ts:21`, `:71`), not the `lib/` function. It runs before the dry-run return, so both modes.
* Decision: PROPOSE FIX
* Reason: Confirmed (`task-operations.ts:72`, `:159`, `:295`).
* Edit: status note, sentence 4.

### D1-adr-early-1-29 [accuracy B] Severity: Nit
* Target: 0008 lines 13, 33
* Finding: the parameter is `dependencyId`; the cleanup pass runs on task delete.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### D1-adr-early-1-30 [accuracy B] Severity: Blocker
* Target: 0009 line 15
* Finding: the `smartViews` table arrived in Dexie version 4 (`lib/db-migrations.ts:30`, `:221`), not 13.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note, sentence 2.

### D1-adr-early-1-31 [accuracy B] Severity: Blocker
* Target: 0009 line 15
* Finding: "Due Today", "Overdue", and "No Due Date" are not built-in names. `lib/smart-views/built-in.ts` holds 9 others.
* Decision: PROPOSE FIX
* Reason: Confirmed by the `name:` lines.
* Edit: status note, sentence 3.

### D1-adr-early-1-32 [accuracy B] Severity: Major
* Target: 0009 lines 11, 15, 27
* Finding: the web can no longer save a view. Only import writes `db.smartViews` (`lib/tasks/import-export.ts:311`, `:327`); `lib/smart-views.ts:73-78` says creation is web-absent.
* Decision: PROPOSE FIX
* Reason: Confirmed by a search for writers. The existing ADR 0011 note covers pins and shortcuts only.
* Edit: status note, sentence 1.

### D1-adr-early-1-33 [accuracy B] Severity: Major
* Target: 0009 line 15
* Finding: `SmartView` has no `color`; `FilterCriteria` has no urgency or importance fields (`lib/smart-views/types.ts:4-38`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The note points at the types file and lists no fields.
* Edit: status note, sentence 4.

### D1-adr-early-1-34 [accuracy B] Severity: Nit
* Target: 0009 lines 15, 21, 23
* Finding: pin limit survives as unused data; export caps at 100 views; ids derive at read time.
* Decision: DECLINE
* Reason: Small, or covered by the existing note.
* Edit: none

### D1-adr-early-1-35 [accuracy B] Severity: Nit
* Target: 0010 lines 53-81
* Finding: 7 small omissions (source file names, a path guard, extra headers, `Cache-Control` stamps). All named files, functions, scripts, skills, and the test exist and match.
* Decision: DECLINE
* Reason: The code still follows the decision, so no note.
* Edit: none
