# Doc refresh: S1-spec, round 5

Status: resolved
Clean round: yes

Target: `tasks/spec.md` (mode FIX). Accuracy reviewers only. This is the cap. Round 4 was not clean, so the batch ends at "cap reached", with one clean round.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details Q | lines 1-539 | ran |
| egm-codebase-details R | lines 540-1088 | ran |
| egm-codebase-details S | lines 1089-1602 | ran |

## Findings

No Blocker and no Major from any reviewer.

### S1-spec-5-1 [accuracy Q] Severity: Nit
* Target: line 455, line 496
* Finding: onboarding uses the shared dialog, but `doctor.config.jsonc:22` still carries its override.
* Decision: PROPOSE FIX
* Edit: added "though its override is still in the config".

### S1-spec-5-2 [accuracy Q] Severity: Nit
* Target: line 289
* Finding: `tests/data/editorial-theme.test.ts:187-195` checks the retired colors only in the SVG icons, the social image, and the linked report.
* Decision: PROPOSE FIX
* Edit: the note now names that scope.

### S1-spec-5-3 [accuracy Q] Severity: Nit
* Target: lines 413-416
* Finding: "pending" also covers a queue row with no status (`lib/sync/queue.ts:23-26`).
* Decision: DECLINE
* Reason: The note points to the function that owns the detail.
* Edit: none

### S1-spec-5-4 [accuracy R] Severity: Nit
* Target: lines 946-950
* Finding: the dialog component is unchanged; `ResetLockGate` is what removes it from view.
* Decision: PROPOSE FIX
* Edit: the note now names `components/reset-lock-gate.tsx` and says the dialog itself is unchanged.

### S1-spec-5-5 [accuracy R] Severity: Nit
* Target: lines 630-631
* Finding: suggestions are portalled to `document.body`, and the wrapper's `onBlur` closes the popup when focus leaves the wrapper (`edit-drawer-dependencies.tsx:94-96`). Tab may no longer reach a suggestion. The reviewer could not confirm it without running the app.
* Decision: ESCALATE
* Reason: The spec states an accessibility rule ("tabbable"). Whether the code breaks it needs a browser check. Listed under "Possible code defects" as unconfirmed.
* Edit: none

### S1-spec-5-6 [accuracy R] Severity: Nit
* Target: lines 828-830, 924-925
* Finding: two more fenced task writers exist; delete account calls `resetEverything` or `disableSync`, not both directly.
* Decision: DECLINE
* Reason: Missing detail, and the stated conclusion holds either way.
* Edit: none

### S1-spec-5-7 [accuracy S] Severity: Nit
* Target: lines 1491-1494
* Finding: the round 4 wording had the mechanism backwards. The `clearIndexedDB` fixture removes the worker unless `serviceWorkerEnabled` is true (`tests/e2e/fixtures/test-fixtures.ts:101-116`).
* Decision: PROPOSE FIX
* Edit: replaced the sentence with that statement.

### S1-spec-5-8 [accuracy S] Severity: Nit
* Target: lines 1114, 1181
* Finding: Try again reloads whenever `local-data` did not fail, and the spec omits the announced error text.
* Decision: DECLINE
* Reason: Same as S1-spec-4-9.
* Edit: none
