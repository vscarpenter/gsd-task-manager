---
target: components/matrix-simplified
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-01T02-41-23Z
slug: components-matrix-simplified
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strong: active/done/overdue count pills, sync status, drag-over ring, live capture preview. Gap: failure toasts are generic ("Failed to create task"). |
| 2 | Match System / Real World | 4 | Eisenhower vocabulary (Do First / Schedule / Delegate / Eliminate), plain-language empty states, "Saved locally" reassurance. |
| 3 | User Control and Freedom | 2 | Esc/cancel on drawers, drag is undoable, but task delete has no undo and no recovery. |
| 4 | Consistency and Standards | 2 | Shell is consistent; the card/sync/edit-drawer layers diverge (off-palette colors, two different dialog implementations). |
| 5 | Error Prevention | 1 | Permanent delete with no confirm, no undo, no archive fallback. Textbook failure. |
| 6 | Recognition Rather Than Recall | 3 | Live capture quadrant preview + thorough help drawer. Gap: capture syntax (`!`/`!!`/`*`/`#`) is recall-only, surfaced only in help. |
| 7 | Flexibility and Efficiency | 4 | n, /, ?, Shift+N, Tab-to-cycle, ⌘K palette, drag-to-reclassify, per-quadrant add, due-date presets. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, uncluttered shell. Dinged by dense card action cluster and triple-signaled overdue state. |
| 9 | Error Recovery | 2 | Toasts name the problem but not the fix; sync errors explained only in the help drawer, not at the failure point. |
| 10 | Help and Documentation | 4 | Thorough, well-structured help drawer (matrix / syntax / shortcuts / sync / privacy). |
| **Total** | | **28/40** | **Good (bottom of band) — propped up by excellent Match/Flexibility/Help; harbors a P1 data-loss bug the aggregate score structurally under-weights.** |

## Anti-Patterns Verdict

**Does this look AI-generated? Mixed — and the seam is visible.** The matrix *shell* is genuinely on-brand and intentional; the *card and sync layers* betray it.

**LLM assessment:** The shell (capture bar, quadrant grid, empty states, topbar) is disciplined: correct type pairing, the 1.5px hairline border architecture, quadrant washes, no gradient text, no hero-metric template, no purple gradients, no mascots. But below the shell the Inkwell system dissolves into raw Tailwind defaults — the "inconsistent component vocabulary screen-to-screen" tell:
- **Off-palette colors:** completion button = `emerald` (task-card-header.tsx:76), not the system's sage — and completion is *the one sanctioned delight moment*. Delete = `red-500` (task-card-actions.tsx:145), due-today = `amber-50/600` (L44), sync status = `orange/blue/green-500` (sync-status-display.tsx) — all bypass the AA-tuned `status-*` tokens.
- **Banned >1px side-stripe:** `border-l-[3px] border-l-status-overdue` on overdue cards (task-card/index.tsx:71) — the exact pattern DESIGN.md §6 names "migrate away from." It also ships a redundant "ND Overdue" corner label, so the stripe carries no unique meaning.
- **Stacked glassmorphism:** both topbar (topbar.tsx:34) and the sticky capture-bar wrapper (index.tsx:491) apply `backdrop-blur-xl backdrop-saturate-150` — two translucent blur layers, an explicit DESIGN.md ban.

**Deterministic scan:** `detect.mjs` over `components/matrix-simplified` + `components/task-card` returned **0 findings (exit 0, clean)**. This is a weak signal here: the detector matches rendered-markup/CSS patterns, not Tailwind utility strings inside JSX, so it cannot see the `border-l-[3px]` stripe or the stacked blur. Treat the clean scan as "no HTML/CSS-level slop," not a green light — the substantive issues are the design-review findings above.

**Visual overlays:** No live browser pass was run. The target renders task cards from IndexedDB, so a faithful pass needs a running dev server with seeded data (none was running); an empty grid would critique the empty state, not the real UX. Reported as a fallback, not skipped silently — a live pass is offered as a follow-up.

## Overall Impression

A calm, intentional matrix shell whose strongest element — the capture bar — is genuinely excellent, undermined by three P1 issues that all converge on one theme: **the v9 refactor quietly dropped guarantees the design system still advertises** (touch targets, focus visibility, data safety). The single biggest opportunity: make destructive delete recoverable. It's a small diff (the undo infrastructure already exists in the repo) that closes the worst emotional valley and fixes two heuristics at once.

## What's Working

