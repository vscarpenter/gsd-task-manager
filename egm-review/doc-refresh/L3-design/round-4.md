# Doc refresh: L3-design, round 4

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A1 (egm-codebase-details) | DESIGN.md lines 1-311 | ran |
| Accuracy A2 (egm-codebase-details) | DESIGN.md lines 312-478 | ran |
| Accuracy A3 (egm-codebase-details) | .ui-craft/tokens.md, brief.md, decisions.md, patterns.md, surfaces/saved.md | ran |

Each reviewer was fresh and got the list of items already escalated.

## Findings

### L3-design-4-1 [A1] Severity: Major
* Target: DESIGN.md lines 224, 243, 298-301
* Finding: tide is "reserved for global interaction: actions, current selection, links, and focus". Task cards use tide on two non-interactive marks: the "Due today" chip (`components/task-card/due-chip.tsx:73`, `bg-accent-tint text-accent-d`) and the recurrence icon (`components/task-card/task-card-actions.tsx:60-67`, `text-accent`).
* Decision: ESCALATE
* Reason: confirmed in both files. The Tide Restraint Rule is a stated rule and the code strays from it. Listed under possible code defects.
* Edit: none

### L3-design-4-2 [A1] Severity: Nit
* Target: DESIGN.md lines 226, 269
* Finding: the pigment also appears on the subtask fill, the drag-over ring and the empty-pane button border.
* Decision: DECLINE
* Reason: section 5 now names the subtask bar (3-8). The other two are small and sit inside the pane.
* Edit: none

### L3-design-4-3 [A1] Severity: Nit
* Target: DESIGN.md lines 255-258
* Finding: no text element uses `--ink-3`. Call sites are an icon tile and the chart series.
* Decision: DECLINE
* Reason: where `--ink-3` may carry text is escalated (2-17).
* Edit: none

### L3-design-4-4 [A1] Severity: Nit
* Target: code, against DESIGN.md lines 300-301
* Finding: `--shadow-fab` is an unused tide glow (`app/globals.css:228`).
* Decision: DECLINE
* Reason: raised in round 3 (3-14). In the batch summary.
* Edit: none

### L3-design-4-5 [A2] Severity: Nit
* Target: DESIGN.md lines 370-373
* Finding: the usage test also misses other units, `var()` sizes and template literals.
* Decision: DECLINE
* Reason: the sentence names the two common cases. A full list would copy the test's patterns into the document.
* Edit: none

### L3-design-4-6 [A2] Severity: Nit
* Target: DESIGN.md lines 316-317, 359-360
* Finding: the About hero uses `font-serif` off the ramp. The task-card title is `text-small` at weight 600, not the Small step's 430.
* Decision: DECLINE
* Reason: the About page sits outside the product shell. The title's voice and size are as stated.
* Edit: none

### L3-design-4-7 [A2] Severity: Nit
* Target: DESIGN.md lines 380, 408
* Finding: "38px tall" holds for `.btn`, `.input` and `.select` only. "Warm ink" shadows hold in light only.
* Decision: DECLINE
* Reason: the line sits under Buttons, and `.ui-craft/tokens.md` describes the dark shadows.
* Edit: none

### L3-design-4-8 [A2] Severity: Nit
* Target: DESIGN.md lines 340-341, 428-429; code comment
* Finding: "the Review page" is the `/dashboard` route. The comment at `components/task-card/task-card-metadata.tsx:56` is stale.
* Decision: DECLINE
* Reason: the document gives the component path. The stale comment is in the batch summary.
* Edit: none

### L3-design-4-9 [A3] Severity: Major
* Target: .ui-craft/surfaces/saved.md lines 19-20
* Finding: my round 3 sentence said the app shows the reason in an error toast. That holds only for a running timer (`components/matrix-simplified/task-actions.ts:140`). Cards hide the action for completed tasks (`components/task-card/task-card-actions.tsx:105,181`).
* Decision: PROPOSE FIX
* Reason: confirmed. This finding sits at the scope of a round 3 fix. Reverting that fix would reopen 3-13, so I narrowed the sentence instead.
* Edit: the paragraph now says cards hide the action on completed tasks and a running timer gets the error toast.

### L3-design-4-10 [A3] Severity: Nit
* Target: .ui-craft/surfaces/saved.md lines 19-20
* Finding: sync pull also calls `savedPlacementBlocker` (`lib/sync/pb-pull.ts:97`).
* Decision: DECLINE
* Reason: sync behavior is outside a surface brief.
* Edit: none

### L3-design-4-11 [A3] Severity: Nit
* Target: .ui-craft/tokens.md lines 94-95
* Finding: no `--sky-tint` token exists. `--status-blocking-muted` is a 14% `--sky` mix on `--paper` (`app/globals.css:211`).
* Decision: PROPOSE FIX
* Reason: confirmed. The wording was mine.
* Edit: "tint" replaced with the mix.
