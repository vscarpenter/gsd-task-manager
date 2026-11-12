# Doc refresh: S2-sync-specs, round 1

Status: resolved
Clean round: no

Resolver's rule for line references: each spec names the commits or the date it was read at. I checked a sample with `git show 816a2b7:<file>` and the cited lines were right at that commit. So I left pinned line numbers alone and added dated "Shipped" or "Web today" notes that name the current file and symbol. Findings about drifted line numbers are resolved that way unless the entry says otherwise.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details (A) | spec-resurrect-on-sight.md | ran |
| egm-codebase-details (B) | spec-conditional-delete.md, spec-notify-before.md | ran |
| egm-codebase-details (C) | spec-cloud-sync-auth-token.md, spec-account-deletion.md, spec-anonymous-feedback.md | ran |
| egm-style (S) | all six files | ran |

## Findings

### spec-resurrect-on-sight.md

### S2-sync-specs-1-1 [A] Severity: Major
* Target: spec-resurrect-on-sight.md line 3
* Finding: Status describes the ports as future work. All three shipped: web `lib/sync/resurrect-on-sight.ts`, iOS `SyncEngine.swift` (`resurrectOnSight`, #92 and #97), Android `SyncEngine.kt` (`hasQueuedDelete`, `isArchived`), `LocalErase.kt:27`.
* Decision: PROPOSE FIX
* Reason: Confirmed in all three checkouts (`git log` shows #701, iOS #92 and #97, Android head `fabf6f5`).
* Edit: Added a "Shipped, 2026-11-12" line under the header block. Original status line kept.

### S2-sync-specs-1-2 [A] Severity: Major
* Target: lines 21, 70, 82, 83, 85
* Finding: "Web pushes first" is not unconditional. `runSyncPasses` (`lib/sync/pb-sync-engine.ts`) pulls first while a backfill is owed.
* Decision: PROPOSE FIX
* Reason: Confirmed at `runSyncPasses` and `isBackfillOwed`.
* Edit: Bullet in the section 4 shipped note. Original text kept.

### S2-sync-specs-1-3 [A] Severity: Major
* Target: line 76
* Finding: Sign-out remembers in `resetSyncConfigState`, in one transaction, after writing the signed-out row. It returns early with no `sync_config` row and remembers failed rows too.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/sync/config/disable.ts:26-68` and `resurrect-ids.ts:42-44`.
* Edit: Bullet in the section 4 shipped note.

### S2-sync-specs-1-4 [A] Severity: Major
* Target: line 35
* Finding: Web also forgets on Empty Trash (`lib/trash.ts:98`) and Undo (`lib/tasks/crud/restore.ts:30`).
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg forgetForResurrect`.
* Edit: Added "Undo" and "Empty Trash" to the list in rule 4, plus a bullet in the section 4 note.

### S2-sync-specs-1-5 [A] Severity: Major
* Target: line 81
* Finding: An unauthenticated pull ends the sync before the step. A failure while applying is logged and the sync succeeds. An unmappable server copy is forgotten.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-sync-engine.ts` `fullSync` and `resurrect-on-sight.ts:39-46`, `:94-97`.
* Edit: Three bullets in the section 4 shipped note.

### S2-sync-specs-1-6 [A] Severity: Major
* Target: line 45
* Finding: A sign-in to a different account is refused by `persistSyncConfig` while local rows belong to another recorded account.
* Decision: PROPOSE FIX
* Reason: Confirmed at `components/sync/use-sync-auth-dialog.ts` `persistSyncConfig`.
* Edit: Bullet in the section 4 shipped note. The accepted consequence text is kept.

### S2-sync-specs-1-7 [A] Severity: Major
* Target: section 4 and section 7 web bullet, 12 line references
* Finding: Cited line numbers now hold other code.
* Decision: PROPOSE FIX
* Reason: The lines are right at `816a2b7` (checked `disable.ts`, `delete.ts`). See the resolver's rule above.
* Edit: Header note says references are as read at the Evidence commits. The section 4 note names the current symbols (`resetSyncConfigState`, `resurrectOnSight`, `mapOverLocalCopy`, `runSyncPasses`, `persistSyncConfig`).

### S2-sync-specs-1-8 [A] Severity: Major
* Target: section 3, lines 54-66
* Finding: Android's follow-ups shipped, and "the step has no check for one today" is no longer true.
* Decision: PROPOSE FIX
* Reason: Confirmed in `gsd-android` `SyncEngine.kt:195-243` and `LocalErase.kt:27`.
* Edit: "Shipped, 2026-11-12" paragraph at the end of section 3.

### S2-sync-specs-1-9 [A] Severity: Major
* Target: section 5, lines 96-103
* Finding: iOS shipped with a new flag (`markSignInDropOwed`), `applyOverTombstone` now merges into the buried row, and the step has `waitsForThisDevice`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `gsd-iosapp` `SyncCursor.swift:86`, `SyncEngine.swift:617`, `:633-647`, `:698-701`, `SessionStore.swift:78`.
* Edit: "Shipped, 2026-11-12" block at the end of section 5.

### S2-sync-specs-1-10 [A] Severity: Nit
* Target: line 123
* Finding: The web test is an `it.each`, so runtime names carry a suffix.
* Decision: PROPOSE FIX
* Reason: Cheap to say in the section 6 note.
* Edit: One sentence in the section 6 note.

### S2-sync-specs-1-11 [A] Severity: Nit
* Target: line 85
* Finding: `populateFromExistingTasks` spans `:201-219` and runs inside the sign-in transaction.
* Decision: DECLINE
* Reason: Line range is pinned to the Evidence commit. The transaction detail is in `components/sync/README.md`.
* Edit: none

### S2-sync-specs-1-12 [A] Severity: Nit
* Target: lines 84, 143
* Finding: "Disconnect account instead" in the Session expired dialog goes through `disableSync`, so that path remembers the delete.
* Decision: DECLINE
* Reason: True (`sync-auth-dialog-sections.tsx:66-73`), but the spec scopes itself to the OAuth path pending D-2.
* Edit: none

### S2-sync-specs-1-13 [A] Severity: Nit
* Target: section 6, Android and iOS columns
* Finding: Several "add" cells now have tests.
* Decision: PROPOSE FIX
* Reason: Confirmed by name in `SyncEngineTest.kt` and `ResurrectOnSightTests.swift`.
* Edit: Section 6 note. Table cells kept.

### S2-sync-specs-1-14 [S] Severity: Major
* Target: line 30
* Finding: The quoted phrase "Since it was remembered" appears nowhere else.
* Decision: PROPOSE FIX
* Reason: Valid. The bullet explains why the step needs no timestamp.
* Edit: Reworded the bold lead-in. The rest of the bullet is unchanged.

### S2-sync-specs-1-15 [S] Severity: Major
* Target: lines 35 vs 85 (also 27, 83)
* Finding: On web, Restore forgets the id, so the step never sees a restored task, and the "restored and trashed again" case in rule 3 can't arise the way line 27 describes.
* Decision: ESCALATE
* Reason: I can't settle which reading is intended. `lib/trash.ts:63` and `restore.ts:30` do forget on restore, and `waitsForThisDevice` still checks for a pending delete. See "Escalated".
* Edit: none

### S2-sync-specs-1-16 [S] Severity: Major
* Target: lines 61-62
* Finding: "It" switches from today's step to the follow-up.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "It" became "The follow-up" in both sentences.

### S2-sync-specs-1-17 [S] Severity: Major
* Target: line 60
* Finding: "The same upsert" has no referent.
* Decision: PROPOSE FIX
* Reason: `LocalErase.kt:27` is the upsert in `eraseAll`.
* Edit: "the same upsert" became "`eraseAll`'s upsert".

### S2-sync-specs-1-18 [S] Severity: Major
* Target: line 141
* Finding: The D-2 parenthetical doesn't state the two options clearly.
* Decision: ESCALATE
* Reason: D-2 lives in the sprint workspace, outside this repository. I can't restate an owner decision from code.
* Edit: none

### spec-conditional-delete.md

### S2-sync-specs-1-19 [B] Severity: Blocker
* Target: line 17
* Finding: The web row's `pb-push.ts` line references point at other code now.
* Decision: PROPOSE FIX
* Reason: The lines are right at `816a2b7`. Current: lookup in `pushSingleItem`, check and delete in `pushDelete` (`pb-push.ts:323-353`).
* Edit: "Web today, 2026-11-12" note under the section 2 table. Table kept.

### S2-sync-specs-1-20 [B] Severity: Blocker
* Target: lines 68, 103
* Finding: `pushSingleItem` has no delete branch. `pushDelete` is the helper the spec planned.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-push.ts:265-276` and `:323-353`.
* Edit: Dated sub-bullet in section 5, and "(`pushDelete` since 2026-11)" in the section 8 web row.

### S2-sync-specs-1-21 [B] Severity: Major
* Target: line 68
* Finding: `pb-push.ts` is 474 lines on disk. The lint rule skips blanks and comments.
* Decision: PROPOSE FIX
* Reason: `wc -l` gives 474. `scripts/check-code-shape.cjs:39` sets `max-lines` 400 with both skips. I did not run the linter.
* Edit: Same dated sub-bullet in section 5.

### S2-sync-specs-1-22 [B] Severity: Major
* Target: lines 45-48, 77 (CD-6)
* Finding: Web now confirms the session before it drops a delete on a 404. CD-6's "Gone" branch as written would skip that.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-push.ts:186-198`, `:349-351` (#717). The spec is unbuilt, so I added the fact and left CD-6 alone. Also listed under "Escalated".
* Edit: "Web today, 2026-11-12" note at the end of section 3.2.

### S2-sync-specs-1-23 [B] Severity: Major
* Target: line 89
* Finding: MCP line references drifted. Both tool paths now use `deleteTaskInPBById` after a fresh re-read that compares `client_updated_at`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `task-operations.ts:377-385` and `bulk-operations.ts:167-171`.
* Edit: Dated parenthetical on the section 7 MCP bullet.

### S2-sync-specs-1-24 [B] Severity: Major
* Target: line 101
* Finding: `.deleteRule = owner_rule` is at line 148, not 129.
* Decision: PROPOSE FIX
* Reason: Confirmed. This row tells a person where to edit, so I updated the number in place.
* Edit: "line 129" became "line 148 on 2026-11-12".

### S2-sync-specs-1-25 [B] Severity: Nit
* Target: line 75
* Finding: `fetchRemoteTaskEntry` rejects a bad stamp before `hasUsableRemoteVersion` runs.
* Decision: DECLINE
* Reason: The outcome the spec states (no delete) is right.
* Edit: none

### S2-sync-specs-1-26 [B] Severity: Nit
* Target: line 70
* Finding: `setup-pocketbase-collections.sh` also defaults `PB_URL` to production.
* Decision: PROPOSE FIX
* Reason: Confirmed at line 20 of that script. A safety rule should name both.
* Edit: The "Never" bullet now names both scripts.

### S2-sync-specs-1-27 [B] Severity: Nit
* Target: lines 18-19
* Finding: Native line references drifted.
* Decision: DECLINE
* Reason: Pinned to the Evidence commits, which the new status line says.
* Edit: none

### S2-sync-specs-1-28 [S] Severity: Major
* Target: line 100
* Finding: "like the top three fields" has no referent.
* Decision: PROPOSE FIX
* Reason: The update script adds the Top three fields `focus_date` and `focus_rank` (`scripts/update-pocketbase-tasks-schema.sh:125-128`, `:177`).
* Edit: Named the fields.

### S2-sync-specs-1-29 [S] Severity: Major
* Target: lines 118, 120
* Finding: CHECK-7's rationale describes the missing-key case, and line 120 leaves CHECK-3 out of the go-back list.
* Decision: ESCALATE
* Reason: Which checks send the spec back is the author's call, and the server behavior hasn't been run.
* Edit: none

### S2-sync-specs-1-30 [S] Severity: Major
* Target: line 101 vs 25, 93, 110
* Finding: "Hook" means a PocketBase hook in three places and a Claude Code hook in one.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "hook-protected" became "A Claude Code edit hook protects both".

### S2-sync-specs-1-31 [S] Severity: Major
* Target: line 67 vs 77
* Finding: A refusal can also follow another device's delete.
* Decision: PROPOSE FIX
* Reason: Line 77 of the spec says so itself.
* Edit: "edit" became "edit or delete".

### S2-sync-specs-1-32 [resolver] Severity: Major
* Target: under the title
* Finding: The spec describes work that hasn't been built. No status says so as of today.
* Decision: PROPOSE FIX
* Reason: `rg expect_client_updated_at` finds nothing outside the spec in this repo or the two native checkouts. No test file, no migration, both scripts unchanged.
* Edit: One-line "Status, 2026-11-12" under the header block.

### spec-notify-before.md

### S2-sync-specs-1-33 [B] Severity: Major
* Target: lines 89, 96
* Finding: Two named tests don't exist: `any write of a legacy null pushes the resolved number` (web) and `an MCP update keeps the stored offset`.
* Decision: PROPOSE FIX
* Reason: `rg` over `tests/` and `packages/mcp-server/` finds neither. The doc now says so. The gap itself is listed under "Escalated".
* Edit: Section 7 shipped note.

### S2-sync-specs-1-34 [B] Severity: Nit
* Target: lines 85, 88, 96
* Finding: Tests shipped under longer names.
* Decision: PROPOSE FIX
* Reason: Confirmed at `notify-before-number.test.ts:107` and `task-operations-create.test.ts:185`.
* Edit: Section 7 shipped note names the two longer names.

### S2-sync-specs-1-35 [B] Severity: Major
* Target: lines 41, 63 (`update.ts:103`)
* Finding: The re-arm comparison is now in `buildUpdatedRecord` at `:137-139`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Section 6 shipped note names `buildUpdatedRecord`.

### S2-sync-specs-1-36 [B] Severity: Major
* Target: line 61 (`task-mapper.ts:54,142`, `:181`)
* Finding: Lines moved to 55, 147, 187.
* Decision: PROPOSE FIX
* Reason: Confirmed. The mapper takes a required `defaultNotifyBefore`.
* Edit: Section 6 shipped note names `taskRecordToPocketBase`.

### S2-sync-specs-1-37 [B] Severity: Major
* Target: lines 71-73
* Finding: MCP lines moved. The fix shipped in `createTask`, the `types.ts` mapper still has `?? 0`, and the tool text is fixed.
* Decision: PROPOSE FIX
* Reason: Confirmed at `task-operations.ts:114`, `types.ts:180`, `write-tools.ts:76`, `:176`.
* Edit: Dated bullet at the end of the MCP list.

### S2-sync-specs-1-38 [B] Severity: Major
* Target: line 30 (`import-export.ts:469`)
* Finding: The Merge gate is at `:478` now.
* Decision: PROPOSE FIX
* Reason: Confirmed. Behavior is unchanged.
* Edit: Line 6 now says references are from the dated reads. The section 6 note names `defaultInEffectAfter`.

### S2-sync-specs-1-39 [B] Severity: Nit
* Target: line 100
* Finding: The flipped assertion is at `:148`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Section 7 note says the mapper test flipped as planned.

### S2-sync-specs-1-40 [B] Severity: Nit
* Target: line 59
* Finding: The web cell omits `lib/tasks/crud/duplicate.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `duplicate.ts:55`.
* Edit: Section 6 shipped note.

### S2-sync-specs-1-41 [B] Severity: Nit
* Target: lines 29, 62
* Finding: The drain logic is in `resolveNotifyBefore` and `settleRowOffset`, and the write-back is stricter than section 3 says.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-push.ts:106-143`.
* Edit: Section 6 shipped note.

### S2-sync-specs-1-42 [B] Severity: Nit
* Target: native line references
* Finding: iOS and Android lines drifted.
* Decision: DECLINE
* Reason: Dated reads, as line 6 now says.
* Edit: none

### S2-sync-specs-1-43 [S] Severity: Major
* Target: sections 2-3 vs 5
* Finding: "Row" means a stored task and a picker option.
* Decision: PROPOSE FIX
* Reason: Valid. One anchor at the start of section 5 is enough.
* Edit: "Android's first row" became "The first row of Android's reminder picker".

### S2-sync-specs-1-44 [S] Severity: Major
* Target: line 26
* Finding: "Those other devices" has no antecedent.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "Devices that pulled the `0`".

### S2-sync-specs-1-45 [S] Severity: Major
* Target: line 3 vs 6
* Finding: Status says merged. Evidence says nothing has run on a client.
* Decision: PROPOSE FIX
* Reason: Line 6 describes the time of writing.
* Edit: Put that sentence in the past tense.

### S2-sync-specs-1-46 [S] Severity: Major
* Target: line 33
* Finding: "A data persistence exception" names no rule.
* Decision: PROPOSE FIX
* Reason: `coding-standards.md` Part 2 has the rule and the exception.
* Edit: Named the rule and the file.

### spec-cloud-sync-auth-token.md

### S2-sync-specs-1-47 [C] Severity: Major
* Target: line 10
* Finding: The shipped description adds an expiry sentence.
* Decision: PROPOSE FIX
* Reason: Confirmed at `sync-auth-token-row.tsx:50`.
* Edit: "Shipped, 2026-11-12" paragraph after the contract.

### S2-sync-specs-1-48 [C] Severity: Nit
* Target: lines 26-27
* Finding: README and quick-start say "MCP access →" in the path. The wizard and token-status keep the short path.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg "Copy auth token" packages/mcp-server`.
* Edit: Same paragraph.

### S2-sync-specs-1-49 [C] Severity: Nit
* Target: line 17
* Finding: The row also needs `settings.syncEnabled`.
* Decision: DECLINE
* Reason: The whole Cloud Sync section has that gate. Not specific to this row.
* Edit: none

### S2-sync-specs-1-50 [C] Severity: Nit
* Target: line 22
* Finding: The pending button reads "Copying…" and sets `aria-busy`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Same paragraph (label only).

### S2-sync-specs-1-51 [S] Severity: Major
* Target: lines 9-10, 13-14, 22-24
* Finding: UI strings have no quotation marks.
* Decision: PROPOSE FIX
* Reason: Valid. Each string checked against the component.
* Edit: Quoted the five strings.

### S2-sync-specs-1-52 [S] Severity: Major
* Target: lines 13-14 vs 17-19
* Finding: The doc doesn't say how a click can happen with no token.
* Decision: CONTEST
* Reason: Lines 19-20 say validity is rechecked on click because state can change after render. `copyAuthToken` has the same comment (`sync-auth-token-row.tsx:10`).
* Edit: none

### S2-sync-specs-1-53 [S] Severity: Major
* Target: line 63
* Finding: "complexity 11 to 12, function length 90 to 94" is ambiguous.
* Decision: ESCALATE
* Reason: It's a record of one run on 2026-09-19. I can't recover what was measured.
* Edit: none

### S2-sync-specs-1-54 [S] Severity: Major
* Target: line 52
* Finding: "Its server snapshot" has no referent.
* Decision: PROPOSE FIX
* Reason: The component passes a server snapshot to `useSyncExternalStore` (`sync-auth-token-row.tsx:32-36`).
* Edit: Named `useSyncExternalStore`.

### spec-account-deletion.md

### S2-sync-specs-1-55 [C] Severity: Blocker
* Target: lines 39-51, 75, 93, 102
* Finding: The module tries `DELETE /api/gsd/account` first. The client-side flow runs only on a 404.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-account-deletion.ts:128-141`, `:241-243`, and `docker/pb_hooks/account_lifecycle.pb.js`.
* Edit: "Shipped differently" line under the status, a dated list after the behaviour steps, and a dated parenthetical on the "No server-side hooks" constraint.

### S2-sync-specs-1-56 [C] Severity: Major
* Target: lines 28-36
* Finding: The result adds `remoteTasksErased`, and the function takes options.
* Decision: PROPOSE FIX
* Reason: Confirmed at `:61-79`, `:221`.
* Edit: First bullet of the dated list. The code block is kept as the record.

### S2-sync-specs-1-57 [C] Severity: Major
* Target: lines 41-42, 77, 89, 105
* Finding: Step 1 uses `refreshAuthOutcome()`, and an unreachable server gives `authRejected: false`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `:228-236`.
* Edit: Second bullet of the dated list.

### S2-sync-specs-1-58 [C] Severity: Major
* Target: lines 43-47, 82-85, 107-108
* Finding: The fallback drains in up to 3 passes.
* Decision: PROPOSE FIX
* Reason: Confirmed at `:59`, `:183-206`.
* Edit: Last bullet of the dated list.

### S2-sync-specs-1-59 [C] Severity: Major
* Target: line 55
* Finding: Props add a required `onExport`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `delete-account-dialog.tsx:23-30`.
* Edit: Dialog shipped note.

### S2-sync-specs-1-60 [C] Severity: Major
* Target: lines 59, 109
* Finding: The delete button also waits for a successful export when "export first" is on.
* Decision: PROPOSE FIX
* Reason: Confirmed at `:125-126`.
* Edit: Dialog shipped note.

### S2-sync-specs-1-61 [C] Severity: Major
* Target: lines 60-61, 88
* Finding: A failed local erase shows a message, keeps the dialog open, and doesn't reload.
* Decision: PROPOSE FIX
* Reason: Confirmed at `:96-106`.
* Edit: Dialog shipped note.

### S2-sync-specs-1-62 [C] Severity: Major
* Target: lines 65-68
* Finding: The danger zone lives in `sync-danger-zone.tsx`. The gate is `settings.syncEnabled`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Settings shipped note.

### S2-sync-specs-1-63 [C] Severity: Major
* Target: lines 116-123
* Finding: None of the seven data test names exist.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing `tests/data/pb-account-deletion.test.ts`.
* Edit: Test Stubs shipped note. Stub names kept.

### S2-sync-specs-1-64 [C] Severity: Nit (four)
* Target: lines 57-58 (switches), 62-63 (call order), 62 (`disableSync` detail), 125-129 (7 more dialog tests)
* Finding: Small differences in control type, order, and counts.
* Decision: PROPOSE FIX for the switches and the test count. DECLINE for the call order and the `disableSync` detail.
* Reason: The declined two change nothing a reader would act on.
* Edit: Dialog and Test Stubs shipped notes.

### S2-sync-specs-1-65 [C] Severity: Nit
* Target: line 97
* Finding: `deviceId` survives `resetEverything` only on the table-clear path.
* Decision: DECLINE
* Reason: Edge of an out-of-scope bullet.
* Edit: none

### S2-sync-specs-1-66 [S] Severity: Major
* Target: line 41 vs 89, 105
* Finding: Step 1 refreshes auth, yet AC 4 says "without hitting the network".
* Decision: PROPOSE FIX
* Reason: `refreshAuthOutcome` returns `'no-session'` with no token, before any request (`pb-auth.ts:369-374`).
* Edit: Said so in the dated list.

### S2-sync-specs-1-67 [S] Severity: Major
* Target: line 108, 123
* Finding: AC 7 claims a throttle but measures one delete per record.
* Decision: PROPOSE FIX
* Reason: A shipped test pins the throttle: "keeps the 100ms throttle between fallback deletes".
* Edit: Test Stubs shipped note names the throttle coverage. AC text kept.

### S2-sync-specs-1-68 [S] Severity: Major
* Target: lines 31, 86 vs 35, 60-63, 111
* Finding: Nobody is assigned to clear auth on `authRejected`.
* Decision: ESCALATE
* Reason: The spec says "clear auth". The dialog only shows a toast (`delete-account-dialog.tsx:87-89`, `handleDelete`). Listed under "Possible code defects". I recorded the shipped behavior in the dialog note without changing the edge-case rule.
* Edit: One sentence of fact in the dialog note.

### S2-sync-specs-1-69 [S] Severity: Major
* Target: line 97
* Finding: A behaviour claim sits in Out of Scope.
* Decision: ESCALATE
* Reason: Whether re-signup is a guarantee is the owner's intent.
* Edit: none

### spec-anonymous-feedback.md

### S2-sync-specs-1-70 [C] Severity: Blocker
* Target: lines 115-124
* Finding: The list has 7 items. `weekly-review` was retired.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/feedback/roadmap-items.ts` and commit `f2b5b3e6` (#695).
* Edit: Dated note under the table. The initial list is kept as the record.

### S2-sync-specs-1-71 [C] Severity: Blocker
* Target: line 176
* Finding: `tests/ui/feedback-section.test.tsx` doesn't exist. The file is `feedback-settings.test.tsx`.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls tests/ui`.
* Edit: Dated note at the top of Test Stubs.

### S2-sync-specs-1-72 [C] Severity: Major
* Target: lines 115-124
* Finding: Four labels differ, and items have a description.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Same note under the table. Labels not copied.

### S2-sync-specs-1-73 [C] Severity: Major
* Target: line 67
* Finding: Dexie is at version 17.
* Decision: PROPOSE FIX
* Reason: Confirmed at `lib/db-migrations.ts:236`.
* Edit: Dated parenthetical.

### S2-sync-specs-1-74 [C] Severity: Major
* Target: line 108
* Finding: Sentry is gone.
* Decision: PROPOSE FIX
* Reason: Not in `package.json`. `docs/adr/0017-remove-sentry-telemetry.md` exists.
* Edit: Dated parenthetical.

### S2-sync-specs-1-75 [C] Severity: Major
* Target: lines 166-167
* Finding: `localStorage.clear()` works now.
* Decision: PROPOSE FIX
* Reason: `vitest.setup.ts` `InMemoryStorage.clear()`, and `.claude/rules/testing.md:37`.
* Edit: Dated parenthetical.

### S2-sync-specs-1-76 [C] Severity: Major
* Target: lines 153-185, 169-174
* Finding: Test names differ, and the retry test is in the UI file.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing all five test files.
* Edit: Test Stubs dated note.

### S2-sync-specs-1-77 [C] Severity: Major
* Target: lines 32-42, 142-145
* Finding: The collection has a server-only `status` field.
* Decision: PROPOSE FIX
* Reason: Confirmed at `setup-pocketbase-feedback-collection.sh:157` and `feedback_controls.pb.js:6-12`.
* Edit: Dated note under the payload table.

### S2-sync-specs-1-78 [C] Severity: Nit
* Target: line 4
* Finding: Status still says "implementing".
* Decision: PROPOSE FIX
* Reason: Shipped in #516.
* Edit: "Shipped, 2026-11-12" line in the header.

### S2-sync-specs-1-79 [C] Severity: Nit
* Target: line 48
* Finding: `lib/db-migrations.ts:75` is now the function declaration.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Dropped the line number and named the `sync_config` row.

### S2-sync-specs-1-80 [C] Severity: Nit
* Target: line 81
* Finding: A duplicate-id 400 counts as success, and 5xx has its own reason.
* Decision: PROPOSE FIX
* Reason: Confirmed at `submit-feedback.ts:33-48`, `:70-72`. Also answers S finding 1-88.
* Edit: Dated parenthetical on the edge case.

### S2-sync-specs-1-81 [C] Severity: Nit
* Target: lines 100-101
* Finding: The nudge also hides while a draft is open.
* Decision: PROPOSE FIX
* Reason: Confirmed at `nudge-eligibility.ts:87`.
* Edit: One sentence.

### S2-sync-specs-1-82 [C] Severity: Nit
* Target: lines 148-149
* Finding: The system test has no path.
* Decision: PROPOSE FIX
* Reason: Confirmed at `packages/mcp-server/src/__tests__/system/pocketbase-system.test.ts:436`.
* Edit: Added the path.

### S2-sync-specs-1-83 [C] Severity: Nit (seven)
* Target: lines 28 (host), 36 (id limit), 41 (`app_version` source), 42 (`client_submitted_at` time), 113 ("one-line change"), 126-127 (parser also extracts URLs), 134/179 (preview whitespace)
* Finding: Small precision gaps.
* Decision: DECLINE
* Reason: None would send a reader to the wrong place. The payload file owns the detail.
* Edit: none

### S2-sync-specs-1-84 [S] Severity: Major
* Target: lines 12-13, 46 vs 36
* Finding: "No identifier of any kind" sits beside `submission_id`.
* Decision: ESCALATE
* Reason: This is the privacy promise in the owner's words. Not mine to reword.
* Edit: none

### S2-sync-specs-1-85 [S] Severity: Major
* Target: line 36 vs 77-78
* Finding: "Never persisted" ignores the server's copy.
* Decision: PROPOSE FIX
* Reason: The id lives in a module variable on the client (`feedback-store.ts:184`). The server stores it under a unique index.
* Edit: "never persisted on the device".

### S2-sync-specs-1-86 [S] Severity: Major
* Target: lines 77-78 vs 81, 148-149
* Finding: The doc doesn't say what a user sees when a retry hits the unique index.
* Decision: PROPOSE FIX
* Reason: Success, per `submit-feedback.ts:70-72`.
* Edit: Same parenthetical as 1-80.

### S2-sync-specs-1-87 [S] Severity: Major
* Target: line 139 (AC 6)
* Finding: "One-per-feature per device" contradicts repeat submissions.
* Decision: ESCALATE
* Reason: An acceptance criterion's intent.
* Edit: none

### S2-sync-specs-1-88 [S] Severity: Major
* Target: lines 85-86, 163
* Finding: "Idempotent" misdescribes a toggle.
* Decision: CONTEST
* Reason: The same sentence states the property meant: the store holds a set, so a slug can't appear twice. `tests/data/feedback-store.test.ts:47` pins exactly that.
* Edit: none

### S2-sync-specs-1-89 [S] Severity: Major
* Target: line 112
* Finding: "Seeded from gaps confirmed against the codebase" outruns its evidence.
* Decision: ESCALATE
* Reason: The author's claim about how the list was chosen.
* Edit: none

## Escalated (needs the owner)
* 1-15: resurrect spec. On web, Restore and Undo forget the id, so line 85's "restored while signed out" case never reaches the step, and rule 3's "restored and trashed again" case has no clear web path.
* 1-18: resurrect spec line 141. D-2's two options need the owner's wording.
* 1-22: conditional delete. CD-6's "Gone" branch must keep the session check web added in #717. The note records the fact. The spec's design text is unchanged.
* 1-29: conditional delete lines 118-120. Should CHECK-3 join the go-back list?
* 1-33: notify-before. Two tests the spec names were never written.
* 1-53: auth token spec line 63. Ambiguous numbers in a dated run record.
* 1-68, 1-69: account deletion. Who clears auth on `authRejected`, and is re-signup a guarantee?
* 1-84, 1-87, 1-89: feedback. Privacy wording, AC 6, and the roadmap seeding claim.
* Hosted hooks: conditional delete says hosted runs no hooks (ADR 0016). The feedback spec requires a hook on the same server. Code can't settle what `api.vinny.io` loads.

## Possible code defects
* `components/delete-account-dialog.tsx:87-89` and `handleDelete`: on `authRejected` the dialog shows a toast and clears no auth. The spec's edge case says "clear auth, surface session expired".
