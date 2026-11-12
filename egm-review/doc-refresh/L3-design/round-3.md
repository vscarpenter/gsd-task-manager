# Doc refresh: L3-design, round 3

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A1 (egm-codebase-details) | DESIGN.md lines 1-311 | ran |
| Accuracy A2 (egm-codebase-details) | DESIGN.md lines 312-475 | ran |
| Accuracy A3 (egm-codebase-details) | .ui-craft/tokens.md, brief.md, decisions.md, patterns.md, surfaces/saved.md | ran |

No style reviewer this round (rounds 1 and 2 only). Each reviewer was fresh and got the list of items already escalated.

## Findings

### L3-design-3-1 [A1] Severity: Nit
* Target: DESIGN.md lines 54-55
* Finding: the frontmatter key `warning-dark` is the dark-mode pigment. The CSS token `--warning-dark` is the warning ink (`app/css/inkwell-tokens.css:62,215`).
* Decision: DECLINE
* Reason: settled in round 1 (1-67 note, style B5). Frontmatter keys follow the `<role>-<theme>` pattern used by every other entry.
* Edit: none

### L3-design-3-2 [A1] Severity: Nit
* Target: DESIGN.md line 269
* Finding: "Pigments belong on icons". The pane header icon takes the ink (`components/matrix-simplified/quadrant-pane.tsx:155-156`).
* Decision: DECLINE
* Reason: declined in round 2 (2-15). Listed in the batch summary for the owner.
* Edit: none

### L3-design-3-3 [A1] Severity: Nit
* Target: DESIGN.md line 247
* Finding: filled destructive buttons use `--danger-fill`, not `--rust`. The light hex is the same.
* Decision: DECLINE
* Reason: the stated value is right, and `.ui-craft/tokens.md` names `--danger-fill`.
* Edit: none

### L3-design-3-4 [A1] Severity: Nit
* Target: DESIGN.md lines 224, 298-299
* Finding: tide also carries the informational status (`--info`, info toasts at `app/globals.css:781-783`).
* Decision: DECLINE
* Reason: the Tide Restraint Rule is intent. `--info` sharing the hex is noted in `.ui-craft/tokens.md`.
* Edit: none

### L3-design-3-5 [A1] Severity: Nit
* Target: code, against DESIGN.md lines 303-310
* Finding: `lib/quadrants.ts:83-158` keeps unread fields (`accentClass`, `colorClass`, `iconColor`) that bind quadrants to status tokens.
* Decision: DECLINE
* Reason: the document is right and nothing reads the fields. Listed in the batch summary as dead code.
* Edit: none

### L3-design-3-6 [A1] Severity: Nit
* Target: DESIGN.md lines 82-127
* Finding: frontmatter sizes are px. The code declares rem.
* Decision: DECLINE
* Reason: section 3 states the rem rule and the 16px root.
* Edit: none

### L3-design-3-7 [A2] Severity: Major
* Target: DESIGN.md lines 314-316
* Finding: the serif is said to carry "card titles". The task-card title is `text-small font-semibold`, sans (`components/task-card/task-card-header.tsx:73-74`). The serif is wired only to `.text-display`, `.text-h1`, `.text-h2`, `.text-h3` and `.text-numeral` (`app/globals.css:383-389`).
* Decision: PROPOSE FIX
* Reason: confirmed. The document's own section 6 ("don't let the serif leak into dense working UI") agrees with the code.
* Edit: the sentence now names the display and heading steps and stat numerals, and says task-card titles stay in the sans.

### L3-design-3-8 [A2] Severity: Major
* Target: DESIGN.md lines 444-449
* Finding: the card is said to carry a spine and a completion disc. The subtask progress fill also takes the pigment (`components/task-card/task-card-metadata.tsx:56-73`; comment at `components/task-card/index.tsx:39-41`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added one sentence on the subtask bar.

### L3-design-3-9 [A2] Severity: Major
* Target: DESIGN.md line 433
* Finding: "Error fields use the danger family". The rule exists only as `.input.is-error` (`app/css/inkwell-components.css:165-170`). No file under `app/` or `components/` applies it, and `components/ui/input.tsx` has no error styling.
* Decision: ESCALATE
* Reason: the document states the design rule and the CSS implements it. The components do not use it. Listed under possible code defects.
* Edit: none

### L3-design-3-10 [A2] Severity: Nit
* Target: DESIGN.md lines 369-371
* Finding: the usage test fails on any px arbitrary size and on numeric inline `fontSize`, and it passes rem and `clamp()` values.
* Decision: PROPOSE FIX
* Reason: confirmed in `tests/data/type-ramp-usage.test.ts:14-17`. The sentence was mine.
* Edit: the sentences now list what the test fails on and what it does not match.

### L3-design-3-11 [A2] Severity: Nit
* Target: DESIGN.md lines 404-411, 338
* Finding: the `ghost` variant is not described. Button draws its own tide ring. `text-eyebrow` does not set uppercase itself.
* Decision: DECLINE
* Reason: small omissions. The color and behavior claims hold.
* Edit: none

### L3-design-3-12 [A2] Severity: Nit
* Target: code, against DESIGN.md lines 446-447
* Finding: an unused `.matrix-grid` rule with `md:grid-cols-2` remains at `app/globals.css:457-459`.
* Decision: DECLINE
* Reason: the document is right. Dead CSS is listed with `.matrix-card` in the batch summary.
* Edit: none

### L3-design-3-13 [A3] Severity: Major
* Target: .ui-craft/surfaces/saved.md lines 13-22
* Finding: the document does not cover a refused move. `lib/tasks/saved-placement.ts:8-14` refuses completed tasks and tasks with a running timer. `components/matrix-simplified/task-actions.ts:140` shows the reason as an error toast.
* Decision: PROPOSE FIX
* Reason: confirmed in both files and in `lib/tasks/saved.ts:15-16`.
* Edit: added a two-sentence paragraph before "Required states".

### L3-design-3-14 [A3] Severity: Nit
* Target: .ui-craft/tokens.md line 203
* Finding: `--shadow-fab` is not an alias. It is a literal tide-tinted shadow with no consumer (`app/globals.css:228`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: the sentence now says only `--shadow-card` and `--shadow-column` alias `--shadow-sm`. The unused tide glow is in the batch summary.

### L3-design-3-15 [A3] Severity: Nit
* Target: tokens.md lines 100-102, 137; brief.md lines 90-91, 94-95; saved.md lines 14-22; decisions.md lines 30-31
* Finding: seven small points: more places carry quadrant color (header hint, empty-pane button, drop ring); the loader is `next/font/local`; focus goes to search after return or delete; delete moves to Trash; the Return form is prefilled; the search sentence describes the Saved page only; PRODUCT.md now says "keep the wash quiet"; a 19px semibold title may count as large text.
* Decision: DECLINE
* Reason: none misleads a reader about the code. The decisions.md point is a dated record.
* Edit: none
