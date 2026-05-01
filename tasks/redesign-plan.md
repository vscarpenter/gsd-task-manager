# GSD Visual Redesign — Implementation Plan

**Source:** `GSD_REDESIGN_INSTRUCTIONS.md` (Editorial Minimalism / Calm Tech)
**Scope:** Active v9 single-matrix shell (`components/matrix-simplified/`) + cascading consumers.
**Status:** Approved 2026-05-01. D1–D4 locked. Phase 0 in progress.

## Decisions (locked 2026-05-01)

- **D1 → Option B.** Derive muted dark variants of the new palette. Both `:root` and `.dark` blocks in `globals.css` get updated.
- **D2 → Separate prep PR.** Delete `components/redesign/*` (16 files) and the `.redesign-scope` CSS block (~290 lines in `globals.css`) before the redesign work lands.
- **D3 → Confirmed.** Quadrant hue reassignment is intentional: sage `#7A8B7E` for "Do First", dusty blue `#7B8FA3` for "Schedule", warm taupe `#9D8B7A` for "Delegate", slate gray `#8A8C8E` for "Eliminate". Documented in ADR-0012.
- **D4 → Keep current fonts.** Stay on `Geist` (sans) + `Instrument_Serif` (display) + `Geist_Mono` (mono). Apply spec's weight/size directives (15px task title @ weight 500, etc.) without swapping the font families.

The remaining open questions in §13 still need answers before phase 2:
- Logo treatment in `components/gsd-logo.tsx` (re-derive vs. preserve as brand asset).
- Dashboard chart palette scope (donut only, or all `recharts` series).
- Capture-bar Add button — keep `ArrowRightIcon` or strip per spec.

---

---

## 0. Decisions needed before starting

These are not assumptions I'll make for you. Please pick before phase 1.

### D1 — Dark mode strategy

The spec in `GSD_REDESIGN_INSTRUCTIONS.md` is light-mode only, but the app currently supports a `.dark` theme with its own quadrant tokens. Three options:

- **(a) Leave dark unchanged.** Preserves existing dark-mode work. Light mode gets the calm earth-tone treatment; dark mode keeps the current saturated palette. Cheapest, but creates two visual identities.
- **(b) Derive muted dark variants** of the new palette (e.g., sage `#7A8B7E` → dark-sage tint at low opacity). Most cohesive. Requires a contrast pass per quadrant in dark.
- **(c) Drop dark mode** for this redesign cycle and add it back later. Fastest way to "match the spec" but a regression for current dark-mode users.

**Recommendation:** (b). The "calm" aesthetic should hold in dark too; the new hues desaturate cleanly.

### D2 — Orphaned `components/redesign/` + `.redesign-scope` CSS

A previous redesign attempt left:
- `components/redesign/*.tsx` — 16 files (`redesign-shell`, `matrix-compass`, `view-editorial`, `view-focus`, `view-canvas`, etc.)
- `.redesign-scope` CSS block in `app/globals.css` (lines 432–723, ~290 lines)
- No live import path: `app/(matrix)/page.tsx` renders `MatrixSimplified`, not anything from `components/redesign/`.

**Recommendation:** Delete in a separate prep PR before the redesign work, so the redesign PR diff is clean. Safer than mixing dead-code removal with a visual refactor.

### D3 — Quadrant hue reassignment is semantic, not just cosmetic

Today's mapping (saturated):
- Q1 Do First → orange `#c2410c`
- Q2 Schedule → blue `#1d4ed8`
- Q3 Delegate → green `#15803d`
- Q4 Eliminate → ochre `#854d0e`

Spec's mapping (muted):
- Q1 Do First → sage green `#7A8B7E` ("urgent but calm")
- Q2 Schedule → dusty blue `#7B8FA3` ("planning, future")
- Q3 Delegate → warm taupe `#9D8B7A` ("handoff, collaboration")
- Q4 Eliminate → slate gray `#8A8C8E` ("deprioritize")

