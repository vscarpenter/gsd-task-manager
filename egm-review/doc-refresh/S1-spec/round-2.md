# Doc refresh: S1-spec, round 2

Status: resolved
Clean round: no

Target: `tasks/spec.md` (mode FIX). Accuracy reviewers checked the 2026-11-12 notes and any uncovered difference in the original text. Style reviewers checked only the 2026-11-12 notes, because the original decision text stays as written.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details F | lines 1-536 | ran |
| egm-codebase-details G | lines 537-1068 | ran |
| egm-codebase-details H | lines 1069-1577 | ran |
| egm-style I | lines 1-758 | ran |
| egm-style J | lines 759-1577 | ran |

## Findings

Line numbers are the ones the reviewers saw (after round 1 edits).

### S1-spec-2-1 [accuracy F] Severity: Nit
* Target: lines 413-415
* Finding: the note says "three outcomes" and lists two. `abandon` fires on at least one failed row with none pending, not "all failed" (`lib/sync/queue.ts:65-74`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `classifyRemoteDeletion`.
* Edit: rewrote the note to state all three outcomes and the exact condition.

### S1-spec-2-2 [accuracy F] Severity: Nit
* Target: lines 435, 416
* Finding: the note gives the container-query mechanism but not that single-column at tablet width depends on the rail.
* Decision: PROPOSE FIX
* Edit: the note now gives the 696px container threshold.

### S1-spec-2-3 [accuracy F] Severity: Nit
* Target: lines 86-89
* Finding: the sheet shows the button only when `onToggleComplete` is passed, and the prop does the saving (`task-detail-sheet.tsx:301-303`, `index.tsx:407`).
* Decision: PROPOSE FIX
* Edit: reworded to "the matrix gives the detail sheet" and "saves the change through the matrix's toggle handler".

### S1-spec-2-4 [accuracy G] Severity: Major
* Target: lines 962-964 (AC12), 921
* Finding: the fence spec says a failed reset keeps the dialog open and that locking the matrix is out of scope. The reset lock now unmounts the app during a reset (`components/reset-lock-gate.tsx:24-41`, `lib/reset-everything.ts:198-216`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The next spec in the file made that change.
* Edit: dated paragraph under Out of Scope pointing to the next spec.

### S1-spec-2-5 [accuracy G] Severity: Major
* Target: lines 713-717
* Finding: the create-wiring test has a different name, and it asserts only the "present" case (`tests/ui/matrix-simplified.test.tsx:693-715`).
* Decision: PROPOSE FIX
* Reason: Confirmed. `index.tsx:297` does pass `undefined` when empty, so the code meets AC6; only the test for that half is missing.
* Edit: the Test Stubs note names the test and states the gap.

### S1-spec-2-6 [accuracy G] Severity: Nit
* Target: lines 880-881
* Finding: `reset-everything-dialog.tsx` is 305 lines, not 280.
* Decision: DECLINE
* Reason: The sentence says "today" and is dated by the spec.
* Edit: none

### S1-spec-2-7 [accuracy H] Severity: Major
* Target: lines 1092, 1125, 1151-1153
* Finding: the `local-data` step can fail on a weekly-sweep cleanup error with IndexedDB already empty.
* Decision: ESCALATE (already settled as S1-spec-1-22 and S1-spec-1-31)
* Reason: Possible code defect. Not edited.
* Edit: none

### S1-spec-2-8 [accuracy H] Severity: Nit
* Target: lines 1276, 1470-1472
* Finding: only the "Saved offline" group in `saved-tasks.spec.ts` turns the worker on (`saved-tasks.spec.ts:128-134`).
* Decision: PROPOSE FIX
* Edit: both notes now say "all of `share-target.spec.ts` and the "Saved offline" group in `saved-tasks.spec.ts`".

### S1-spec-2-9 [accuracy H] Severity: unverifiable
* Target: line 1451
* Finding: "the e2e matrix stays advisory" against a guard test titled "blocking CI matrix".
* Decision: ESCALATE (already raised in round 1)
* Reason: The ruleset is not in the repo.
* Edit: none

### S1-spec-2-10 [style I] Severity: Major
* Target: line 541 (and 764, 1073)
* Finding: "marked below with this date" points at the wrong date.
* Decision: PROPOSE FIX
* Edit: all four status blocks now say "the date 2026-11-12".

### S1-spec-2-11 [style I] Severity: Major
* Target: lines 413-415, 615-617, 453, 289, 583-584, 658-660, 678-680, 525-528, 5
* Finding: nine notes were unclear: an unnamed third outcome; a raw line count beside a counted limit; a claim about file-level suppressions; "Inkwell" and "tide" undefined; `stored` and "Saved tasks" undefined; "blocking task" ambiguous; the palette item overstated; unnamed Sonar and Vitest entries; unclear acceptance-box sentence.
* Decision: PROPOSE FIX
* Reason: Each fix restates a fact already confirmed in code (`lib/use-tasks.ts:54-56`, `edit-drawer-dependencies.tsx:245-251`, `doctor.config.jsonc` header, `sonar-project.properties:37-44`, `vitest.config.ts:56-57`, `app/css/inkwell-tokens.css:1-8`). The command palette has no dependency code.
* Edit: reworded each note.

### S1-spec-2-12 [style I] Severity: Major
* Target: lines 413, 678, 86, 580
* Finding: "Shipped (2026-11-12)" reads as a ship date.
* Decision: PROPOSE FIX
* Edit: those labels now read "noted 2026-11-12" or "Current behavior (noted 2026-11-12)".

### S1-spec-2-13 [style I] Severity: not a finding
* Target: lines 60, 188
* Finding: both cite PR #466.
* Decision: CONTEST
* Reason: `git log -- app/design-lab` shows `875ce5e6`, "feat: explore and ship the Refined Evolution hybrid (#466)". One PR carried both.
* Edit: none

### S1-spec-2-14 [style J] Severity: Major
* Target: lines 1473, 1276
* Finding: "(see AC7)" points at text that says `bun run build`; the export config does not build; `testMatch` was attached to the wrong file; the Sentry sentence named no target.
* Decision: PROPOSE FIX
* Reason: Confirmed in `package.json:16`, `playwright.export.config.ts:3-4`, and `ci.yml:165`.
* Edit: rewrote both notes.

### S1-spec-2-15 [style J] Severity: Major
* Target: lines 930-932
* Finding: "replaces the edge case" does not say what happens now; the date read as the fencing date.
* Decision: PROPOSE FIX
* Reason: `lib/sync/config/disable.ts:89-91` states the behavior. `git log -S` on `lib/sync/pb-push.ts` gives `88e6d006` for the push fence; `7a5276ff` (#734) did not touch that file.
* Edit: rewrote the paragraph.

### S1-spec-2-16 [style J] Severity: Major
* Target: lines 971-972, 1073/1094/1117/1182, 1266-1267
* Finding: the "different file" note had no referent; three reset-lock parentheses lacked the 2026-11-12 date; "a third test" was unclear.
* Decision: PROPOSE FIX
* Edit: the Test Stubs note names the stub and both files; the three parentheses carry the date; the AC map note names the third test.

## Carried forward (not edited, see the final summary)
* Possible code defects: S1-spec-1-22 / 1-31 / 2-7, S1-spec-1-24, S1-spec-1-39.
* Record wording escalated to the owner: S1-spec-1-11, S1-spec-1-45, S1-spec-1-50.
