# Doc refresh: S3-product-specs, round 1

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/spec-top-three.md | ran |
| egm-codebase-details | tasks/spec-weekly-sweep.md | ran |
| egm-codebase-details | tasks/spec-escalation.md, tasks/spec-whats-new.md | ran |
| egm-codebase-details | tasks/spec-command-palette-v9.md, tasks/spec-ios27-refresh.md, tasks/editorial-web-redesign-spec.md, tasks/editorial-restore-handoff.md | ran |
| egm-style | all eight files | ran |

Line numbers are the reviewer's, from the file as it stood when that reviewer ran.

## Findings

### spec-top-three.md

### S3-1-1 [accuracy] Severity: Blocker
* Target: spec-top-three.md lines 3, 230, 339-343
* Finding: "Not implemented on any client." Web and MCP ship it: `lib/top-three.ts`, `lib/tasks/top-three-actions.ts`, `components/today-strip/`, `lib/constants/sync.ts:64` (contract 4), `lib/tasks/import-export.ts:25` (2.2.0), `packages/mcp-server/src/top-three.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed in each file and in `git log` (#676, #696, #698, #703, #679, #707).
* Edit: Added a dated "Web status" line under the status line. The original status line stays.

### S3-1-2 [accuracy] Severity: Blocker
* Target: spec-top-three.md lines 285-287, 322
* Finding: The draft `docker/pb_migration_drafts/1794844800_top_three.js.draft` is gone. The migration is `docker/pb_migrations/1794061500_top_three.js`, and both schema scripts carry the fields.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls docker/` and `rg focus_date scripts/`.
* Edit: Added a dated "Shipped" paragraph in "Self-hosted Docker". Plan text stays.

### S3-1-3 [accuracy] Severity: Blocker
* Target: spec-top-three.md lines 147, 168
* Finding: `buildSyncConfig` no longer writes a literal `pullCursorVersion: 2`. `components/sync/use-sync-auth-dialog.ts:221` keeps the stored value.
* Decision: PROPOSE FIX
* Reason: Confirmed at that line.
* Edit: One dated note at the top of section 6 "Requirements" covers S3-1-3 to S3-1-6. The web bullets stay as the record of why each change was needed.

### S3-1-4 [accuracy] Severity: Blocker
* Target: spec-top-three.md lines 151-152
* Finding: `fullSync` pushes first. Now `runSyncPasses` (`lib/sync/pb-sync-engine.ts`) pulls first while a backfill is owed. `reconcileDeletedTasks` is called at `pb-pull.ts:256`.
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: Section 6 note. Line reference changed to `pb-pull.ts:256`.