Sage for "Do First" is intentionally counter-intuitive — the brief calls for *calm* over *alarm*. Confirm this is what you want; users with muscle memory tied to "orange = urgent" will need a beat to re-anchor. The bright-red overdue treatment becomes terracotta `#A86F5F` (still distinguishable from sage but lower-energy).

### D4 — Typography fonts

Spec asks for `Freight Text/Tiempos/Spectral` (serif) and `Inter/DM Sans` (body). Currently loaded via `next/font/google` in `app/layout.tsx`:
- `Geist` → `--font-sans` (similar grotesque to Inter; arguably more editorial)
- `Geist_Mono` → `--font-mono`
- `Instrument_Serif` → `--font-instrument-serif` (modern editorial serif, similar feel to the named alternatives)

**Recommendation:** Keep the existing fonts; apply the spec's *weight/size* directives (Inter @ 500, 15px task titles, etc.) to Geist + Instrument Serif. Adding new webfonts means more bytes, CSP review, and minimal aesthetic gain. Treat font swap as out of scope unless you specifically want it.

---

## 1. Goal

Re-skin the active v9 matrix shell from a saturated "productivity tool" palette to a muted "focused workspace" aesthetic that:
- Establishes the capture bar as the unmistakable visual anchor
- Unifies the four quadrants into a cohesive cockpit (one container, tighter internal spacing)
- Replaces saturated quadrant colors with desaturated earth tones
- Tightens typography weight and metadata color hierarchy
- Maintains WCAG 2.1 AA contrast for all text

No behavioral changes. No new features. No data layer touches.

## 2. Inputs / Outputs

**Inputs:** Existing `MatrixSimplified` shell, `CaptureBar`, `MatrixGrid`, `QuadrantPane`, `TaskCard`; CSS tokens in `app/globals.css`; Tailwind config (already token-driven, no changes needed).

**Outputs:**
- Updated CSS tokens in `app/globals.css`
- Shared accent helper consumed by all three current `ACCENT_BY_KEY` duplicates
- Reskinned components in `components/matrix-simplified/` and `components/task-card/`
- Updated dashboard color reference (`components/dashboard/quadrant-distribution.tsx`)
- Updated brand logo (`components/gsd-logo.tsx`) using new token palette
- ADR `docs/adr/0012-redesign-color-system.md`

## 3. Constraints

- WCAG 2.1 AA — every (text color, background color) pair I introduce gets a measured contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for ≥18px or bold ≥14px.
- Token-driven — no new hex literals in component files. All four `ACCENT` maps consume CSS tokens via a single helper.
- Backwards-compatible Tailwind classes — `bg-quadrant-focus`/`schedule`/`delegate`/`eliminate` and `bg-accent` continue to work; only their underlying RGB values change.
- Drag-and-drop, keyboard shortcuts, search, edit drawer, dependency graph, sync status — none change behavior.
- Test suite stays green. Coverage doesn't drop.
- Existing dark-mode users don't get a broken experience (tied to D1).

## 4. Edge cases

- **Overdue tasks** — currently bright red `border-red-200/red-50` + `#c2410c` (matrix caption). Replace with terracotta `#A86F5F` family. Verify that overdue is still visually distinct from the new Q1 sage so an overdue Q1 task reads correctly.
- **Drag-active border** (`isOver`) — currently uses raw `accent` hex; needs to use the new sage/blue/taupe/gray tokens.
- **Focus-visible rings** — `--accent` shifts from indigo-700 `#4338ca` to muted indigo `#5B6B8F`. Confirm the dimmer ring still passes the 3:1 non-text-contrast threshold against the new card background.
- **Dashboard donut** (`recharts`) — driven by `--gradient-focus/schedule/delegate/eliminate`. Either rebuild the gradients with new hues or switch the donut to flat fills.
- **Brand logo** (`components/gsd-logo.tsx`) — currently four-color saturated mosaic. Re-derive from new palette or treat the logo as fixed brand asset (recommend keeping it as an exception and noting why in the ADR).
- **Selection / highlight rings** (`ring-accent`, `animate-new-task-glow`) — use new `--accent`. Verify visibility on warm card.
- **Dark mode** — gated on D1.

## 5. Out of scope

