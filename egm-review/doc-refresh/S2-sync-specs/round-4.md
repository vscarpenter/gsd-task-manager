# Doc refresh: S2-sync-specs, round 4

Status: resolved
Clean round: yes

Accuracy reviewers only, at most two at a time, all fresh. Each received the settled list from rounds 1 to 3. No reviewer raised a Blocker or Major. This is the last round the caller allowed, so the batch stops here with one clean round, not the two that convergence needs.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details (A) | spec-resurrect-on-sight.md | ran |
| egm-codebase-details (B) | spec-conditional-delete.md, spec-notify-before.md | ran |
| egm-codebase-details (C) | spec-cloud-sync-auth-token.md, spec-account-deletion.md, spec-anonymous-feedback.md | ran |

A raised 3 Nits. B raised 5 Nits. C raised 1 Nit.

## Findings

### spec-resurrect-on-sight.md

### S2-sync-specs-4-1 [A] Severity: Nit
* Target: line 128, and the section 6 dated note
* Finding: The iOS test `erasing local data forgets every remembered id` is in `GSDStoreTests/TaskStoreDataTests.swift:107`, not `GSDSyncTests/`.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg` in `gsd-iosapp`.
* Edit: One sentence in the section 6 note.

### S2-sync-specs-4-2 [A] Severity: Nit
* Target: lines 6, 7, 30, 159
* Finding: The `sprint/...` paths don't exist in this repository.
* Decision: DECLINE
* Reason: The sprint workspace is a sibling folder (`/Users/vinnycarpenter/Projects/GSD/sprint`), and the section 8 note says it sits outside this repository.
* Edit: none

### S2-sync-specs-4-3 [A] Severity: Nit
* Target: lines 36, 98
* Finding: A Replace import clears `deletedTasks` with no `forgetForResurrect` call (`applyTrashedTasks`, `lib/tasks/import-export.ts:284`). The spec's list of ways a Trash row leaves doesn't include it.
* Decision: ESCALATE
* Reason: Confirmed: `import-export.ts` never calls `forgetForResurrect`. Rule 4 says a remembered id is forgotten when its Trash row leaves. Whether a Replace import should forget is a rule question, so no edit. Listed under "Possible code defects".
* Edit: none

### spec-conditional-delete.md

### S2-sync-specs-4-4 [B] Severity: Nit
* Target: line 82 (round 3 note)
* Finding: iOS exempts a delete only from the missing-version check. A delete whose request throws still reaches `recordFailedAttempt`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `gsd-iosapp` `SyncEngine.swift:240`.
* Edit: "exempts a delete from the missing-version check that calls `recordFailedAttempt`".

### spec-notify-before.md

### S2-sync-specs-4-5 [B] Severity: Nit
* Target: line 43 (round 3 note)
* Finding: `EditorMerge.merge` doesn't call `untouched`. Callers pass `untouched(...)` as `original`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `EditorMerge.swift` (the doc comment on `merge` says so).
* Edit: Rewrote the sentence.

### S2-sync-specs-4-6 [B] Severity: Nit
* Target: line 78 (round 3 note)
* Finding: iOS `TaskStore.ingestSynced` also resolves on write.
* Decision: PROPOSE FIX
* Reason: Confirmed at `gsd-iosapp` `TaskStore.swift:345`.
* Edit: Added `ingestSynced` to the sentence.

### S2-sync-specs-4-7 [B] Severity: Nit
* Target: line 51 (section 5, undated)
* Finding: Android passes the effective offset to `ReminderOptions.including`, not the raw `notifyBefore`.
* Decision: DECLINE
* Reason: The picker rows a reader sees are the same for any stored number. The resolver did not open this code.
* Edit: none

### S2-sync-specs-4-8 [B] Severity: Nit
* Target: line 91 and the Android column
* Finding: Five Android instrumented tests use camelCase function names and carry the table name in a comment.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg` in `gsd-android` (`TaskStoreTest.kt:167`, `:182`, `BackupRoundTripTest.kt:294`, `TaskEditorDepthTest.kt:173`, `ReminderNoneSyncTest.kt:77`).
* Edit: One sentence at the end of the section 7 iOS note.

### spec-cloud-sync-auth-token.md

No findings.

### spec-account-deletion.md

No findings.

### spec-anonymous-feedback.md

### S2-sync-specs-4-9 [C] Severity: Nit
* Target: lines 51-53
* Finding: The same migration also writes the device id to a `device_info` row, which the "must never be read" rule doesn't name.
* Decision: PROPOSE FIX
* Reason: Confirmed at `lib/db-migrations.ts:85-87`. The feedback code reads neither row.
* Edit: Added the second row to the parenthetical. The rule text is kept.

## Escalated (needs the owner)
* 4-3: resurrect spec. Should a Replace import forget remembered ids when it clears the Trash?

## Possible code defects
* `lib/tasks/import-export.ts:284` (`applyTrashedTasks`): a Replace import clears `deletedTasks` and forgets no remembered id. Rule 4 of the resurrect spec says the id is forgotten when its Trash row leaves.
