# GSD Design Reference — Web App Compliance Review

**Date:** 2026-06-14
**Reviewed against:** `GSD-Design-Reference.html` (v1, post-polish)
**Scope:** the Next.js PWA (`app/`, `components/`, `lib/`, `public/`)
**Method:** token + component + surface audit, file:line evidence throughout

---

## TL;DR

**This is a gap-closing audit, not a redesign.** The web app has already migrated its
foundational systems to the reference's "GSD Editorial" language, and the core tokens are an
**exact hex match**:

| System | Reference | Shipped | Match |
|---|---|---|---|
| Q1 Do First | `#B23A2E` rust | `--q1: #B23A2E` (`app/globals.css:118`) | ✅ |
| Q2 Schedule | `#2C6680` tide | `--q2: #2C6680` (`:119`) | ✅ |
| Q3 Delegate | `#8A6A22` ochre | `--q3: #8A6A22` (`:120`) | ✅ |
| Q4 Eliminate | `#6F685F` slate | `--q4: #6F685F` (`:121`) | ✅ |
| Washes + dark lifts | `#F4E4E0 …`, `#E0705F …` | identical (`:122-178`) | ✅ |
| Warm paper / ink | `#F4F1E9` / `#211E1A` | `--ivory` / `--slate` (`inkwell-tokens.css:26-28`) | ✅ |
| Tide accent (actions only) | `#2C6680` | `--accent: #2C6680` (`inkwell-tokens.css:32`) | ✅ |
| New York serif | Newsreader stand-in | loaded in `app/layout.tsx:54-60`, chained in `--serif` | ✅ |

There are **zero `indigo` references** left in the codebase. The "Indigo & Cloud" palette is retired.

**What remains splits into four buckets with very different cost/value:**

1. **Migration drift in brand assets** — a handful of always-visible surfaces (app icon, brand glyph,
   About-page matrix, manifest/OG) still carry the *old* green/amber/indigo palette. Highest
   visibility, lowest effort. **Fix first.**
2. **Component-anatomy fidelity** — the task card never learns its quadrant, so the spine, completion
   disc, chips, and subtask fill all miss the four-pigment language. One root fix unlocks several.
3. **Platform-translation gaps** — the reference is iOS/SwiftUI. Swipe actions, detented sheets,
   haptics, and the iPad split-view have no 1:1 web form. Some are reasonable substitutions already;
   a few are worth building.
4. **Documentation drift** — `DESIGN.md`, `PRODUCT.md`, and a `CLAUDE.md` note still describe the
   dead system. This actively misleads future work (it misled this review's own tooling).

> **Framing decision the team should make:** is the goal *strict* reference compliance, or
> *spirit* compliance adapted to web? Several items below (detented bottom sheets, swipe gestures,
> 17px iOS type scale) are deliberate, defensible web divergences. They're flagged as `[divergence]`
> so you can accept rather than "fix" them.

---

## Severity legend

- **P1 — Major:** visible violation of the reference's core rules ("color earns its place,"
  "the matrix is the argument"), or wrong brand identity. Fix before claiming compliance.
- **P2 — Minor:** fidelity gap; the surface works but reads off-spec.
- **P3 — Polish / optional / platform-inherent:** cleanup, debatable, or iOS-only with an
  acceptable web substitution already in place.

---

## Bucket 1 — Migration drift in brand assets (P1, highest visibility / lowest effort)

These are the surfaces that escaped the Indigo→Editorial recolor. They are the most visible
non-compliance because they're the brand identity and always on screen.

| # | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| 1.1 | **P1** | `public/icons/icon.svg`, `icon-192.png`, `icon-512.png` | App/PWA icon is the **old palette**: green/yellow/blue/gray tiles on a **dark navy** ground, a **gradient** stroke (banned), a diamond overlay, and **no check mark**. | Redraw as the reference app mark: 2×2 of `#B23A2E / #2C6680 / #8A6A22 / #6F685F` on warm paper `#F4F1E9`, single check on the rust (Do First) tile, no gloss/gradient. The reference ships exact SVG (HTML §10). |
| 1.2 | **P1** | `components/gsd-logo.tsx:19-20` | Topbar brand glyph: Q3 tile = `var(--olive)` (green), Q4 tile = `var(--warning)` (amber). | Use `var(--q3)` ochre and `var(--q4)` slate; add the check on the rust tile to match the app mark. |
| 1.3 | **P1** | `components/about/matrix-section.tsx:20,26` | About-page matrix: Q3 "Delegate" = `bg-olive-tint` (green), Q4 "Eliminate" = `bg-warning-tint` (amber). Public marketing surface. | Switch to the q3/q4 pigment washes (`--q3-wash` / `--q4-wash`). Q1/Q2 (lines 8,14) are already correct. |
| 1.4 | **P2** | `public/manifest.json:8` | PWA `theme_color: "#6366f1"` (old indigo); `background_color: "#ffffff"`. | `theme_color` → `#2C6680` (tide) or `#F4F1E9` (ivory); `background_color` → `#F4F1E9`. |
| 1.5 | **P2** | `public/og-image.svg:47-75+` | Social/OG image uses old indigo `#6366f1`. | Recolor to tide accent + four pigments. |
| 1.6 | **P3** | `app/globals.css:672-673` | `--q3-soft/--q3-tint` defined off `--olive` (green), `--q4-soft/--q4-tint` off `--warning` (amber). **Zero consumers** — scoped to `.redesign-scope`, never read. | Correct to `--q3`/`--q4` *or* delete. Latent trap if revived. |
| 1.7 | **P3** | `public/css/inkwell-tokens.css` (+ `inkwell-components.css`, `inkwell.css`, `tokens.css`) | Orphaned full copy of the **old** Indigo & Cloud palette (`--accent: #3B4A8C`, sage, cool-stone). **Not imported** anywhere (app imports `app/css/…`). | Delete the dead `public/css/*` duplicates. |

---

## Bucket 2 — Component-anatomy fidelity (P1/P2)

### 2A. The root cause: the task card is quadrant-agnostic

`components/task-card/index.tsx:54-77` renders a flat `bg-card` article that **never receives a
quadrant prop** (props at `:13-29` have no quadrant/accent). Quadrant color lives on the *pane*
(top bar + wash), not the card. This single gap cascades into findings 2.1–2.4 below.

> **Highest-leverage fix in the whole review:** thread the quadrant key into `TaskCard`. Four
> separate findings resolve once the card knows its pigment.

Note: a `.matrix-card` class with an accent bar exists in `app/globals.css:306-358` but is **dead
code** (used by zero components) and uses a *top* bar, not the reference's *left* spine — not a usable basis.

| # | Sev | Location | Finding (reference §06) | Fix |
|---|---|---|---|---|
| 2.1 | **P1** | `task-card/index.tsx:67-76` | No **3pt left accent spine** colored by quadrant pigment. | Add a 3px left border/`::before` = `var(--qN)` once quadrant is threaded in. |
| 2.2 | **P1** | `task-card-header.tsx:86-95` | Completion disc fills **green** (`bg-status-success`), not the **quadrant accent + white check**. | Fill ring with `var(--qN)`, render a white check. |
| 2.3 | **P1** | `task-card-metadata.tsx:37-44` | Tag chips are **neutral gray**, not **quadrant-wash bg + quadrant-accent text**. | Recolor to `var(--qN-wash)` bg + `var(--qN)` text. |
| 2.4 | **P2** | `task-card-metadata.tsx:49-67` | Subtask progress fill uses global `--accent` (tide), not the card's quadrant accent; track is full-width, not the spec's fixed 84pt. | Use quadrant accent for fill (green at 100% is fine); fixed track width. |
| 2.5 | **P2** | `task-card/index.tsx:67-76` | **Blocked** card not dimmed to **0.62 opacity** (only *completed* dims, to 0.60). | Apply `opacity-[0.62]` when `isBlocked`. (Lock + "Blocked by n" badge already present, `metadata.tsx:70-80`.) |

### 2B. Card typography scale (P2)

The reference card scale is title 17 / description 15 / meta 13. Shipped:

| Element | Reference | Shipped | Location |
|---|---|---|---|
| Title | 17px semibold | **15px** | `task-card-header.tsx:64` |
| Description | 15px | **12px** (`text-xs`) | `task-card-header.tsx:71` |
| Meta row | 13px, `--ink-3` | **12px**, `--gray-500` | `task-card-actions.tsx:41` |

Family is correct (sans, never serif). See Bucket 6 for the systemic type-scale question.

### 2C. Card states (P2)

| State | Finding | Location |
|---|---|---|
| Due today | Uses **amber** (`bg-warning-tint`), reference wants **tide-semibold**. | `task-card-actions.tsx:43-47` |
| Overdue | Rust badge present ✅ but **no warning glyph**. | `task-card/index.tsx:78-82` |
| Live timer | Pulses the **whole green pill**, not a discrete **accent dot**; time not zero-padded `HH:MM:SS`. (Reduce-motion suppression ✅.) | `task-timer.tsx:106-138`, format `:41-44` |
| Recurrence | ✅ Compliant (repeat glyph in meta row). | `task-card-actions.tsx:59-67` |