- Adding/removing fonts (see D4).
- Restructuring the v9 shell (icon rail, topbar, drawer architecture).
- Behavioral changes to capture parser, drag-drop, or quadrant routing.
- Settings page redesign, sync UI, archive page, dashboard charts beyond color reference.
- The orphaned `components/redesign/*` directory cleanup (handled in separate prep PR per D2).
- Mobile-specific layout work beyond what the new spacing implies.
- Animation/motion changes beyond keeping existing keyframes working with the new color tokens.

## 6. Acceptance criteria

Each maps to a section of the spec. Every criterion has at least one test or verification step (Section 9).

| # | Criterion | Spec ref |
|---|---|---|
| AC1 | Tokens in `globals.css` exist for canvas `#F5F3EF`, card `#FEFDFB`, deep charcoal `#2B2D2E`, warm gray `#6B6865`, sage/dusty-blue/warm-taupe/slate-gray quadrants, muted indigo accent `#5B6B8F`, terracotta `#A86F5F`, capture-bar bg `#EFEEE9`. | §1, §2 |
| AC2 | Capture bar has elevated bg (`--color-capture-bar-bg`), strong border (`--color-border-strong`), `Zap` icon in muted indigo, sticky on desktop+mobile under topbar, larger padding, solid muted-indigo Add button. | §3 |
| AC3 | Matrix grid is wrapped in a single container with rounded-2xl border, padding, subtle backdrop, internal `gap-3` (down from `gap-4`), and a horizontal divider between top and bottom quadrant rows. | §4 |
| AC4 | Each quadrant header uses Title Case (not uppercase), shows the quadrant accent at 5% bg tint extending edge-to-edge, has a `border-b` separating header from body, and a count + plus button to the right. | §5 |
| AC5 | Task cards use 15px medium-weight title in deep charcoal, accent-colored circular checkbox border using the parent quadrant's color, p-4 padding, and quadrant-tinted due-date pills. | §6 |
| AC6 | Headers use Instrument Serif at the spec's sizes; body uses Geist at weight 500. Task metadata is 13px in warm gray. | §7 |
| AC7 | Icons in capture bar / topbar / icon rail use `stroke-[2.5]` for active, `stroke-[2]` for inactive. | §8 |
| AC8 | Spacing: capture-bar→matrix gap is 48px; matrix internal gap is 12px; quadrant internal padding is 24px. | §9 |
| AC9 | All hardcoded `#c2410c` / `#1d4ed8` / `#15803d` / `#854d0e` literals in `components/matrix-simplified/`, `components/dashboard/quadrant-distribution.tsx`, and (per D3) `components/gsd-logo.tsx` are removed. Single accent helper drives all consumers. | hidden coupling |
| AC10 | WCAG AA: every introduced color pair passes per Section 9 contrast table. | global |
| AC11 | All existing tests pass. `bun typecheck` clean. `bun lint` clean. | global |

## 7. Test stubs

Behavioral changes are minimal, so the new tests are mostly snapshot-style assertions on rendered class names + a small unit test for the new accent helper. Coverage requirement only applies to *new* logic (the helper); pure CSS changes don't need new tests but must not break existing ones.

```ts
// tests/data/quadrant-accent.test.ts
describe('quadrantAccent', () => {
  it('returns the sage CSS variable for q1', () => { /* ... */ });
  it('returns the dusty-blue variable for q2', () => { /* ... */ });
  it('returns the warm-taupe variable for q3', () => { /* ... */ });
  it('returns the slate-gray variable for q4', () => { /* ... */ });
});

// tests/ui/capture-bar-redesign.test.tsx
describe('CaptureBar (redesigned)', () => {
  it('renders a Zap icon when input is empty', () => { /* ... */ });
  it('uses sticky positioning class', () => { /* ... */ });
  it('shows the Add button with primary accent background', () => { /* ... */ });
});

// tests/ui/quadrant-pane-redesign.test.tsx
describe('QuadrantPane (redesigned)', () => {
  it('renders title in Title Case, not uppercase', () => { /* ... */ });
  it('applies quadrant accent tint to header bg', () => { /* ... */ });
  it('applies the unified container border classes when wrapped by MatrixGrid', () => { /* ... */ });
});

// tests/ui/task-card-redesign.test.tsx
describe('TaskCard (redesigned)', () => {
  it('checkbox border uses the quadrant accent CSS variable', () => { /* ... */ });
  it('overdue task uses terracotta border, not bright red', () => { /* ... */ });
  it('due-date pill uses 15% accent tint background', () => { /* ... */ });
});
```

