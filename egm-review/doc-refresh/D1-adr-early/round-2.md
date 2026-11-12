# Doc refresh: D1-adr-early, round 2

Status: resolved
Clean round: no

Scope: fresh reviewers checked only the `Status note, 2026-11-12` blocks added in round 1. ADRs 0005 and 0010 have no note and were not reviewed again.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details C | notes in 0001 to 0004 | ran |
| egm-codebase-details D | notes in 0006 to 0009 | ran |

## Findings

### D1-adr-early-2-1 [accuracy C] Severity: Nit
* Target: 0001 note
* Finding: "One path besides sync" ignores the OS share sheet (`components/share-task-dialog/index.tsx:89`) and JSON export. The feedback post is the only other network request.
* Decision: PROPOSE FIX
* Reason: Confirmed `navigator.share` at that line.
* Edit: "One path" became "One network path".

### D1-adr-early-2-2 [accuracy C] Severity: Nit
* Target: 0002 note
* Finding: the entrypoint also rejects a key that is not 32 characters.
* Decision: DECLINE
* Reason: The note's claim holds; the detail belongs to the script.
* Edit: none

### D1-adr-early-2-3 [accuracy C] Severity: Major
* Target: 0003 note
* Finding: "keeps this device's reminder state" is conditional. `localReminderState` resets it when the pull moves the due date (`lib/sync/task-mapper.ts:214-217`). Only `parentTaskId` always stays (`:274`).
* Decision: PROPOSE FIX
* Reason: Confirmed by reading `localReminderState`.
* Edit: sentence now reads "keeps this device's `parentTaskId` and, unless the due date moved, its reminder state".

### D1-adr-early-2-4 [accuracy C] Severity: Major
* Target: 0003 note
* Finding: the exception list omits the far-future hold-off. A remote stamp past the skew ceiling does not replace a row with a pending queued write (`lib/sync/pb-sync-helpers.ts:293-297`, called at `lib/sync/pb-pull.ts:143` and `lib/sync/pb-sync-engine.ts:81`).
* Decision: PROPOSE FIX
* Reason: Confirmed the helper and both call sites.
* Edit: replaced the last sentence (the `pb-pull.ts` pointer) with one naming `holdsOffFarFutureRemote`.

### D1-adr-early-2-5 [accuracy C] Severity: Nit
* Target: 0003 note
* Finding: 3 small points: a far-future stamp never lifts a tombstone; the merge runs through `mapOverLocalCopy`; realtime applies the rules in `pb-sync-engine.ts`.
* Decision: DECLINE
* Reason: The note's claims hold. The `pb-pull.ts` pointer sentence is gone after 2-4.
* Edit: none

### D1-adr-early-2-6 [accuracy C] Severity: Nit
* Target: 0004 note
* Finding: `/auth/callback/` is a page route outside the precache list; the worker loads the generated `public/sw-cache-logic.js`; the immutable cache caps at 60 entries.
* Decision: DECLINE
* Reason: Small. ADR 0012, which the note links, records the generated copy and the cap.
* Edit: none

### D1-adr-early-2-7 [accuracy D] Severity: Major
* Target: 0007 note
* Finding: quiet hours do not live only in `reminder-window.ts`. `isInQuietHours` (`lib/notifications/permissions.ts:78`) stops the whole check at `lib/notification-checker.ts:86`.
* Decision: PROPOSE FIX
* Reason: Confirmed both lines.
* Edit: last sentence now names `isInQuietHours` for the gate and `reminder-window.ts` for the window rules.

### D1-adr-early-2-8 [accuracy D] Severity: Nit
* Target: 0007 note
* Finding: the reminder window stays open 60 minutes past due, so the badge can count a just-overdue task; returning a Saved task also resets `notificationSent`.
* Decision: DECLINE
* Reason: Small. The note's claims hold as written.
* Edit: none

### D1-adr-early-2-9 [accuracy D] Severity: Nit
* Target: 0008 note
* Finding: the note omits that the save check runs in edit mode only, that the picker hides cycle candidates, and where the BFS lives. Every claim in the note traced correct.
* Decision: DECLINE
* Reason: The ADR body already names `lib/dependencies.ts`. The note is at its length limit.
* Edit: none

### D1-adr-early-2-10 [accuracy D] Severity: Nit
* Target: 0009 note
* Finding: the parenthetical reads as if `lib/smart-views.ts` writes the table. It only reads.
* Decision: PROPOSE FIX
* Reason: Confirmed: the only writers are `lib/tasks/import-export.ts:311` and `:327`.
* Edit: removed `lib/smart-views.ts` from the parenthetical.

No findings on the 0006 note.
