# Doc refresh: S2-sync-specs, round 3

Status: resolved
Clean round: no

Accuracy reviewers only this round, at most two at a time. Each reviewer received the settled list from rounds 1 and 2 (every CONTEST, ESCALATE, and DECLINE). The resolver opened the cited code for every finding before editing.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details (A) | spec-resurrect-on-sight.md | ran |
| egm-codebase-details (B) | spec-conditional-delete.md, spec-notify-before.md | ran |
| egm-codebase-details (C) | spec-cloud-sync-auth-token.md, spec-account-deletion.md, spec-anonymous-feedback.md | ran |

A raised 2 Nits. B raised 4 Majors and 4 Nits. C raised 1 Major and 7 Nits.

## Findings

### spec-resurrect-on-sight.md

### S2-sync-specs-3-1 [A] Severity: Nit
* Target: line 95 (dated note)
* Finding: "A step that fails while applying doesn't fail the sync" reads as unconditional. A `StaleSyncSessionError` is rethrown (`lib/sync/resurrect-on-sight.ts:44`) and the sync reports cancelled (`pb-sync-engine.ts` `reportSyncError`).
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: Added "and a stale session (`StaleSyncSessionError`) still cancels it" to the bullet.

### S2-sync-specs-3-2 [A] Severity: Nit
* Target: line 69 (dated note)
* Finding: Android's `resurrectOnSightOrReport` also rethrows `CancellationException`, so "only a session problem" is too strong.
* Decision: PROPOSE FIX
* Reason: Confirmed at `gsd-android` `SyncEngine.kt:235-242`.
* Edit: "only a session problem or a cancelled coroutine stops the run".

### spec-conditional-delete.md

### S2-sync-specs-3-3 [B] Severity: Major
* Target: line 81 (section 6, "Empty or missing stamp")
* Finding: The spec says a remote with no usable stamp fails the version check before any delete on web and iOS. iOS exempts deletes (`GSDSync/SyncEngine.swift:240`, "A delete carries no version to compare"), and `isStaleDelete` returns false with no stamp. Android's two stale checks do the same (`SyncEngine.kt:342-346`, `:371-372`, `:381-382`). Web matches (`pb-push.ts:269-272`).
* Decision: PROPOSE FIX for the fact. ESCALATE the design consequence.
* Reason: Confirmed in all three checkouts. The iOS exemption was already there at the Evidence commit `4c4d44a` (`git show`, line 206), so the claim was wrong when written. The iOS comment ties it to open owner decision D-9. What CD-4 and CD-8 should do for a native delete with no stamp is a design call.
* Edit: "Native today, 2026-11-12" sub-bullet under the edge case. The original bullet is kept.