## 8. Files touched (cascade map)

**Tokens:**
- `app/globals.css` — replace `--accent`, `--quadrant-*`, `--q1..q4-wash`, `--gradient-*`, `--shadow-fab`. Add `--color-capture-bar-bg`, `--color-border-strong`, `--color-terracotta`. Update both `:root` and `.dark` (per D1).
- `tailwind.config.ts` — add `border-strong` color reference; verify the existing safelist still covers new opacity classes.

**Components (active shell):**
- `components/matrix-simplified/capture-bar.tsx` — sticky, lifted bg, Zap icon, solid Add button, larger padding, replace `ACCENT_BY_KEY` with shared helper.
- `components/matrix-simplified/matrix-grid.tsx` — wrap in unified container, change `gap-4` → `gap-3`, insert horizontal divider.
- `components/matrix-simplified/quadrant-pane.tsx` — Title Case header, edge-to-edge tinted header strip, `border-b`, accent count badge, replace `ACCENT` with helper.
- `components/matrix-simplified/index.tsx` — replace `style={{ color: "#c2410c" }}` for overdue caption with terracotta token; tweak capture-bar wrapper sticky offset.
- `components/matrix-simplified/edit-drawer.tsx` — replace `ACCENT` map with helper.
- `components/matrix-simplified/topbar.tsx`, `icon-rail.tsx` — bump icon stroke widths to 2 / 2.5.

**Task card:**
- `components/task-card/task-card-header.tsx` — pass quadrant accent to checkbox border.
- `components/task-card/task-card-metadata.tsx` — due-date pill recolor.
- `components/task-card/index.tsx` — replace `border-red-*` overdue with terracotta token.

**Cascade:**
- `lib/quadrants.ts` — the legacy `accentClass`/`colorClass`/`iconColor` strings (lines 35–104) need a sweep. Confirm whether they're still consumed; if yes, retoken; if no, delete (separate prep PR).
- `components/dashboard/quadrant-distribution.tsx` — replace bright `#ef4444`/`#3b82f6`/`#f59e0b`/`#6b7280` literals with the new quadrant tokens.
- `components/gsd-logo.tsx` — re-derive from new palette **or** explicitly preserve as brand asset (call out in ADR).
- `lib/analytics/*` and `components/dashboard/*` — grep for `--gradient-focus|schedule|delegate|eliminate` and `quadrant-` class consumers; verify donut / charts still render coherently after token swap.

**New helper:**
- `lib/quadrant-accent.ts` — single source of truth for `q1|q2|q3|q4` → CSS variable name. All three current `ACCENT` duplicates and the `gsd-logo.tsx` reference consume this.

**ADR:**
- `docs/adr/0012-redesign-color-system.md` — document the reassignment, why sage is intentional for Q1, the WCAG contrast measurements, and what's deferred.

## 9. Implementation phases

Each phase ends with a green test suite + manual verification before moving on. Commit per phase.

### Phase 0 — Discovery sweep (1 hour, blocking phase 1)
- Run `rg '#[0-9a-fA-F]{6}\b' app components lib` and inventory every literal.
- Run `rg 'q[1-4]-wash|quadrant-(focus|schedule|delegate|eliminate)|gradient-(focus|schedule|delegate|eliminate)' app components lib` to confirm cascade map.
- Confirm whether `lib/quadrants.ts` `accentClass`/`colorClass`/`iconColor` are still consumed (`rg accentClass\|colorClass\|iconColor` and inspect call sites).
- Output: complete file list. If anything new surfaces, update §8 before phase 1.