1. **The capture bar is the best-designed element in the app** (capture-bar.tsx). It compresses a 4-way priority decision into one live-previewing pill: the Zap icon and pill tint shift to the predicted quadrant as you type, Tab cycles an explicit override (with a `·fixed` marker), Enter commits, Esc clears. It sidesteps the >4-option trap entirely and embodies "the matrix is the argument" — you *see* where a task lands before committing.
2. **Empty states respect the user's emotional state** (quadrant-pane.tsx:115-135). Each quadrant gets a tailored serif headline, a supporting line capped at 26ch, and an accent-colored dashed CTA scoped to that quadrant. Four empty boxes become four invitations, in the calm editorial voice the brand asks for.
3. **The matrix grid's border architecture is elegant** (quadrant-pane.tsx:32-37). `POSITION_RULES` lets the outer container own the perimeter while each pane contributes only internal dividing rules on md+, collapsing to individually-bordered stacked cards on mobile. The 1.5px-hairline "structure is drawn, not boxed" signature, clean across breakpoints, no doubled borders.

## Priority Issues

**[P1] Permanent, unguarded task deletion with no undo or recovery**
- **Why it matters:** `handleDelete` → `deleteTask` → `db.tasks.delete(id)` is a hard IndexedDB removal (index.tsx:340-349) with no confirm, no undo toast, no archive fallback — on both desktop (task-card-actions.tsx:144) and the mobile overflow menu (L201). In a privacy-first, local-only app there is no server backup, so one mis-tap on a 12px trash glyph = irreversible loss. Directly breaks PRODUCT.md's "feels in control" and "owns their data." The reversible action (complete) is protected by auto-archive; the irreversible one is not.
- **Fix:** Route delete through the existing `useErrorHandlerWithUndo` pattern (optimistic delete + "Task deleted — Undo" toast at `TOAST_DURATION.LONG`), or send single deletes to the `archivedTasks` table so they're recoverable from the archive page. The undo route reuses code already in the repo.
- **Suggested command:** `/impeccable harden`

**[P1] Hover-only card actions are invisible to keyboard users (desktop)**
- **Why it matters:** `DesktopActions` (task-card-actions.tsx:91) and the drag handle (task-card-header.tsx:45) are `opacity-0 group-hover:opacity-100` with no `group-focus-within` reveal. The buttons stay in the tab order but are visually invisible without a hovering mouse — so a sighted keyboard user tabs into Share / Duplicate / Edit / **Delete** they cannot see, and the first invisible one is the irreversible delete. WCAG 2.4.7 (Focus Visible) failure on the highest-stakes control. Related: the edit-drawer is a hand-rolled overlay with no focus trap, no `role="dialog"`/`aria-modal`, and no focus restoration (edit-drawer.tsx), unlike the Radix-based help-drawer.
- **Fix:** Add `group-focus-within:opacity-100` to the desktop-actions wrapper and drag handle; give the edit-drawer a focus trap + `role="dialog"` + focus restoration (or rebuild it on the Radix Dialog the help-drawer already uses).
- **Suggested command:** `/impeccable harden`

**[P1] Most-used touch targets fall below the 44px floor the design system promises**
- **Why it matters:** The complete button is `h-8 w-8` (32px, task-card-header.tsx:74) and the quadrant-add is `h-7 w-7` (28px, quadrant-pane.tsx:107) — both below WCAG 2.5.5 on touch, and complete is the single most-tapped control. The 44px coarse-pointer enforcement (globals.css:877) is scoped to legacy `.redesign-scope .rd-*` classes the v9 shell abandoned, so it never reaches these controls — even though PRODUCT.md and DESIGN.md both assert ≥44px "by construction." (The mobile overflow menu correctly hits 44px at L172/182 — follow that precedent.)
- **Fix:** Add a `pointer: coarse` rule for the v9 card/control selectors, or bump complete + quadrant-add to `min-h-[44px] min-w-[44px]` on touch.
- **Suggested command:** `/impeccable adapt`