### 2D. Quadrant header (P2)

| # | Finding | Location |
|---|---|---|
| 2.6 | **Missing the fixed 26pt icon column.** `meta.rdIcon` (flame/calendar/users/trash) exists in `lib/quadrants.ts:42` but is **never rendered**. | `quadrant-pane.tsx:103-127` |
| ✅ | Serif title in the pigment — compliant (`rd-serif`, `style color: accent`). | `quadrant-pane.tsx:109-114` |
| ✅ | Quiet graphite tabular count — compliant. | `quadrant-pane.tsx:116-118` |

### 2E. Capture bar (mostly compliant)

- ✅ **Live quadrant chip recolors + re-labels** as shorthand (`!!` `*` `#tag`) is typed
  (`capture-bar.tsx:88-92,152-172`). This is a signature interaction and it works.
- `[divergence]` Capture bar is `rounded-xl` + flat-at-rest (shadow on focus only), not a full pill
  with a resting shadow (`capture-bar.tsx:131-135`). Flat-at-rest is a deliberate Inkwell choice.

---

## Bucket 3 — Surface layout & platform translation (P2/P3)

### 3A. Matrix (reference §07)

| # | Sev | Finding | Location | Type |
|---|---|---|---|---|
| 3.1 | **P2** | Quadrant separation is **16px** (`gap-4`), reference wants **32pt**. | `matrix-grid.tsx:52` | `[achievable]` one-class fix (`gap-8` on phone) |
| 3.2 | **P2** | **No scroll inset** under the sticky capture bar — top-anchored rows tuck under the blurred bar; reference wants a 12pt clearance. | (none — `scroll-padding` absent) | `[achievable]` `scroll-padding-top` on the scroll container |
| ✅ | True responsive **2×2 board** at `md+`, correct Q1→Q4 placement. | `matrix-grid.tsx:52,73` | compliant |
| ✅ | **Drag-to-reclassify** via @dnd-kit flips urgent/important; keyboard + touch sensors. | `quadrant-pane.tsx:66`, `use-drag-and-drop.ts:60-82`, `tasks/crud/move.ts:27-36` | compliant |
| 3.3 | **P3** | **No smart-views sidebar / no detail-pane split-view** at wide. Reduced to nav rail + board + overlay drawer. Partly intentional per ADR 0011 (smart views de-emphasized in v9). | `smart-view-strip.tsx` (horizontal pills), `icon-rail.tsx:58` | `[divergence]` confirm intent |

### 3B. Editor (reference §07)

| # | Sev | Finding | Location | Type |
|---|---|---|---|---|
| 3.4 | **P1** | **Quadrant picker doesn't mirror the matrix.** Selected cell is correct (wash + accent border), but the **three unselected cells are neutral**, not their quadrant pigment at ~0.35 opacity. Breaks "the matrix is the argument" inside the editor. | `edit-drawer.tsx:207-235` | `[achievable]` high conceptual payoff |
| 3.5 | **P2** | Due-date presets render **graphite/neutral**, reference wants **tint** (`--accent`) with values graphite. | `edit-drawer.tsx:237-263` | `[achievable]` |
| ✅ | Serif sheet title. | `edit-drawer.tsx:165` | compliant |
| 3.6 | **P3** | Editor is a **right-side drawer**, not a detented `.medium → .large` bottom sheet. | `edit-drawer.tsx:150-161` | `[platform-inherent]` side drawer is an acceptable web substitution; optionally use a `vaul` bottom sheet on phone |

### 3C. Archive (reference §07)

| # | Sev | Finding | Location |
|---|---|---|---|
| 3.7 | **P2** | Archive renders the **full interactive, pigmented `TaskCard`** with **no 0.72 dim** and strikethrough only when `completed`. Reference wants a dimmed (0.72), read-only, strikethrough surface. | `app/(archive)/archive/page.tsx:181-187` |
| ✅ | Restore (subtle/tint) + Delete (rust) + **undo on both**. | `archive/page.tsx:54-94,192-206` |

---

## Bucket 4 — Gestures & motion (reference §08)

