# Doc refresh: S3-product-specs, round 5

Status: resolved
Clean round: no

This is the last round (cap). No later reviewer has checked the two fixes below.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/spec-top-three.md (full, and all 123 corpus cases against section 3) | ran |
| egm-codebase-details | tasks/spec-weekly-sweep.md, tasks/spec-escalation.md, tasks/spec-whats-new.md (full), and the status notes of the four finished documents | ran |

No style reviewer: this continuation runs accuracy reviewers only. Each reviewer got the settled list from rounds 1 to 4. The second reviewer found nothing new in spec-escalation.md, spec-whats-new.md, or the four status notes.

## Findings

### S3-5-1 [accuracy] Severity: Major
* Target: spec-weekly-sweep.md lines 3, 5
* Finding: The round 1 note said this file doesn't record native status. `lib/whats-new/whats-new.json:241-259` holds Apple 4.0.0 notes (2026-11-10) that announce the weekly sweep and the top three. The escalation and What's New specs already cite that file as their native evidence.
* Decision: PROPOSE FIX
* Reason: Confirmed in the notes file. No Android entry mentions either feature: the newest is 0.11.0.
* Edit: The "Web status" line now names the Apple 4.0.0 notes as the only native evidence here. I made the same change to the "Web status" line of spec-top-three.md, which had the same gap.

### S3-5-2 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 200
* Finding: Section 9's Entry row names `components/matrix-simplified/`, "command palette", and the dashboard page. The entry is `components/weekly-sweep/sweep-entry.tsx`, the palette action is in `lib/command-actions.ts:233`, the Review link is `components/weekly-sweep/sweep-link.tsx`, and Settings has a link in `components/settings/sweep-reminder-rows.tsx:62-66`.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing the folder and reading each mount point.
* Edit: Entry row web cell corrected.

### S3-5-3 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 150
* Finding: The spec names one Review link. The dashboard page mounts two (`page.tsx:233` in the empty state, `:279` after `ReviewPrompts`).
* Decision: DECLINE
* Reason: Consistent with "shown always".
* Edit: none

### S3-5-4 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md lines 109, 211
* Finding: `resetWeeklySweepState` clears three keys, but `tests/data/weekly-sweep-preferences.test.ts:59-77` asserts only the first two.
* Decision: DECLINE
* Reason: The note's claim is true in code. The gap is in the test, so it goes under possible code defects.
* Edit: none

### S3-5-5 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 112, 343
* Finding: Web locks Move and drag whenever `needsTidy` is true (`today-strip.tsx:126`), including after "Not now" hides the offer (`:137`).
* Decision: DECLINE
* Reason: Section 3.2 states the rule as "while `needsTidy` is true", and the code follows it. Sections 4 and 12 word it more loosely.
* Edit: none

### S3-5-6 [accuracy] Severity: Nit
* Target: spec-top-three.md line 106
* Finding: Pick rows reuse only the due chip. The title and complete control are the strip's own buttons (`components/today-strip/today-rows.tsx:58-72`).
* Decision: DECLINE
* Reason: Presentational. `components/today-strip/README.md` owns the detail.
* Edit: none

### S3-5-7 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 158, 165 (C4-2, C4-3)
* Finding: "Stamp the version only after a completed pull." Web stamps on `pullResult.authenticated` (`lib/sync/pb-sync-engine.ts:254, 338`). The doc comment at `lib/sync/pb-pull.ts:211-212` says a pull that skipped records "is not a whole pull", but only `sync-coordinator.ts:45` reads `skippedCount`. A row whose remote record failed validation gets no C4-4 repair, and its next push can clear the server's pick.
* Decision: ESCALATE
* Reason: Confirmed in the engine. The spec states a rule and the code may fall short of it. Possible code defect, not a document error.
* Edit: none

### S3-5-8 [accuracy] Severity: Nit
* Target: spec-top-three.md line 230
* Finding: "The app version did move afterward, to 14.8.0 (#712)" could read as the current version. `package.json:3` is 14.8.7.
* Decision: DECLINE
* Reason: The sentence is history and says "afterward". The status line already says "first shipped on web in 14.8.0".
* Edit: none
