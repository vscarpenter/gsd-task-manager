# Doc refresh: S1-spec, round 4

Status: resolved
Clean round: no

Target: `tasks/spec.md` (mode FIX). Accuracy reviewers only. The one Major is new and concerns the code, not a refresh note, so the round is not clean even though the document needed only nit edits.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details N | lines 1-539 | ran |
| egm-codebase-details O | lines 540-1088 | ran |
| egm-codebase-details P | lines 1089-1602 | ran |

## Findings

### S1-spec-4-1 [accuracy P] Severity: Major
* Target: line 1149 ("Sync on a locked load")
* Finding: the spec says sync starts on a locked load only when sign-out, the wipe, and the storage cleanup all failed. `resetEverything` writes the marker (`lib/reset-everything.ts:198`) before step 1 calls `disableSync` (`:144`). A tab closed between the two leaves the marker, the auth token, and an enabled `sync_config`, with no failed step. On the next load `SyncProvider` starts once (`lib/sync/sync-provider.tsx:84-87`), and `readSyncEnabled` returns true (`lib/sync/sync-status-store.ts:216`).
* Decision: ESCALATE
* Reason: The spec's edge-case analysis and the code disagree, and the code may be the side that needs the guard. Listed under "Possible code defects". The reviewer did not trace whether a sync round trip completes before the gate unmounts the provider.
* Edit: none

### S1-spec-4-2 [accuracy N] Severity: Nit
* Target: line 496
* Finding: onboarding is no longer a hand-rolled modal. It uses `components/ui/dialog` (`components/onboarding/onboarding.tsx:6-11`).
* Decision: PROPOSE FIX
* Edit: one clause added to the react-doctor status block. The stale "Hand-rolled modals" comment in `doctor.config.jsonc` is outside this batch.

### S1-spec-4-3 [accuracy N] Severity: Nit
* Target: lines 417-419
* Finding: 696px is the container's width (`matrix-grid.tsx:61, 73`), not the grid's.
* Decision: PROPOSE FIX
* Edit: "of container width".

### S1-spec-4-4 [accuracy N] Severity: Nit
* Target: line 60
* Finding: the note lists four of the five directions.
* Decision: DECLINE
* Reason: The four are the ones the Inputs section names besides Refined Evolution itself.
* Edit: none

### S1-spec-4-5 [accuracy O] Severity: Nit
* Target: lines 940-944, 828-830
* Finding: the push fence also covers `settleRowOffset` and a pre-read check, which the note does not list.
* Decision: DECLINE
* Reason: The note points to the file that owns the detail. A full list would drift.
* Edit: none

### S1-spec-4-6 [accuracy O] Severity: Nit
* Target: lines 721-727, 989-992
* Finding: more stub names and describe blocks differ than the notes count.
* Decision: PROPOSE FIX for the count; DECLINE the rest
* Edit: "Shipped names differ in three places" now reads "Some shipped test names differ".

### S1-spec-4-7 [accuracy O] Severity: Nit
* Target: lines 576-581, 614-615
* Finding: the edit save now sends only changed fields (`use-drawer-save.ts:49`, `index.tsx:283`).
* Decision: DECLINE
* Reason: Edge case 4 still holds, and the spec does not state the mechanism as a rule.
* Edit: none

### S1-spec-4-8 [accuracy P] Severity: Nit
* Target: lines 1491-1494
* Finding: `about.spec.ts` does not use the `clearIndexedDB` fixture, so "Every other test still runs without it" is too broad.
* Decision: PROPOSE FIX
* Edit: "Tests that use the `clearIndexedDB` fixture still run without it."

### S1-spec-4-9 [accuracy P] Severity: Nit
* Target: lines 1114, 1181, 1478, 1476
* Finding: Try again reloads whenever `local-data` did not fail; browsers preconnect to the hosted backend; local composite actions are not SHA pinned.
* Decision: DECLINE
* Reason: Design item 9 and the dated notes already cover each in substance.
* Edit: none