| # | Sev | Finding | Location | Type |
|---|---|---|---|---|
| 4.1 | **P2** | **Long-press / context-menu action set is incomplete.** Mobile overflow menu offers only Share/Duplicate/Delete; **missing Complete, Start/Stop timer, Snooze, Move-to-quadrant**. No `onContextMenu` (no iPad right-click). Core verbs unreachable on touch. | `task-card-actions.tsx:177-206` | `[achievable]` |
| 4.2 | **P2** | **Counts don't roll** (no `.numericText()` equivalent) — just `tabular-nums`, instant swap. Signature motion cue when tasks move. | `index.tsx:468-477`, `quadrant-pane.tsx:116` | `[achievable]` |
| 4.3 | **P3** | New card doesn't visibly **drop into its quadrant** on capture (`handleCapture` never calls `highlightTaskById`; the highlight machinery already exists for deep links). | `matrix-simplified/index.tsx:298-315` vs `:221-231` | `[achievable]` cheap |
| 4.4 | **P3** | No **swipe** actions (leading complete / trailing snooze+delete). App uses tap targets + dnd-kit. | — | `[platform-inherent]` JS swipe achievable but substitution reasonable |
| 4.5 | **P3** | Delete fires immediately with **undo toast** rather than "confirms once." | `index.tsx:340-351` | `[divergence]` arguably better web pattern |
| 4.6 | **P3** | No **haptics** (`navigator.vibrate` absent; iOS Safari has no support). | — | `[platform-inherent]` |
| ✅ | **Confetti on complete**, CSP-safe, spring-approximated `check-pop`. | `lib/confetti.ts`, `index.tsx:332`, `globals.css:481-519` | compliant |
| ✅ | **Reduce Motion**: confetti suppressed, animations stilled, loops capped. | `lib/confetti.ts:17-20`, `globals.css:615-629` | compliant (stronger than spec) |

---

## Bucket 5 — Empty states & onboarding (reference §09)

| # | Sev | Finding | Location | Type |
|---|---|---|---|---|
| 5.1 | **P1** | **No onboarding flow exists.** First run redirects to `/about` — a scrolling **marketing page**, not the reference's 4-screen skippable carousel (Welcome → Matrix → Capture shorthand → Privacy & sync) with page dots, Skip top-right, "Start using GSD" primary + quiet "Sign in to sync," re-showable from Settings. | `first-time-redirect.tsx`, `app/about/page.tsx:30-40` | `[achievable]` biggest user-facing gap |
| 5.2 | **P2** | **Empty-state mark/icon tile missing.** Quadrant empties have serif headline + body + dashed CTA, but **no reassuring single icon in ink-3 on a 60pt sunken tile**. | `quadrant-pane.tsx:132-151` | `[achievable]` |
| 5.3 | **P2** | Empty CTA shown in **all** quadrants including Q4 "No noise to clear," where the reference says **omit the action when there's nothing useful to do**. | `quadrant-pane.tsx:142-150` | `[achievable]` |
| ✅ | In-context empty = **dashed prompt row** (not full takeover); serif `.title3` headline; ≤2-line ink-2 body. | `quadrant-pane.tsx:131-151` | compliant |
| 5.4 | **P3** | **Dead emoji data**: `lib/quadrants.ts:61-65,…` carries unused `emptyEmoji` (🎯📅🤝🗑️) + legacy `emptyHeadline/Description/Cta`. Live UI correctly uses `rdEmptyHeadline/rdEmptySupporting` instead, so **no current emoji drift** — but a latent re-drift risk. | `lib/quadrants.ts` | cleanup |

---

## Bucket 6 — Typography (reference §02)

- ✅ **Font wiring + serif placement are compliant.** Newsreader loaded and chained
  (`layout.tsx:54-60`, `inkwell-tokens.css:67`); serif correctly on page/sheet/section/quadrant
  titles via `.rd-serif`; **no body or label copy in serif** (the critical rule). `.rd-serif` is the
  canonical utility (`globals.css:691-695`).
- 6.1 **P3 `[divergence]`** — **Stat numerals are serif** (`stats-card.tsx:66`,
  `streak-indicator.tsx:32`); reference says numerals are functional → sans. Likely an intentional
  editorial flourish; decide whether to keep.
- 6.2 **P2 / decision** — **The type scale is denser than the reference.** Shipped body is **16px**
  (reference 17), quadrant title renders **15px** (reference 20), and there's no 17px Headline step
  (`inkwell-tokens.css:72-79`, `quadrant-pane.tsx:110`). This is a deliberate web-density choice but
  it's a literal divergence; decide strict vs spirit (see TL;DR framing).

---

## Bucket 7 — Dashboard & Settings color discipline (reference §07)