### S2-sync-specs-3-4 [B] Severity: Nit
* Target: line 74 (dated note)
* Finding: The `pushSingleItem` summary leaves out the unusable-stamp guard.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-push.ts:269-272`.
* Edit: Added "charges an attempt when the remote stamp is unusable".

### S2-sync-specs-3-5 [B] Severity: Nit
* Target: line 19
* Finding: iOS `deleteTask` takes `recordId` and `token`.
* Decision: DECLINE
* Reason: Undated shorthand for the call. The file and function name are right.
* Edit: none

### spec-notify-before.md

### S2-sync-specs-3-6 [B] Severity: Major
* Target: lines 41, 63
* Finding: iOS doesn't clear `notificationSent` at `EditorMerge.swift:31-33`, or anywhere in that file. Its header says the iOS scheduler doesn't read the flag. The effective-value comparison does exist, through `untouched(_:defaultReminder:)`.
* Decision: PROPOSE FIX
* Reason: Confirmed by reading `EditorMerge.swift` in full. The iOS comment shows the difference is deliberate, so this is not listed as a code defect.
* Edit: "iOS today, 2026-11-12" paragraph at the end of section 4.

### S2-sync-specs-3-7 [B] Severity: Major
* Target: lines 87, 100-101, and the section 7 dated note
* Finding: Several iOS tests carry other names. The two section 4 rows map to tests that assert the offset, not `notificationSent`. The "any write" row maps to `anyEditorSaveOfALegacyNullSettlesTheDefault`, which asserts the stored row, not the push.
* Decision: PROPOSE FIX for the fact. ESCALATE the coverage gap.
* Reason: Confirmed in `EditorMergeTests.swift:86-102` and `NotifyBeforeStoreTests.swift:55-62`. Whether iOS owes a push assertion is the owner's call, with 1-33.
* Edit: "iOS, 2026-11-12" paragraph after the section 7 note.

### S2-sync-specs-3-8 [B] Severity: Major
* Target: line 64
* Finding: The Share Extension doesn't use `TaskStore.readNotificationSettings`. It reads `AppGroup.defaultReminderKey` from the App Group defaults and falls back to `AppGroup.fallbackDefaultReminder`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `gsd-iosapp/ShareExtension/ShareViewController.swift:22-25`.
* Edit: "Native today, 2026-11-12" paragraph after the section 6 web note.

### S2-sync-specs-3-9 [B] Severity: Nit
* Target: line 59
* Finding: The native "Resolve on write" cells omit duplicate.
* Decision: PROPOSE FIX
* Reason: Confirmed: Android `TaskStore.duplicate` calls `withOffset()`, and iOS `duplicate` goes through `create` (test `aDuplicateStoresANumber`). Android's two other writers named by the reviewer were not added, to keep the note short.
* Edit: One sentence in the same "Native today" paragraph.

### S2-sync-specs-3-10 [B] Severity: Nit
* Target: section 7 dated note
* Finding: `tests/data/sync/pb-push-session.test.ts` also asserts on the write-back.
* Decision: PROPOSE FIX
* Reason: Confirmed at line 225.
* Edit: Added the file to the list.

### spec-cloud-sync-auth-token.md

### S2-sync-specs-3-11 [C] Severity: Nit
* Target: line 91
* Finding: "Versions are now 13.1.5". `package.json` is at 14.8.7.
* Decision: PROPOSE FIX
* Reason: Confirmed at `package.json:3`.
* Edit: Dated parenthetical after the sentence. The record is kept.

### S2-sync-specs-3-12 [C] Severity: Nit
* Target: line 58
* Finding: The file has 11 tests today, not 10.
* Decision: DECLINE
* Reason: The line records the 2026-09-19 run.
* Edit: none

### S2-sync-specs-3-13 [C] Severity: Nit
* Target: lines 34-37 (dated note)
* Finding: Three more places use the shorter path, and a README troubleshooting line uses the longer one.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg "Copy auth token"` in `components/about/mcp-section.tsx:33`, `public/.well-known/mcp/server-card.json:34`, and `packages/mcp-server/README.md:540`. The troubleshooting line was not added.
* Edit: One sentence naming the three places.

### spec-account-deletion.md

### S2-sync-specs-3-14 [C] Severity: Major
* Target: line 146 (dated note)
* Finding: The 404-fallback block covers five of the seven stubs, not six. The unauthenticated case is tested outside the block (`tests/data/pb-account-deletion.test.ts:76`). The fallback task delete is tested with a 403 only.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing the tests. The round 2 note was wrong on both points.
* Edit: Rewrote the two sentences.

### S2-sync-specs-3-15 [C] Severity: Nit
* Target: line 61 (dated note)
* Finding: The third pass deletes what it lists, then fails with no fourth listing.
* Decision: PROPOSE FIX
* Reason: Confirmed in `drainRemoteTasks` (`pb-account-deletion.ts:183-206`).
* Edit: "it deletes them and then fails with ..., without listing again".

### S2-sync-specs-3-16 [C] Severity: Nit
* Target: line 127 (AC 11)
* Finding: AC 11 says "only when signed in". The gate is `settings.syncEnabled`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `components/settings-page/settings-body.tsx:161`. The dated note in Inputs / Outputs already says so.
* Edit: Dated parenthetical on AC 11 pointing to that note. The criterion text is kept.

### spec-anonymous-feedback.md

### S2-sync-specs-3-17 [C] Severity: Nit
* Target: line 78
* Finding: `coding-standards.md` Part 2 doesn't mention WCAG.
* Decision: PROPOSE FIX
* Reason: `rg WCAG coding-standards.md` finds nothing. `CLAUDE.md` Design Context states the WCAG AA baseline.
* Edit: Dated parenthetical. The constraint is kept.

## Escalated (needs the owner)
* 3-3: conditional delete. On iOS and Android a delete against a remote with no usable stamp goes out today. CD-4 and CD-8 have no stamp to send in that case, and section 6 says "Nothing new".
* 3-7: notify-before. iOS has no test that reads `notificationSent` for section 4, and its "any write" test asserts no push.

## Possible code defects
* None new this round.
