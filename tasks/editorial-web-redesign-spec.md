# Spec: Editorial visual language for GSD Web

Source: `design_handoff_web/README.md` + `design_handoff_web/styles/tokens.css`.
Tier: Non-trivial (shared design tokens). Approach approved by user 2026-06-04.

## Goal
Bring the GSD editorial design language to the web app: retire system-blue from
chrome and charts, shift the neutral ramp warm, and run headlines in a
cross-platform serif. **Visual/style only** — no feature, routing, or data changes.

## Approved decisions
1. **Chrome de-blue = editorial treatment** (not a token swap). Graphite/ink by
   default; tide tint reserved for true actions (capture submit) + focus rings;
   selection state uses neutral `sunken` fill + ink, with a quadrant pigment for the
   rail icon.
2. **Add Newsreader** via `next/font/google` (weights 400/500/600 + italic 500),
   inserted into the `--serif` chain after `ui-serif`/"New York".
3. **Colors-only** — keep current Inkwell radii/spacing/shadows. No shape changes.

## Token strategy (why not paste the handoff)
The handoff names `--paper` = *page bg*; Inkwell names `--paper` = *card surface*.
Pasting raw would clobber every card. Instead retune Inkwell's brand-layer tokens
in place (the documented variants/ mechanism), keeping Inkwell's vocabulary.

Mapping (light → warm editorial):
- `--ivory` page bg → `#F4F1E9` · `--paper` card → `#FFFFFF` · `--oat` sunken → `#ECE7DC`
- `--slate` ink → `#211E1A` · gray ramp → warm taupe (gray-100 `#ECE7DC` sunken,
  gray-200 `#E3DDD0` hairline, gray-300 `#D8D1C1` hairline-strong, gray-500 `#6E6760`
  ink-2 (AA: 5.6:1 on white / 4.9:1 on paper), gray-700 `#3A372F`)
- `--accent` indigo → tide `#2C6680` (+ derived d/tint/focus/border) — **the de-blue lever**
- `--olive` → forest success `#3E7D52` (decoupled from q3) · `--rust` → `#B23A2E`
- `--info`/`--sky` cool-steel blues → tide family (no raw system-blue survives)
- New `--ink-3` `#A49B8D` (chart "Created" dotted line)

Quadrant pigments become first-class, decoupled from semantic colors:
`--q1 #B23A2E · --q2 #2C6680 · --q3 #8A6A22 (ochre, NOT olive) · --q4 #6F685F`
+ washes; matrix backdrops repoint via `--q*-fill`. `lib/quadrants.ts`
`QUADRANT_ACCENT*` maps repoint to `var(--q1..q4)`. Dark mode mirrors in all three
dark blocks (the two inkwell-tokens dark blocks + globals `--q*-fill`).

## Charts (component edits, not just color swaps)
- completion-chart: Created line → `--ink-3` dotted (was `--accent`); add ~8%
  `--success` area under Completed.
- tag-analytics: bars → `--q2` on `--sunken` tracks.
- quadrant-distribution / donut: four pigments (follows token repoint).
- upcoming-deadlines: overdue already `--alert`; the `--sky` "later" group de-blues via token.

## Out of scope
Task-card state restyle, settings/empty-state reskin, command-palette internals
(not wired into v9 shell), shape/radius changes, mobile bottom-tab redesign.

## Acceptance
- No `#3B4A8C`/indigo or `#6A8CAF`/steel-blue visible in chrome or charts (light + dark).
- Rail/smart-view selection = sunken + ink (+ q1 icon on rail), not tinted.
- Headlines render in Newsreader on non-Apple browsers.
- `bun run test`, `bun typecheck`, `bun lint` green. Verified in running app via
  verify-frontend-change (seeded IndexedDB, busted SW cache), light + dark.