### S3-1-5 [accuracy] Severity: Blocker
* Target: spec-top-three.md line 158
* Finding: Sign-out now keeps the stored version (`lib/sync/config/disable.ts:48`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Section 6 note.

### S3-1-6 [accuracy] Severity: Blocker
* Target: spec-top-three.md lines 173, 176
* Finding: `upsertRemoteTask` (`lib/sync/pb-push.ts:149`) now takes the placement keys from the current row through `placementToWire`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-push.ts` and `task-mapper.ts`.
* Edit: Section 6 note.

### S3-1-7 [accuracy] Severity: Major
* Target: spec-top-three.md lines 317, 111
* Finding: The surface is `components/today-strip/`, mounted from `components/matrix-simplified/index.tsx`. Writes live in `lib/tasks/top-three-actions.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing the folder and reading the actions file.
* Edit: Section 11 "Rules" and "Surface" web cells.

### S3-1-8 [accuracy] Severity: Major
* Target: spec-top-three.md line 163
* Finding: The web Saved check is `savedPlacementBlocker` in `lib/tasks/saved-placement.ts`, not lines 14-17 of `saved.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed. `saveTaskForLater` and `unreadFieldRepair` both call it.
* Edit: Name and path corrected in C4-4.

### S3-1-9 [accuracy] Severity: Major
* Target: spec-top-three.md lines 153, 161, 178
* Finding: The spec limits the web far-future hold-off to a backfill and says ordinary pulls and realtime don't change (C4-7). Web holds off on every pull and in realtime (`holdsOffFarFutureRemote`, `lib/sync/pb-sync-helpers.ts:293`, called from `pb-pull.ts:143` and `pb-sync-engine.ts:81`, from #700).
* Decision: ESCALATE
* Reason: C4-7 is a cross-client contract statement. The web code alone can't settle whether the spec should widen.
* Edit: none

### S3-1-10 [accuracy] Severity: Major
* Target: spec-top-three.md line 207
* Finding: The corpus pins `pullMerge`, but no engine code calls it. The engine uses `unreadFieldsToCopy` and its own `acceptsRemoteVersion`. `pullMerge` compares `updatedAt` as text; the engine compares parsed instants.
* Decision: ESCALATE
* Reason: The spec states how clients should factor the rule and the code differs. Listed as a possible code defect.
* Edit: none

### S3-1-11 [accuracy] Severity: Major
* Target: spec-top-three.md lines 35, 71
* Finding: `lib/top-three.ts:99` and `:153` compare `updatedAt` and `dueDate` as raw text, as does the MCP copy. Mixed ISO forms (offset and `Z`) would sort wrongly.
* Decision: ESCALATE
* Reason: Possible code defect. The reviewer did not confirm a failing input, and neither did I.
* Edit: none

### S3-1-12 [accuracy] Severity: Major
* Target: spec-top-three.md lines 43-50
* Finding: Section 3.2 says its four rows are the only writes. Web has `reorderPicks` (drag), which rewrites ranks to 1..n by position and so closes a rank gap. `movePick` also rewrites `focusDate` on both rows.
* Decision: ESCALATE
* Reason: The spec states a rule and the code does something else. Section 4 allows drag but does not define its write. Possible code defect.
* Edit: none

### S3-1-13 [accuracy] Severity: Major
* Target: spec-top-three.md lines 228, 321
* Finding: `saved_at` lines in `packages/mcp-server/src/types.ts` moved to 184 and 208. The handler is `tools/handlers/top-three-handler.ts`, and the rules copy is `src/top-three.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed. The "MCP 1.4.0 doesn't send the keys" sentence is about a published build and stays.
* Edit: Line references and the section 11 MCP file list.

### S3-1-14 [accuracy] Severity: Major
* Target: spec-top-three.md line 230
* Finding: `get_top_three` also returns `date` and `timeZone`, uses a fixed 2-day window, and rejects an unknown zone.
* Decision: PROPOSE FIX
* Reason: Confirmed in `top-three-handler.ts:12-50`.
* Edit: Added a dated "Shipped" bullet in section 8.

### S3-1-15 [accuracy] Severity: Nit
* Target: spec-top-three.md line 215
* Finding: `BACKUP_ENVELOPE_VERSION` is at `import-export.ts:25`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: `:24` to `:25`.

### S3-1-16 [accuracy] Severity: Nit
* Target: spec-top-three.md line 159
* Finding: The reset stamp is `lib/reset-local-data.ts:40`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: `:39` to `:40`.

### S3-1-17 [accuracy] Severity: Nit
* Target: spec-top-three.md line 153
* Finding: `clampClientTimestamp` is at `task-mapper.ts:30-35`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Line range corrected.

### S3-1-18 [accuracy] Severity: Nit
* Target: spec-top-three.md line 131
* Finding: The five encrypted fields are listed in `docker/pb_hooks/encryption-core.js:7-8`.
* Decision: PROPOSE FIX
* Reason: Confirmed: two text fields and three JSON fields.
* Edit: Path corrected.

### S3-1-19 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 124-125
* Finding: Web types the pair as optional (`undefined`), not `null` (`lib/types.ts:46-47`).
* Decision: DECLINE
* Reason: The table's client column covers three clients, and the wire and backup shapes are right.
* Edit: none

### S3-1-20 [accuracy] Severity: Nit
* Target: spec-top-three.md line 110
* Finding: An overflow pick's card shows a disabled "Today is full", not "Remove from today" (`today-menu-context.tsx:40`). The item is hidden on completed tasks and outside the matrix.
* Decision: DECLINE
* Reason: Small. Noted under possible code defects for the owner.
* Edit: none

### S3-1-21 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 104-112
* Finding: Web adds an inline Remove button, shows the pick toggle whenever a slot is free, and takes a `?pickToday` deep link.
* Decision: DECLINE
* Reason: Additions, not contradictions. `components/today-strip/README.md` owns the detail.
* Edit: none

### S3-1-22 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 143, 157
* Finding: A stored version above this build's triggers no backfill, and a completed pull stamps this build's version over it.
* Decision: DECLINE
* Reason: Edge detail the spec does not contradict.
* Edit: none

### S3-1-23 [accuracy] Severity: Nit
* Target: spec-top-three.md line 285
* Finding: The cited test spans `tests/docker-migrations.test.ts:112-119`; the cited lines fall inside it.
* Decision: DECLINE
* Reason: The reference still lands on the test.
* Edit: none

### spec-weekly-sweep.md

### S3-1-24 [accuracy] Severity: Blocker
* Target: spec-weekly-sweep.md lines 3, 7, 214-219
* Finding: "Not implemented on any client." Web ships it: `lib/weekly-sweep.ts`, `lib/preferences/weekly-sweep.ts`, `components/weekly-sweep/`, `app/sweep/page.tsx`.
* Decision: PROPOSE FIX
* Reason: Confirmed in the files, in `git log` (#685, #695, #697), and in the 14.8.0 entry of `lib/whats-new/whats-new.json`.
* Edit: Added a dated "Web status" line under the status line.

### S3-1-25 [accuracy] Severity: Blocker
* Target: spec-weekly-sweep.md line 192
* Finding: The route file is `app/sweep/page.tsx`, not under `app/(dashboard)/`.
* Decision: PROPOSE FIX
* Reason: Confirmed by reading the file.
* Edit: Path corrected.

### S3-1-26 [accuracy] Severity: Blocker
* Target: spec-weekly-sweep.md line 176
* Finding: `weekly-review` is no longer at `lib/feedback/roadmap-items.ts:36`. #695 retired it, and `tests/data/feedback-payload.test.ts:88-96` pins that.
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: Table cell now says the item is retired. Added a dated line naming the test.

### S3-1-27 [accuracy] Severity: Major
* Target: spec-weekly-sweep.md lines 18, 94-106, 228
* Finding: Web stores a third per-device key, `gsd:weekly-sweep-reminder-fired`, and the spec names no keys.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/preferences/weekly-sweep.ts:9-12, 70-74`. It stays outside sync and backup, so no contract changes.
* Edit: Added a dated "Web" paragraph in section 6. "Both values" text stays.

### S3-1-28 [accuracy] Severity: Major
* Target: spec-weekly-sweep.md line 90
* Finding: The spec says New date uses the client's existing date control, with All day and time of day. The sweep has its own panel of presets and a bare date input (`components/weekly-sweep/sweep-card.tsx:57-76`), and `setDueDay` keeps the task's existing time.
* Decision: ESCALATE
* Reason: The spec states a rule and the code does something else. Possible code defect.
* Edit: none

### S3-1-29 [accuracy] Severity: Major
* Target: spec-weekly-sweep.md lines 43-49
* Finding: "Notes the corpus pins" lists snooze, dependencies, and subtasks. The corpus has one such case, for recurrence and tags (`sweep-corpus.json:1412`).
* Decision: ESCALATE
* Reason: A contract statement about a shared corpus. The fix may be new corpus cases, which touches three repos.
* Edit: none

### S3-1-30 [accuracy] Severity: Major
* Target: spec-weekly-sweep.md line 168
* Finding: The route also needed `ROUTES.SWEEP`, `ROUTE_VARIANTS.SWEEP`, and a `/sweep` entry in `scripts/bundle-budget.json`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/routes.ts` and the budget file. I also confirmed the CloudFront rewrite is generic (`cloudfront-function-url-rewrite.cjs`), so no function deploy is needed.
* Edit: Added a dated "Web" paragraph under the route note.

### S3-1-31 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 194
* Finding: The reminder UI is `components/settings/sweep-reminder-rows.tsx`, and the notification is in `lib/notifications/display.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Section 9 "Reminder" web cell.

### S3-1-32 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md lines 80-88
* Finding: The sweep calls the matrix wrappers (`handleToggle` and others), and `removeTask` repeats the matrix delete toast. A `saved` card's Delete shows the matrix text, not the Saved page's.
* Decision: DECLINE
* Reason: The lib functions named are the ones that run in the end.
* Edit: none

### S3-1-33 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 148
* Finding: The card shows quadrant and relative date as one text line, with no due chip.
* Decision: DECLINE
* Reason: Small presentational difference.
* Edit: none

### S3-1-34 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 53
* Finding: `snoozeTaskNotification` writes `snoozedUntil` without bumping `updatedAt`, but nothing calls it.
* Decision: DECLINE
* Reason: No visible effect today.
* Edit: none

### S3-1-35 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md section 6
* Finding: The web sweep reminder honors the task-reminder sound setting (`lib/notifications/display.ts:187`).
* Decision: DECLINE
* Reason: Undocumented, not contradicted.
* Edit: none

### S3-1-36 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md lines 62-66
* Finding: Done on a session with no cards stamps nothing, and the Done button renders only while a card shows.
* Decision: DECLINE
* Reason: Consistent with "with no cards, stamps nothing".
* Edit: none

### spec-escalation.md

### S3-1-37 [accuracy] Severity: Blocker
* Target: spec-escalation.md line 3
* Finding: "Not yet implemented on any client." Web ships it (`lib/escalation.ts`, `lib/preferences/escalation-window.ts`), released in 14.4.0 by `lib/whats-new/whats-new.json`.
* Decision: PROPOSE FIX
* Reason: Confirmed in the code and the notes file, which also lists Apple 3.7.0 and Android 0.10.2.
* Edit: Added a dated "Web status" line under the status line.

### S3-1-38 [accuracy] Severity: Major
* Target: spec-escalation.md lines 80, 107
* Finding: MCP now holds its own copy of the rule in `packages/mcp-server/src/top-three.ts`, pinned by the 38-case corpus.
* Decision: PROPOSE FIX
* Reason: Confirmed in the file and its corpus test.
* Edit: Added a dated "MCP" paragraph in section 6.

### S3-1-39 [accuracy] Severity: Major
* Target: spec-escalation.md line 43
* Finding: "The due chip, not escalation, says it's late." The web chip shows "Due today" all day: `isOverdue` compares start of day (`lib/utils.ts:96-106`, `components/task-card/due-chip.tsx`).
* Decision: ESCALATE
* Reason: The spec states a behavior and the code does something else. Possible code defect.
* Edit: none

### S3-1-40 [accuracy] Severity: Major
* Target: spec-escalation.md line 67
* Finding: "The weekly sweep and top three will consume the rule." Both do now (`lib/top-three.ts:181`, `lib/weekly-sweep.ts:78`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Covered in the "Web status" line.

### S3-1-41 [accuracy] Severity: Nit
* Target: spec-escalation.md lines 34, 46, 56, 64, 78
* Finding: Five small gaps (reviewer items E5 to E8): the chip does not share `daysUntilDue`; archived cards call the hook; the test passes a partial task; the storage key is not named.
* Decision: DECLINE
* Reason: None misleads a reader about the rule.
* Edit: none

### S3-1-42 [accuracy] Severity: Nit
* Target: spec-escalation.md line 34
* Finding: An unparseable `dueDate` gives `NaN` days, and `evaluateEscalation` then returns escalating (`lib/escalation.ts:35-58`). The help drawer also hard-codes "two days" (`help-drawer-sections.tsx:98`).
* Decision: DECLINE
* Reason: Not a spec error. Both noted under possible code defects.
* Edit: none

### spec-whats-new.md

### S3-1-43 [accuracy] Severity: Major
* Target: spec-whats-new.md line 52
* Finding: The corpus and `parseVersion` also reject leading zeros and suffixes (`whats-new-corpus.json:260, 272`, `lib/whats-new/releases.ts:27-29`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The corpus is the shared contract and this repo is its authority, so the spec must match it.
* Edit: Added a dated "Corpus" line after the sentence. The original sentence stays.

### S3-1-44 [accuracy] Severity: Major
* Target: spec-whats-new.md lines 3, 9, 75
* Finding: Web shipped in 14.7.0, and the notes file carries What's New notes for Apple 3.8.0 and Android 0.11.0.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/whats-new/whats-new.json` and `git log` (#671).
* Edit: Added a dated "Web status" line.

### S3-1-45 [accuracy] Severity: Nit
* Target: spec-whats-new.md line 39
* Finding: The writing rules ban dependency bumps. The web 13.9.9 entry reads "Security updates to the libraries GSD depends on." (`whats-new.json:206`).
* Decision: ESCALATE
* Reason: The spec states a rule and the content breaks it. Owner's call.
* Edit: none

### S3-1-46 [accuracy] Severity: Nit
* Target: spec-whats-new.md lines 21, 25-35, 38, 69
* Finding: Reviewer items W3 and W5 to W7: the files carry a `note` key, the web notes load as a lazy chunk, and a null running version lists every release.
* Decision: DECLINE
* Reason: Detail owned by `lib/whats-new/` and its tests.
* Edit: none

### The four finished documents

### S3-1-47 [accuracy] Severity: Blocker
* Target: spec-command-palette-v9.md (10 reviewer items; lines 4, 9, 23, 52, 70, 71)
* Finding: Shipped in #298, then extended. `AppShell` passes `showSmartViews={smartViewsEnabled}`, a topbar button exists, and the `gsd:new-task` listener is in `use-matrix-window-events.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `app-shell.tsx:17, 131, 175` and `use-matrix-window-events.ts:183`. The batch rule for finished work is one status line, no rewrite.
* Edit: Status note under the title.

### S3-1-48 [accuracy] Severity: Blocker
* Target: spec-ios27-refresh.md (10 reviewer items; lines 20, 39-46, 97, 113)
* Finding: Shipped in #547. The topbar prop is `quietOnScroll`, the gesture is in `SwipeableTaskCard`, the menu has a Snooze submenu, and `handleSnooze` takes minutes.
* Decision: PROPOSE FIX
* Reason: Confirmed in `topbar.tsx:20-39`, `quadrant-pane.tsx:376`, `task-card-actions.tsx:213-223`.
* Edit: Status note under the title.

### S3-1-49 [accuracy] Severity: Blocker
* Target: editorial-web-redesign-spec.md (11 reviewer items; lines 3, 16-17, 26, 33, 37-39, 44, 54)
* Finding: Shipped in #353, then superseded by Violet Frost (#465) and the restore (#502). Newsreader loads through `next/font/local`, `--ink-3` changed, and `--q*-fill` is gone.
* Decision: PROPOSE FIX
* Reason: Confirmed in `app/layout.tsx:3`, `inkwell-tokens.css:3, 74`, `globals.css:163-186`.
* Edit: Status note under the title.

### S3-1-50 [accuracy] Severity: Blocker
* Target: editorial-restore-handoff.md (10 reviewer items; lines 1, 13, 22, 25, 32)
* Finding: The handoff's work is done. The theme test is renamed, `app/design-lab` is gone, and the acceptance grep now matches the retired-color guard in `tests/data/editorial-theme.test.ts:93`.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls` and `git log` (#502, 2026-08-15).
* Edit: Status note under the title.

### Style

### S3-1-51 [style] Severity: Major
* Target: spec-top-three.md line 215
* Finding: "The corpus takes no clock or queue input" contradicts section 3, whose ops take `now`.
* Decision: PROPOSE FIX
* Reason: Confirmed in the corpus: only `pullMerge` and `pushFocus` (and the wire ops) lack `now`.
* Edit: "The corpus takes" became "Those two ops take".

### S3-1-52 [style] Severity: Major
* Target: spec-weekly-sweep.md lines 171, 173, 225
* Finding: My dated note says no function deploy is needed, while the text above and rollout step 5 say Vinny deploys it.
* Decision: PROPOSE FIX
* Reason: Valid. The note must say which statements it replaces.
* Edit: Added one sentence to the dated note.

### S3-1-53 [style] Severity: Major
* Target: spec-top-three.md lines 3-5, 258, 304, 350-352, 368-379; spec-weekly-sweep.md lines 3-8, 221-223, 242
* Finding: The specs do not say whether hosted has the fields, whether sections 15 and 13 were answered, or whether the corpora are frozen, though the web has shipped.
* Decision: ESCALATE
* Reason: Owner facts. Nothing in this repo records them.
* Edit: none

### S3-1-54 [style] Severity: Major
* Target: spec-top-three.md lines 302, 219, 334, 376; spec-weekly-sweep.md lines 242-251
* Finding: Referents outside the document: "a reverted migration came straight back", "the `pocketbase` lock", "the Android mechanism", "the brief", "the Lead".
* Decision: ESCALATE
* Reason: They point at sprint material outside this repo. I can't supply them from code.
* Edit: none

### S3-1-55 [style] Severity: Major
* Target: spec-top-three.md lines 246, 254; spec-weekly-sweep.md lines 61-67, 214, 238
* Finding: Three undefined cases in contract text: a widget date match with fewer than three picks; a sweep where every card is skipped (stamp or not); "the names in section 7" with no names defined.
* Decision: ESCALATE
* Reason: Cross-client contract wording. Web stamps when the session had cards (`use-sweep-session.ts:81, 90`), but that alone can't set the rule.
* Edit: none

### S3-1-56 [style] Severity: Major
* Target: spec-weekly-sweep.md lines 56, 143
* Finding: "The test ... holds on each client" reads as a verified fact.
* Decision: CONTEST
* Reason: In this spec "holds" names a required test. Section 10 item 2 lists the same test as one to write, and section 6 pairs the phrase with "must".
* Edit: none

### S3-1-57 [style] Severity: Major
* Target: spec-whats-new.md lines 13, 17
* Finding: "Three of those four surfaces" follows a list of three. "Both `PRODUCT.md` files" names neither.
* Decision: ESCALATE
* Reason: The author's intent decides both, not the code.
* Edit: none

### S3-1-58 [style] Severity: Major
* Target: the four finished documents (reviewer items 17 to 26)
* Finding: Ten internal inconsistencies, such as the palette spec listing a topbar hint as input and as out of scope, and the handoff never defining "Tidewater".
* Decision: ESCALATE
* Reason: These are records of finished work. The batch rule is a status line, not a rewrite.
* Edit: none
