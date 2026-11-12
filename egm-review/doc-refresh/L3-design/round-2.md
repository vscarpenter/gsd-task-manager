# Doc refresh: L3-design, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A1 (egm-codebase-details) | DESIGN.md lines 1-310 | ran |
| Accuracy A2 (egm-codebase-details) | DESIGN.md lines 311-472 | ran |
| Accuracy A3 (egm-codebase-details) | .ui-craft/tokens.md, brief.md, decisions.md, patterns.md, surfaces/saved.md | ran |
| Style S1 (egm-style) | all six files | ran |

Each reviewer was fresh. Each got the list of round 1 items already escalated to the owner. Line numbers are the ones the reviewers saw at the start of this round.

## Findings

### L3-design-2-1 [A1] Severity: Nit
* Target: DESIGN.md lines 80-103, 119-124
* Finding: the vendored `.t-*` classes use weight 500 and the vendored `.eyebrow` class is mono, unlike the documented ramp.
* Decision: DECLINE
* Reason: settled in round 1 (1-6, 1-8). The document matches the `text-*` utilities the app uses.
* Edit: none

### L3-design-2-2 [A1] Severity: Nit
* Target: DESIGN.md lines 252-257
* Finding: "Muted text uses `#6E6760` or darker" sits beside the lighter `--ink-3`.
* Decision: DECLINE
* Reason: declined in round 1 (1-17). The policy side is escalated under 2-17.
* Edit: none

### L3-design-2-3 [A1] Severity: Nit
* Target: DESIGN.md lines 205-206
* Finding: `app/css/` holds three files. `inkwell-theme.css` is kept for reference and not imported (`app/globals.css:1-7`).
* Decision: PROPOSE FIX
* Reason: confirmed in `app/globals.css:1-7`. The sentence was one I added in round 1.
* Edit: the sentence now says the app imports the two files from `app/css/`.

### L3-design-2-4 [A2] Severity: Major
* Target: DESIGN.md lines 443-444
* Finding: "a completion disc in the same quadrant pigment". The disc takes the pigment only when the task is complete. At rest it is neutral (`components/task-card/task-card-header.tsx:117-127`).
* Decision: PROPOSE FIX
* Reason: confirmed. `tests/ui/task-card-anatomy.test.tsx:126-130` asserts the fill "when complete".
* Edit: the sentence now says the disc is neutral at rest and fills with the pigment on completion.

### L3-design-2-5 [A2] Severity: Major
* Target: DESIGN.md line 444
* Finding: "two columns on desktop and one stacked column on mobile". The switch is a container query at 696px (`components/matrix-simplified/matrix-grid.tsx:61,73`). The code comment at lines 48-56 rejects a viewport breakpoint. Round 1 declined this as a Nit (1-33).
* Decision: PROPOSE FIX
* Reason: confirmed. A desktop viewport with a narrow container gets one column.
* Edit: the sentence now states the 696px container rule.

### L3-design-2-6 [A2] Severity: Nit
* Target: DESIGN.md line 436
* Finding: the top bar slides away on scroll below `md` on the matrix, and the rail can collapse.
* Decision: DECLINE
* Reason: the bar and rail stay part of the shell. The detail belongs to the components.
* Edit: none

### L3-design-2-7 [A2] Severity: Nit
* Target: DESIGN.md lines 437-438
* Finding: below 1024px a horizontal pill scroller replaces the settings sidebar.
* Decision: DECLINE
* Reason: "collapses below 1024px" is correct for the breakpoint.
* Edit: none

### L3-design-2-8 [A2] Severity: Nit
* Target: DESIGN.md lines 321-322
* Finding: `.kicker` is used only under `components/about/`. No docs surface uses it.
* Decision: DECLINE
* Reason: the line says where the kicker is sanctioned, which is intent.
* Edit: none

### L3-design-2-9 [A2] Severity: Nit
* Target: DESIGN.md line 423
* Finding: `.stat-card` padding is `20px 22px 18px`, and no component uses the class.
* Decision: PROPOSE FIX
* Reason: confirmed (`app/css/inkwell-components.css:312`). The sentence was one I wrote in round 1.
* Edit: now reads "18-22px, and no component uses that class".