**[P2] Card and sync color vocabulary diverges from the Inkwell system**
- **Why it matters:** emerald (completion + subtask progress), amber-50/600 (due-today), red-500 (delete), orange/blue/green-500 (sync) are raw Tailwind, bypassing the sage / amber-ink / rust / slate-blue tokens and their annotated AA contrast. Reads as a different author than the shell and risks AA on grounds the tokens were tuned for. Workaround exists (it's still legible), hence P2.
- **Fix:** Replace generic Tailwind palette refs with the `status-*` / quadrant tokens already in globals.css. Highest priority: the completion button → sage, since completion is the brand's signature moment.
- **Suggested command:** `/impeccable colorize`

**[P3] Overdue state is over-signaled (and uses a banned pattern)**
- **Why it matters:** Overdue cards get a 3px left stripe (the DESIGN.md-banned side-border) *plus* a corner "ND Overdue" label *plus* a color-shifted due chip — three signals for one state, visual noise on a surface meant to be calm.
- **Fix:** Drop the `border-l-[3px]` stripe; keep the corner label (which also satisfies color-independence) and optionally a full-hairline rust border or background tint.
- **Suggested command:** `/impeccable distill`

## Persona Red Flags

**Alex (power user):** Well-served — n / Shift+N / Tab / Enter / `/` / `?` / ⌘K all work, drag-to-reclassify with 8px activation. Red flags: (1) capture syntax (`!`/`!!`/`*`/`#`) must be memorized, no inline reference; (2) no bulk-select / multi-task ops in the v9 shell (the card has `selectionMode` props but nothing drives them here), so triaging 50 tasks means 50 individual risky deletes. (Note: ⌘K *is* wired in — this contradicts the stale CLAUDE.md claim that the command palette is "not wired into the v9 shell.")

**Sam (accessibility / keyboard / screen reader):** The worst-served persona. (1) Tabs into invisible hover-only Share/Edit/Delete (P1). (2) The edit-drawer isn't announced as a modal, has no focus trap (Tab escapes to the page behind the scrim), and doesn't restore focus on close — while the help-drawer (Radix) does all three, an inconsistency a screen-reader user feels. (3) Sync status leans on color-alone (green/blue/orange) for "synced / pending / retry." (The quadrants themselves are fine — always label + position.)

**Casey (distracted, one-handed mobile):** (1) The 32px complete button — most-tapped control — is hardest to hit (P1). (2) The primary capture action sits at the *top* of the screen (`sticky top-[60px]`, index.tsx:491), the hardest one-handed thumb reach; bottom nav is reachable but core capture isn't. (3) Edit-drawer Cancel/Save are small text buttons (`py-1.5`) below 44px at the bottom of a scrolling form — easy to fat-finger.

**Morgan (the local-only minimalist — project-specific persona):** Chose GSD *because* data never leaves the device and there's no account. Red flags: the unguarded permanent delete is uniquely devastating for Morgan — there is no server backup and no undo, so a mis-tap is gone forever, the exact opposite of the "you own your data" promise that won them over. The app carefully reassures about *privacy* ("Saved locally" pill) but offers zero reassurance against *self-inflicted loss*. JSON export is the only safety net, and it's manual.

## Minor Observations

- Capture-bar disabled "Add" uses `bg-accent/15 text-accent` (capture-bar.tsx:204) — faint indigo-on-indigo-tint that doesn't read as clearly disabled. (The Enter path *is* guarded by `if (!parsed.title) return`, so it won't submit empty — the issue is purely the visual affordance.)
- Edit-drawer Save is `bg-foreground` (ink-slate near-black, edit-drawer.tsx:354), not the deep-indigo system primary — reads as neutral, conflicting with the One Accent Rule.
- Help-drawer is built with inline `style={}` + `var(--ink-*)` (`redesign-scope`) rather than the Tailwind/token vocabulary the rest of the shell uses — another authorship seam.
- Tag chips drop the `#` for a leading dot on cards (task-card-metadata.tsx:41) but keep a faded `#` in the edit-drawer (L308) — same concept, two representations.
- `quadrant-pane.tsx` rows share height on `md:grid-rows-2`; a lopsided distribution (many tasks in one quadrant, few in others) can leave large dead space.

## Questions to Consider

1. Completing a task auto-archives it recoverably, but deleting one destroys it permanently with no guard. Why is the *reversible* action protected and the *irreversible* one not? Where's the evidence users read the trash icon as "I'm certain" before losing data?
2. The one sanctioned delight moment — completion — renders in emerald, not the system's sage. Was that moment ever actually checked against the design system, or did it inherit a Tailwind default?
3. The 44px touch guarantee is real in CSS but scoped to a legacy class the v9 shell dropped. Did the refactor knowingly drop touch-target enforcement, or did it fall through the cracks when the class system changed?
4. If a "focused personal tool" omits bulk ops and undo from the matrix, is manual JSON re-import really an acceptable floor for "owns their data" after a triage session gone wrong?
5. Two stacked backdrop-blur layers is glassmorphism the system bans. Is the sticky-translucent treatment earning its keep, or would a solid `bg-background` + hairline bottom border be both more on-brand and cheaper to composite on a low-end phone?