### Phase 1 — Tokens + accent helper (canary phase)
- Update `app/globals.css` tokens (light root; dark gated on D1).
- Create `lib/quadrant-accent.ts` and add unit tests.
- Refactor the three `ACCENT` duplicates to consume the helper. No visual changes yet — same hex values served via tokens.
- **Verify:** `bun run test`, `bun typecheck`, dev server smoke. Site looks identical (helper refactor only).
- Commit: `refactor(redesign): centralize quadrant accent helper, no visual change`

### Phase 2 — Color identity swap
- Flip token values in `globals.css` to the new sage/dusty-blue/taupe/slate palette.
- Update `--accent` to muted indigo, `--shadow-fab` to match.
- Update `--gradient-*` (or remove gradients entirely if the donut becomes flat).
- Update `components/dashboard/quadrant-distribution.tsx` literals.
- Update `gsd-logo.tsx` per D3 decision.
- Replace `#c2410c` literal in `matrix-simplified/index.tsx:215` with terracotta token.
- **Verify:** dev server screenshot in light + dark; axe-core run on `/`, `/dashboard`, `/archive`; manual contrast pass on every text/bg pair using DevTools color picker.
- Commit: `feat(redesign): apply muted earth-tone quadrant palette`

### Phase 3 — Capture bar
- Sticky on desktop (currently mobile-only via `top-[60px]`); raise z-index above quadrant headers.
- Add `Zap` icon from `lucide-react`.
- Replace card bg with `bg-[var(--color-capture-bar-bg)]`, stronger border, `px-5 py-4`.
- Solid muted-indigo Add button (was outline-style).
- Increase capture→matrix gap to 48px.
- **Verify:** `n` keyboard shortcut still focuses the input; `Enter`/`Tab`/`Escape` still behave; sticky doesn't overlap topbar.
- Commit: `feat(redesign): elevate capture bar as primary entry point`

### Phase 4 — Matrix container
- Wrap `MatrixGrid` children in a unified container with rounded-2xl border, p-6, subtle bg.
- Change inner `gap-4` → `gap-3`.
- Insert horizontal divider between top and bottom quadrant rows on `md:` breakpoint.
- **Verify:** drop targets still register correctly across grid cells.
- Commit: `feat(redesign): unify matrix grid as a single cockpit`

### Phase 5 — Quadrant header + body
- Title Case label (drop `uppercase` class on quadrant-pane.tsx:61).
- Accent header strip with edge-to-edge tint (`-mx-* -mt-* px-* pt-*`), `border-b`.
- Count badge with quadrant accent at higher contrast; plus button uses accent on hover.
- **Verify:** visual diff vs. current; dnd-kit droppable area unchanged.
- Commit: `feat(redesign): tint quadrant headers and switch to title case`

### Phase 6 — Task card
- Checkbox uses parent quadrant accent (passed via prop or context).
- Title 15px / weight 500 / deep charcoal.
- Due-date pill uses quadrant accent at 15% opacity (or terracotta for overdue).
- Replace `border-red-200/50` overdue treatment with terracotta tokens.
- **Verify:** card render tests; overdue still distinguishable.
- Commit: `feat(redesign): align task card typography and accent colors`

### Phase 7 — Icons + final polish
- Bump icon stroke weights per spec (active 2.5, default 2).
- Final spacing pass: 48px capture→matrix, 12px matrix internal, 24px quadrant internal.
- Final WCAG sweep with axe-core on every route.
- **Verify:** full test suite, lint, typecheck, all routes manually.
- Commit: `feat(redesign): tighten icon weights and finalize spacing`

### Phase 8 — Documentation
- Write `docs/adr/0012-redesign-color-system.md`.
- Update `tasks/lessons.md` with anything surprising encountered.
- Update root `README.md` if it describes the visual identity.
- Commit: `docs(adr): record color identity reassignment for v9 redesign`

## 10. Verification methodology (defined up front, not at the end)

