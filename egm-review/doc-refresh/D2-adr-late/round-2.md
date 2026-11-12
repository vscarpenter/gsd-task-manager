# Doc refresh: D2-adr-late, round 2

Status: resolved
Clean round: no

Two fresh reviewers checked only the nine status notes written in round 1. One Major, in the ADR 0015 note. ADR 0017 has no note and was not reviewed again.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | status notes in ADR 0011, 0012, 0013, 0014, 0015 | ran |
| egm-codebase-details | status notes in ADR 0016, 0018, 0019, 0020 | ran |

## Findings

### D2-adr-late-2-1 [codebase-details] Severity: Major
* Target: 0015 status note
* Finding: the note said sync puts a task in Trash "when its queued edits are all retry-exhausted". Both writers act only on a task the server no longer has (`planRemoteAbsence` in `lib/sync/pb-pull.ts:306-312`, the realtime `delete` branch in `lib/sync/pb-sync-engine.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed. `planRemoteAbsence` skips any task the remote index still lists.
* Edit: the note now reads "when the server copy is gone and its queued edits are all retry-exhausted".

### D2-adr-late-2-2 [codebase-details] Severity: Nit
* Target: 0015 status note
* Finding: sign-out also remembers a queued Trash delete (`lib/sync/config/disable.ts:59-62`). A Replace import clears Trash without scoping `syncMetadata`.
* Decision: DECLINE
* Reason: The first is covered by the linked spec. The second is listed under "Possible code defects".
* Edit: none

### D2-adr-late-2-3 [codebase-details] Severity: Nit
* Target: 0012 status note
* Finding: `isShareTargetPost` is defined in `lib/sw-cache-logic.ts:147-153`, and `public/sw.js` only calls it.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: dropped "in `public/sw.js`" from the note.

### D2-adr-late-2-4 [codebase-details] Severity: Nit
* Target: 0012 status note
* Finding: `/_next/static/*` also starts with `/_` and is cached. A second test file exists.
* Decision: DECLINE
* Reason: The note says "`/api` and `/_` paths" and the code matches `/_` and `/_/` exactly. The count names one file.
* Edit: none

### D2-adr-late-2-5 [codebase-details] Severity: Nit
* Target: 0013 status note
* Finding: `mapOverLocalCopy` maps over the live, archive, or Trash row, and it is a merge, not a "limit".
* Decision: PROPOSE FIX
* Reason: Valid (`lib/sync/pb-sync-helpers.ts:319-326`).
* Edit: "two later limits" became "two later changes", and "the archive row" became "the local row it replaces".

### D2-adr-late-2-6 [codebase-details] Severity: Nit
* Target: 0014 status note
* Finding: a whole-payload bound runs before the per-row check. The default reminder applies to live tasks only.
* Decision: DECLINE
* Reason: The note stays correct as written.
* Edit: none

### D2-adr-late-2-7 [codebase-details] Severity: Nit
* Target: 0016 status note
* Finding: the fourth `1781*` migration encrypts nothing. A third Docker folder exists. Other hooks may also postdate the ADR.
* Decision: PROPOSE FIX
* Reason: The first point is valid. `git log` dates the other hooks: `account_lifecycle` and `feedback_controls` predate the ADR (2026-09-04).
* Edit: "a fourth encryption migration" became "a fourth migration in the encryption set".

### D2-adr-late-2-8 [codebase-details] Severity: Nit
* Target: 0018 status note
* Finding: the sweep's "saved" bucket needs 30 days (`lib/weekly-sweep.ts:26, 91-92`).
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: added "after 30 days".

### D2-adr-late-2-9 [codebase-details] Severity: Nit
* Target: 0019 status note
* Finding: the note said "three statements" and listed four. Push also reads the focus pair from the row.
* Decision: PROPOSE FIX
* Reason: The count was wrong.
* Edit: "three" became "four".

### D2-adr-late-2-10 [codebase-details] Severity: Nit
* Target: 0020 status note
* Finding: `resurrect-on-sight.ts:120` is a third caller of the hold-off. A row with no status counts as pending. The reset writes a config only when a device id existed.
* Decision: DECLINE
* Reason: None changes what a reader would do.
* Edit: none