### L3-design-2-10 [A2] Severity: Nit
* Target: DESIGN.md line 406
* Finding: the Button variant is named `subtle`, not `secondary` (`components/ui/button.tsx:4-10`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added "(the `subtle` variant)".

### L3-design-2-11 [A2] Severity: Nit
* Target: DESIGN.md lines 380, 384
* Finding: icon-only `Button` instances get 10px, and rail items use the 20px step.
* Decision: DECLINE
* Reason: radius ladder drift is escalated as a group (1-1, 1-22, 1-23).
* Edit: none

### L3-design-2-12 [A2] Severity: Nit
* Target: DESIGN.md lines 366-369
* Finding: "the mechanical detector" is not in the repository. The usage test matches px sizes and bare numbers only, not rem.
* Decision: PROPOSE FIX
* Reason: confirmed in `tests/data/type-ramp-usage.test.ts:14-17`. Same issue as 2-21.
* Edit: see 2-21.

### L3-design-2-13 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 71-73
* Finding: the `--ink-3` figures I quoted in round 1 (4.55:1 and 4.19:1) come from a stale CSS comment. `#797368` computes to 4.70:1 on white and 4.17:1 on ivory.
* Decision: PROPOSE FIX
* Reason: recomputed by hand (L = 0.1732; ivory L = 0.8801).
* Edit: the sentence now gives the computed figures and no longer cites the comment. The stale comment at `app/css/inkwell-tokens.css:69-70` is in the batch summary.

### L3-design-2-14 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 82-83
* Finding: `--sky` has no paired ink or on-color token. `--info` pairs with `--on-accent` only because it shares the accent hex.
* Decision: PROPOSE FIX
* Reason: no `--on-warning`, `--on-info` or `--on-sky` token exists in `app/css/inkwell-tokens.css`. Same issue as 2-19.
* Edit: see 2-19.

### L3-design-2-15 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 100-101; brief.md lines 90-91
* Finding: the pane header icon uses the quadrant ink, not the pigment (`components/matrix-simplified/quadrant-pane.tsx:152-157`). `tests/ui/task-card-anatomy.test.tsx:240` asserts it.
* Decision: DECLINE
* Reason: a Nit. Ink and pigment differ for Q3 and Q4 in light only. The brief line is a learned constraint, so the owner decides. Listed in the batch summary.
* Edit: none

### L3-design-2-16 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 137-138
* Finding: "serif text never asks for [an italic]", but the vendored `em.accent, .serif em` rule asks for one (`inkwell-components.css:84`). No component uses it.
* Decision: DECLINE
* Reason: the rule is dormant.
* Edit: none

### L3-design-2-17 [S1] Severity: Major
* Target: DESIGN.md 252-257, 432; tokens.md 65, 71-73; brief.md 68
* Finding: `--ink-3` text sits below the stated muted-text floor and below 4.5:1 on ivory. The documents do not say what size of `--ink-3` text ivory allows.
* Decision: ESCALATE
* Reason: where `--ink-3` may carry text is a contrast policy. The code uses it as text (`quadrant-pane.tsx:183`). The owner must set the rule.
* Edit: none (the figures are corrected under 2-13)

### L3-design-2-18 [S1] Severity: Major
* Target: tokens.md 95, 100, 133; DESIGN.md 306-307, 464-465
* Finding: the Blocking status ink is a quadrant token, against the priority-only rule.
* Decision: ESCALATE
* Reason: settled in round 1 (1-14). The document now states the real mapping, and the rule conflict sits with the owner.
* Edit: none

### L3-design-2-19 [S1] Severity: Major
* Target: tokens.md lines 81, 83
* Finding: two "On solid fill" cells name no token ("the theme's contrast-safe ink", "the paired semantic ink").
* Decision: PROPOSE FIX
* Reason: the code defines no on-color token for warning or sky.
* Edit: both cells now read "No `--on-*` token is defined".

### L3-design-2-20 [S1] Severity: Major
* Target: tokens.md lines 154-155
* Finding: "430 token" in the Weight column is unexplained.
* Decision: PROPOSE FIX
* Reason: the weight is the literal 430 (`app/globals.css:79,82`). No weight token exists.
* Edit: both cells now read "430".

### L3-design-2-21 [S1] Severity: Major
* Target: DESIGN.md lines 366-369
* Finding: "the mechanical detector" has no referent, and "covers that gap" does not say which gap.
* Decision: PROPOSE FIX
* Reason: the test's patterns are in `tests/data/type-ramp-usage.test.ts:14-17`.
* Edit: my round 1 sentence now lists what the test fails on and what it scans. The detector itself is not in this repository, so its name stays and is flagged for the owner.

### L3-design-2-22 [S1] Severity: Major
* Target: DESIGN.md lines 338-339, 382, 423-425
* Finding: "stat card" names both the Review page's stats and the `.stat-card` class.
* Decision: PROPOSE FIX
* Reason: `components/dashboard/stats-card.tsx` does not use `.stat-card`.
* Edit: the Numeral line now says "the Review page's stats". Lines 382 and 423 say "the vendored `.stat-card` class" and call the Review stats a separate component.

### L3-design-2-23 [S1] Severity: Major
* Target: DESIGN.md 3, 205-206, 373; tokens.md 9; brief.md 14
* Finding: my round 1 sentence defines GSD Editorial as a palette, yet the documents use the name for the whole system.
* Decision: PROPOSE FIX
* Reason: `app/css/inkwell-tokens.css:4` calls it the brand palette. The documents use it more broadly.
* Edit: the sentence now says the name covers the palette and, in this document, the system as GSD ships it.

### L3-design-2-24 [S1] Severity: Major
* Target: tokens.md lines 11-17, 72-73, 171-188
* Finding: "Use semantic or component tokens in UI code" sits beside guidance to use foundation tokens. The semantic layer has no file location.
* Decision: ESCALATE
* Reason: the layering rule is a stated policy. The code uses foundation tokens through Tailwind aliases throughout. The owner must say which holds.
* Edit: none