- **Automated:** `bun run test`, `bun typecheck`, `bun lint` after every phase.
- **Contrast:** axe-core (`@axe-core/react` or browser DevTools accessibility audit) on `/`, `/dashboard`, `/archive`, `/settings`. Spot-check `/about`. Every (text color, bg color) pair I introduce gets a manual contrast measurement; results recorded in the ADR.
- **Visual:** Dev server, light + dark (per D1), 1440px desktop and 390px mobile viewport. Take before/after screenshots and attach them to the PR description.
- **Behavioral:** Manual smoke — capture a task, drag between quadrants, edit, complete, delete, search, OAuth sync. None should change.

## 11. Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Sage `#7A8B7E` on card `#FEFDFB` is ~3.4:1 — fails AA normal. The spec uses it for header *labels* at 11px, which is below "AA Large." | Use deep charcoal `#2B2D2E` for any text smaller than 18px / 14px-bold. Reserve the quadrant hue for icons, dot indicators, header *background tint at 5%*, and pill *backgrounds at 15%*. Verify each pair in phase 7. |
| R2 | Changing semantic color of "Do First" from orange to sage may confuse returning users. | Document in release notes; ADR explains the choice. If it lands poorly, the rollback is a one-token swap. |
| R3 | Dashboard donut and charts depend on `--gradient-*`. | Phase 0 cascade map flags each consumer; phase 2 explicitly handles `quadrant-distribution.tsx`. |
| R4 | Sticky capture bar on desktop may collide with topbar offset. | Use `top-[var(--topbar-height,60px)]` or compute from `SimplifiedTopbar` actual height; verify in dev server. |
| R5 | Three duplicated `ACCENT` maps signal that the next dev will add a fourth. | Phase 1 introduces the helper *before* the visual changes — no chance to drift further. |
| R6 | Orphaned redesign code adds noise to greps and to the next maintainer's mental model. | Separate prep PR (per D2) deletes them, so the redesign PR stays focused. |
| R7 | Spec-asked fonts not loaded; spec-described typography may render slightly different. | D4 keeps Geist + Instrument Serif. Document the deviation in the ADR. |

## 12. PR strategy

Three PRs, in order:
1. **Prep:** Delete `components/redesign/*` and the `.redesign-scope` CSS block (per D2). Independent; ships before the redesign work.
2. **Refactor (phase 0–1):** Discovery + accent helper + ACCENT map deduplication. No visual change.
3. **Redesign (phases 2–8):** Visual swap + ADR. Includes before/after screenshots.

Each PR ≤ 400 lines per coding standards Part 5. Phase 2–8 may exceed that; split into PR 3a (tokens + cascade) and PR 3b (component reskin) if needed.

## 13. Open questions for the user

1. **D1, D2, D3, D4** above — pick one each.
2. Logo treatment in `components/gsd-logo.tsx` — re-derive from new palette, or treat as fixed brand asset?
3. Is the dashboard chart palette in scope, or just the donut color reference? (`recharts` series colors live in `--chart-series-2`.)
4. Should the capture-bar Add button keep the trailing `ArrowRightIcon` or follow the spec's icon-free "Add" treatment exactly?

---

**Estimated effort:** Phase 0 (1h) + Phase 1 (2h) + Phase 2 (3h) + Phase 3 (1.5h) + Phase 4 (1h) + Phase 5 (1.5h) + Phase 6 (2h) + Phase 7 (1.5h) + Phase 8 (1h) ≈ **14 hours**, 2–3 working sessions.

**Blockers:** D1 + D2 + D3 + D4 must be answered before phase 1.

---

## 14. Phase 0 Discovery Output (2026-05-01)

### Complete cascade map (in scope for redesign)

**A. Hardcoded quadrant hex literals — all consume the saturated palette `#c2410c / #1d4ed8 / #15803d / #854d0e`:**
- `components/matrix-simplified/quadrant-pane.tsx:18-23` (ACCENT map)
- `components/matrix-simplified/capture-bar.tsx:26-31` (ACCENT_BY_KEY map)
- `components/matrix-simplified/edit-drawer.tsx:28-33,93` (ACCENT map + fallback)
- `components/matrix-simplified/index.tsx:215` (overdue caption color)
- `components/gsd-logo.tsx:17-20` (logo squares — gated on logo treatment Q in §13)

