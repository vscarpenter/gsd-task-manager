# Doc refresh: L3-design, round 5

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A1 (egm-codebase-details) | DESIGN.md lines 1-311 | ran |
| Accuracy A2 (egm-codebase-details) | DESIGN.md lines 312-478 | ran |
| Accuracy A3 (egm-codebase-details) | .ui-craft/tokens.md, brief.md, decisions.md, patterns.md, surfaces/saved.md | ran |

Each reviewer was fresh and got the list of items already escalated. This is the last round the brief allows. No document was edited this round.

## Findings

### L3-design-5-1 [A2] Severity: Major
* Target: DESIGN.md lines 359-361
* Finding: "headings must use `.text-display`/`.text-h1`/`.text-h2`/`.text-h3`, not their Tailwind-spelling equivalents". Eight heading elements use spellings and render in the sans, for example `components/today-strip/today-strip.tsx:118`, `components/matrix-simplified/task-detail-sheet.tsx:352`, `components/dashboard/time-analytics.tsx:72,137`, `components/pwa-update-toast.tsx:109`. The `font-display` class on `today-strip.tsx:118` has no token behind it (`app/globals.css:56-58` defines serif, sans and mono only).
* Decision: ESCALATE
* Reason: confirmed for `today-strip.tsx:118` and the `@theme` block. The document states the rule and the code strays from it. Listed under possible code defects.
* Edit: none

### L3-design-5-2 [A1] Severity: Major
* Target: DESIGN.md lines 216-217, 224, 298-301
* Finding: more non-interactive tide call sites: `components/about/feature-card.tsx:20-21` (tide wash behind an icon), `components/about/footer-cta.tsx:24` (`shadow-accent/20` glow), tide kickers and icons on the About page, tide spinners and a tide count badge in `components/sync/`.
* Decision: ESCALATE
* Reason: the same issue as 4-1, already with the owner. These are further call sites, not a new document error. Added to the possible code defects list.
* Edit: none

### L3-design-5-3 [A1] Severity: Nit
* Target: code comment, against DESIGN.md lines 270-272
* Finding: `components/matrix-simplified/quadrant-pane.tsx:38-39` says ochre ink on ochre measures under 4.5:1. `#74591C` computes to 5.44:1 on the Q3 header.
* Decision: DECLINE
* Reason: the document is right. The stale comment is in the batch summary.
* Edit: none

### L3-design-5-4 [A1] Severity: Nit
* Target: DESIGN.md lines 155, 163, 177
* Finding: the frontmatter 38px height applies to fine pointers only.
* Decision: DECLINE
* Reason: settled in round 1 (1-9). Section 5 states the 44px rule.
* Edit: none

### L3-design-5-5 [A2] Severity: Nit
* Target: DESIGN.md lines 396-397
* Finding: several shipped curves are `ease` or ease-in-out, not ease-out. View transitions give exit and entrance the same 0.3s.
* Decision: DECLINE
* Reason: motion drift from the stated vocabulary is escalated as a group (1-28). Added to that item in the batch summary.
* Edit: none

### L3-design-5-6 [A2] Severity: Nit
* Target: DESIGN.md lines 322-325, 377, 402
* Finding: mono also sets the task timer and confirmation words. Vendored `kbd`, `.tab` and timeline rules use 2px borders. Only `button.tsx`, `input.tsx` and `badge.tsx` under `components/ui/` compose Inkwell classes.
* Decision: DECLINE
* Reason: small. The mono uses fit "equal-width glyphs carry meaning". The other two do not mislead a reader about a value.
* Edit: none

### L3-design-5-7 [A2] Severity: Nit
* Target: DESIGN.md lines 368-373, 478
* Finding: `app/global-error.tsx:152` sets a 2rem sans heading at weight 700, which the usage test cannot see.
* Decision: DECLINE
* Reason: the file is standalone by design (its own comment, lines 10-12). The document states the test's limit.
* Edit: none

### L3-design-5-8 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 144-146
* Finding: `.kicker` lives in `app/globals.css:448-455`, and the document gives no location.
* Decision: DECLINE
* Reason: declined in round 1 (1-44). The values match.
* Edit: none

### L3-design-5-9 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 4-5
* Finding: the header comment says status tokens live in `inkwell-tokens.css`. The `--status-*` aliases live in `app/globals.css:204-215`.
* Decision: DECLINE
* Reason: lines 14-15 of the same file place the `--status-*` aliases in `globals.css` correctly.
* Edit: none
