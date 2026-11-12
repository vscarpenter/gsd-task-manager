# Doc refresh: S1-spec, round 3

Status: resolved
Clean round: no

Target: `tasks/spec.md` (mode FIX). Accuracy reviewers only; the style rounds ended with round 2.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details K | lines 1-539 | ran |
| egm-codebase-details L | lines 540-1087 | ran |
| egm-codebase-details M | lines 1088-1599 | ran |

## Findings

### S1-spec-3-1 [accuracy K] Severity: Major
* Target: line 289 (Violet Frost status block)
* Finding: the note names `DESIGN.md` and `app/css/inkwell-tokens.css` as the contract. The quadrant tokens live in `app/globals.css` (49 `--q*` matches there, none in `inkwell-tokens.css`).
* Decision: PROPOSE FIX
* Reason: Confirmed with `rg`.
* Edit: the note now names all three files.

### S1-spec-3-2 [accuracy K] Severity: Nit
* Target: lines 86-89
* Finding: the sheet, not the matrix handler, closes after the toggle, and the button needs the prop.
* Decision: DECLINE
* Reason: The reviewer calls the sentence acceptable as written.
* Edit: none

### S1-spec-3-3 [accuracy K] Severity: Nit
* Target: lines 528-531
* Finding: the Sonar and Vitest comparison does not list the test-file globs.
* Decision: DECLINE
* Reason: Sonar excludes test files through `sonar.exclusions`, so the effect is the same.
* Edit: none

### S1-spec-3-4 [accuracy L] Severity: Nit
* Target: lines 889-890
* Finding: `reset-everything-dialog.tsx` is 305 lines, not 280.
* Decision: DECLINE
* Reason: The sentence says "today" and is dated by the spec. Same as S1-spec-2-6.
* Edit: none

### S1-spec-3-5 [accuracy L] Severity: Nit
* Target: lines 587-589
* Finding: `stored` holds only rows that pass `keepValidTaskRecords` (`lib/use-tasks.ts:48-54`).
* Decision: PROPOSE FIX
* Edit: "every valid task row".

### S1-spec-3-6 [accuracy L] Severity: Nit
* Target: lines 664-666
* Finding: with more than one excluded match the message adds "and N more", and it appears in edit mode only (`edit-drawer-dependencies.tsx:234, 246-251`).
* Decision: PROPOSE FIX
* Edit: added both details.

### S1-spec-3-7 [accuracy M] Severity: Nit
* Target: lines 1118, 1190 (Design item 10, AC23)
* Finding: `updateBadge()` and `checkSweepReminder()` run past the single entry check in `processNotifications` (`lib/notification-checker.ts:72-110`). A lock that starts mid-check can still set the app badge from the previous user's due-soon count.
* Decision: ESCALATE
* Reason: AC23 says outside-the-page effects do nothing while a reset is pending. The code may be the side that is wrong. Listed under "Possible code defects".
* Edit: none

### S1-spec-3-8 [accuracy M] Severity: Nit
* Target: lines 1325-1335, 1354
* Finding: the shared server also exports `serveProductionExport`; the code-shape ratchet does not lint `scripts/`.
* Decision: DECLINE
* Reason: The spec lists what it added, and the constraint was a target for the author. Neither misleads.
* Edit: none

### S1-spec-3-9 [accuracy M] Severity: Nit
* Target: line 1470
* Finding: `audit` is not a job in `ci.yml`. It lives in `.github/workflows/security-audit.yml:19`.
* Decision: PROPOSE FIX
* Edit: one bullet in the "Changes since this spec" list.

### S1-spec-3-10 [accuracy M] Severity: could not check
* Target: lines 1112, 1184
* Finding: the reviewer could not confirm that ADR 0017 removed a component named `SentryInit`.
* Decision: PROPOSE FIX
* Reason: `git log -S SentryInit -- app/layout.tsx` gives `d969e745`, "remove sentry from web app and mcp server (#566)", dated 2026-09-28, the ADR's date.
* Edit: the Design item 4 note now cites PR #566 and the ADR.