**B. Hardcoded chart palette (different bright literals — even further from the muted target):**
- `components/dashboard/quadrant-distribution.tsx:12-15` — `#ef4444 / #3b82f6 / #f59e0b / #6b7280` (donut fills)

**C. Tailwind `red/blue/amber/gray` quadrant colors:**
- `components/dashboard/time-analytics.tsx:15-18` — `bg-red-500 / bg-blue-500 / bg-amber-500 / bg-gray-400` (chart bars)
- `components/command-palette/task-item.tsx:15-18` — `bg-red-100 / bg-blue-100 / bg-amber-100 / bg-gray-100` chips
- `components/about/matrix-section.tsx:7-22` — `border-red-500/40 bg-red-500/5` etc. (about-page Q1–Q4 illustration)

**D. `lib/quadrants.ts` legacy color fields — DEAD CODE (zero consumers):**
- `accentClass`, `colorClass`, `iconColor`, `bgClass` on each quadrant entry (lines 35–104, ~12 hex literals)
- Action: delete the fields entirely. Fold into prep PR.

**E. `--accent` token (~33 consumers across settings, about, dashboard, task-card, command-palette, sync, matrix-simplified):**
- Token shifts from `#4338ca` (indigo-700) → `#5B6B8F` (muted indigo). Cascade is automatic; verify contrast at every site.
- Notable: `bg-accent text-white` on about/hero; `text-accent` on warm card surfaces; `ring-accent` on selection / focus rings.

**F. Overdue-task styling (recolor red → terracotta `#A86F5F`):**
- `app/globals.css:726-732` (`.overdue-task` border-left)
- `components/task-card/index.tsx:65` (`overdue-task border-l-4 border-red-200 bg-red-50/40 dark:border-red-800/60 dark:bg-red-950/20`)
- `components/task-card/task-card-actions.tsx:35,131` (overdue chip + delete hover)
- `components/matrix-simplified/index.tsx:215` (caption "X overdue")
- `app/(dashboard)/dashboard/page.tsx:184-185` (overdue alert banner)
- `components/dashboard/upcoming-deadlines.tsx:57,111` (overdue indicator + section bg)

### Orphans confirmed (delete in prep PR alongside `components/redesign/`)

- `.redesign-scope` CSS block in `app/globals.css` lines 432–723
- `.matrix-card` legacy v8 class block in `app/globals.css` lines 158–210 (zero consumers)
- `--shadow-fab` token (zero consumers)
- `--gradient-focus|schedule|delegate|eliminate` tokens (only consumed by the orphan `.matrix-card` block)

### Out of scope (intentionally retain red/amber/etc.)

These red references are NOT quadrant identity — they're destructive/danger/warning semantics. Leave alone:
- `components/reset-everything-dialog.tsx`, `components/import-dialog.tsx` (Replace All)
- `components/ui/button.tsx` `destructive` variant
- `components/sync/sync-button.tsx`, `components/sync/sync-auth-dialog-sections.tsx` (error states)
- `components/settings/data-management.tsx` "Danger zone" rows
- `components/settings/notification-settings.tsx` "denied" badge
- `app/(sync)/sync-history/page.tsx` failure rows
- `components/dashboard/stats-card.tsx` generic `red`/`amber`/`emerald` color scheme (used for stats card variants, not Q1)
- `components/dashboard/time-analytics.tsx:177` over-budget `text-red-600` (warning, not Q1)

### Topbar offset for sticky capture bar

`SimplifiedTopbar` is `sticky top-0 z-20` with `py-3`. Rendered height ≈ 67px (h1 line + caption + padding + 1px border). Current capture-bar wrapper at `top-[60px] z-10` is slightly under-set; phase 3 should align to the actual header height (use a CSS custom property or measure-once).

### Updated estimate after discovery

Adding consumer-cascade work in phase 2 (B, C, F above) lifts that phase from 3h → 4.5h. Total redesign work now ≈ **15.5 hours**. Prep PR (orphan deletion + lib/quadrants.ts dead-field cleanup) ≈ 1h on its own.
