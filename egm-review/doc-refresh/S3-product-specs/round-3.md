# Doc refresh: S3-product-specs, round 3

Status: resolved
Clean round: yes

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/spec-top-three.md | ran |
| egm-codebase-details | tasks/spec-weekly-sweep.md, tasks/spec-escalation.md, tasks/spec-whats-new.md (full), tasks/spec-ios27-refresh.md (status note) | ran |

No style reviewer: the brief limits style review to rounds 1 and 2. The status notes of the other three finished documents had no Blocker or Major in round 2 and were not changed after it.

## Findings

### S3-3-1 [accuracy] Severity: Nit
* Target: spec-top-three.md line 5
* Finding: "The web release is 14.8.0" reads as the current version. `package.json:3` is 14.8.7.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now "It first shipped on web in 14.8.0."

### S3-3-2 [accuracy] Severity: Nit
* Target: spec-top-three.md line 240
* Finding: "Sends both keys on every write" is inexact. `taskDependencyPatchToPBFields` (`packages/mcp-server/src/write-ops/helpers.ts:266`) sends neither key.
* Decision: PROPOSE FIX
* Reason: Confirmed in `helpers.ts:58, 78, 243, 266`.
* Edit: Now says each task create and update, and that the dependency-only patch omits them.

### S3-3-3 [accuracy] Severity: Nit
* Target: spec-top-three.md line 295
* Finding: The cited test now spans `tests/docker-migrations.test.ts:112-119`.
* Decision: DECLINE
* Reason: Declined in round 1 as S3-1-23. The cited lines fall inside the test.
* Edit: none

### S3-3-4 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md lines 18, 62, 213
* Finding: New date and Add date have no Undo on web (`components/weekly-sweep/sweep-actions.ts:57-70`), which matches the matrix edit path.
* Decision: DECLINE
* Reason: The spec says "the Undo it already has", and this path has none. Noted under possible code defects with the date control item.
* Edit: none

### S3-3-5 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 100
* Finding: Turning the reminder back on keeps the earlier day and time (`sweep-reminder-rows.tsx:55-59`). Sunday 09:00 applies only with nothing stored.
* Decision: DECLINE
* Reason: Consistent with "starts at".
* Edit: none

### S3-3-6 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md lines 60-61, 152
* Finding: The re-check can show a card under a new reason, and skipped cards make the position jump (`use-sweep-session.ts:33-46`).
* Decision: DECLINE
* Reason: Same ground as the session ambiguity escalated in S3-1-55.
* Edit: none

### S3-3-7 [accuracy] Severity: Nit
* Target: spec-whats-new.md lines 33, 82
* Finding: The content test requires a null headline on a non-notable release and at least one release per platform (`tests/data/whats-new-content.test.ts:20-43`). Section 3 states neither.
* Decision: DECLINE
* Reason: Declined in round 1 as part of S3-1-46. Worth the owner's eye, since native authors edit this file.
* Edit: none