| # | Sev | Finding | Location |
|---|---|---|---|
| 7.1 | **P2** | **Top Tags bars are tide (`bg-q2/80`), not graphite** — a regression of the documented polish-pass change ("a tag borrows no quadrant pigment"). | `tag-analytics.tsx:59-61` |
| 7.2 | **P2** | **Settings toggles turn tide, not green.** Affects every switch/checkbox/radio. Reference: toggles green when on. | `components/ui/switch.tsx` (`data-[state=checked]:bg-accent`), `inkwell-components.css:255,200,223` |
| 7.3 | **P2** | **Dashboard stat/streak icons tinted tide, not graphite**, and the sanctioned **rust streak flame is absent** (replaced by a tide calendar icon, by design). | `stats-card.tsx:71-73`, `streak-indicator.tsx:14,40-42` |
| 7.4 | **P3** | **"Wall of blue" risk:** leading icons on navigation rows (Export/Import/Sync-history/Archive-now) are tinted tide; reserve tide for true actions/links. | `data-management.tsx:133`, `archive-settings.tsx:166`, `sync-settings.tsx:125,144` |
| 7.5 | **P3** | Command palette lacks a **visible serif "Commands" title** (`sr-only`) and the **dimmed-board "pop" shadow** (`shadow-2xl`, no backdrop scrim). | `command-palette/index.tsx:92,95` |
| ✅ | Completion trend = green + graphite dashed; quadrant donut = four pigments; serif stat numerals; smart-view pills graphite. | `completion-chart.tsx:96-114`, `quadrant-distribution.tsx`, `smart-view-strip.tsx:26-32` |

---

## Bucket 8 — Documentation drift (P2 — actively misleading)

| # | Location | Finding |
|---|---|---|
| 8.1 | `DESIGN.md`, `PRODUCT.md` (repo root) | Both describe the **dead "Indigo & Cloud" system**: deep-indigo accent, sage Q3, amber Q4, cool-stone ground, Georgia-only serif, "no web fonts loaded." All contradict the shipped GSD Editorial palette. The reference itself calls for regenerating `DESIGN.md` (run `/impeccable document`). |
| 8.2 | `CLAUDE.md` | Says the command palette is "**not wired into the v9 app shell**" — it **is** wired (`app-shell.tsx:9,120-125`, opened from the topbar). |
| 8.3 | agent memory `quadrant-colors-source-of-truth.md` | Records the palette as "rust/**indigo**/**olive**/amber" — now stale; shipped is rust/tide/**ochre**/**slate**. |

---

## Recommended action plan (priority order)

**Phase 1 — Brand recolor (P1, ~half a day, highest visibility):** close all of Bucket 1.
Redraw the app icon (1.1), fix the brand glyph (1.2) and About matrix (1.3), update manifest/OG
(1.4-1.5), delete dead `public/css/*` and the latent soft-token drift (1.6-1.7).
→ `/impeccable colorize` then `/impeccable polish`.

**Phase 2 — Card anatomy (P1, the structural core):** thread the quadrant key into `TaskCard`,
then add the spine (2.1), quadrant-accent completion disc (2.2), quadrant-wash chips (2.3),
quadrant subtask fill (2.4), blocked dimming (2.5), and the quadrant-header icon column (2.6).
→ `/impeccable layout` + `/impeccable colorize`.

**Phase 3 — Surfaces & color discipline (P2):** editor quadrant-picker mirror (3.4), due-date
preset tint (3.5), matrix spacing + scroll inset (3.1-3.2), archive dim (3.7), Top Tags graphite
(7.1), green toggles (7.2), graphite dashboard chrome (7.3).
→ `/impeccable polish`.

**Phase 4 — Onboarding & empty states (P1 user-facing, larger build):** build the 4-screen
skippable onboarding (5.1); add empty-state mark tiles and omit the no-op CTA (5.2-5.3).
→ `/impeccable onboard`.

**Phase 5 — Motion & interaction (P2/P3):** complete the long-press/context-menu action set (4.1),
add rolling counts (4.2) and the capture drop-in highlight (4.3).
→ `/impeccable animate`.

**Phase 6 — Docs (P2):** rewrite `DESIGN.md`/`PRODUCT.md` to the shipped palette, fix the CLAUDE.md
palette-wiring note. → `/impeccable document`.

**Decisions to make (not bugs — accept or close):** type scale density (6.2), serif numerals (6.1),
side drawer vs detented sheet (3.6), swipe vs tap (4.4), delete-confirm vs undo (4.5), smart-views
sidebar (3.3). These are defensible web divergences from an iOS reference.

---

## What's already excellent (keep)

- Exact-match token system (colors, washes, dark lifts, neutrals, tide accent, Newsreader serif).
- True responsive 2×2 board with correct Q1→Q4 placement and full @dnd-kit drag-to-reclassify
  (keyboard + touch sensors — strong a11y).
- Live recoloring capture chip with shorthand parsing.
- Confetti + comprehensive `prefers-reduced-motion` handling.
- Serif discipline: titles serif, body never serif.
- Color independence: quadrants always carry label + position + `aria-label`, never hue alone.
