# 0012 — Redesign color system: muted earth tones

| Field | Value |
|---|---|
| Date | 2026-05-01 |
| Status | Proposed (Phase 2 of redesign-plan.md) |
| Deciders | Vinny Carpenter |
| Supersedes | n/a (modifies the v9 palette established by 0011) |

## Context

The v9 single-matrix UI shipped with a saturated quadrant identity: orange (`#c2410c`) for Q1 "Do First", blue (`#1d4ed8`) for Q2 "Schedule", green (`#15803d`) for Q3 "Delegate", ochre (`#854d0e`) for Q4 "Eliminate"; with indigo-700 (`#4338ca`) as the system accent. That palette read as "productivity-tool consumer software" rather than "focused workspace for serious work" and clashed with the warm-paper canvas the rest of the system uses.

`GSD_REDESIGN_INSTRUCTIONS.md` (April 2026) reframes the visual identity as **Editorial Minimalism / Calm Tech**: muted earth tones, paper-like surfaces, refined typography, intentional whitespace.

## Decision

Replace the saturated palette with desaturated earth tones, keep the existing Geist + Instrument Serif typography, and reuse the existing `--quadrant-accent-{q1..q4}` token names so the swap is one-knob.

### New palette (light mode)

| Token | Old (RGB) | New (RGB) | Hex |
|---|---|---|---|
| `--quadrant-accent-q1` | 194 65 12 (orange) | **122 139 126** | `#7A8B7E` sage green |
| `--quadrant-accent-q2` | 29 78 216 (blue) | **123 143 163** | `#7B8FA3` dusty blue |
| `--quadrant-accent-q3` | 21 128 61 (green) | **157 139 122** | `#9D8B7A` warm taupe |
| `--quadrant-accent-q4` | 133 77 14 (ochre) | **138 140 142** | `#8A8C8E` slate gray |
| `--accent` | 67 56 202 (indigo-700) | **91 107 143** | `#5B6B8F` muted indigo |
| `--accent-hover` | 79 70 229 | 74 90 127 | `#4A5A7F` |
| `--accent-muted` | 199 210 254 | 217 222 234 | `#D9DEEA` |
| `--terracotta` | (new) | 168 111 95 | `#A86F5F` (warning / overdue) |
| `--border-strong` | (new) | 213 210 204 | `#D5D2CC` |
| `--card-background` | 251 250 246 | 254 253 251 | `#FEFDFB` (slight lift) |
| `--foreground-muted` | 113 113 122 | 107 104 101 | `#6B6865` (warmer gray) |
| `--q1..q4-wash` | matched old accents | matched new accents | (same as new --quadrant-accent-*) |

Tokens that remained unchanged because their channel deltas vs. the spec were < 3/255 (imperceptible) or because the existing values better served accessibility:

- `--background` `#f6f5f1` (spec asked `#F5F3EF`; delta (1,2,2))
- `--foreground` `#18181b` (spec asked `#2B2D2E`; delta is perceptible but lowers contrast vs. background — we chose to keep maximum ink contrast)
- `--border` `#e6e3db` (delta (1,1,2))
- `--background-muted` `#efede7` (already matches the spec's `--color-capture-bar-bg: #EFEEE9` target — delta (0,1,2))

### Dark mode (per redesign-plan.md decision D1 = Option B)

Per the advisor's "axe-drive, don't pre-derive" guidance, the dark `.dark` block first-cut copies the same RGB triples as light for `--quadrant-accent-*` and `--q*-wash`. Measured contrast in dark mode (see §Verification below) ranges 5.42–5.97:1 for all four quadrant labels — passes AA normal cleanly. No dark-specific quadrant variants needed.

For `--accent` and `--terracotta`, lifted dark variants were derived because they're used as text on dark surfaces:

- Dark `--accent`: `142 156 188` (`#8E9CBC` lifted muted indigo) — needed for `text-accent` legibility on dark `#0c0c0d`
- Dark `--terracotta`: `196 138 122` (`#C48A7A`)
- Dark `--border-strong`: `64 64 70` (`#404046`)

## Consequences

### What gets easier

- One source of truth via `lib/quadrant-accent.ts` + `--quadrant-accent-{q1..q4}` tokens. Future palette tweaks are one-line edits.
- Cohesive look across matrix, dashboard, command palette, about page — all four surfaces now use the same accent identity.
- Calmer aesthetic supports long-session focus work, aligns with the "privacy-first" positioning.

### What gets harder

- **Quadrant labels at 11px bold fail WCAG 2.1 AA normal in light mode** (see Verification below). Header text on warm card at sage/dusty-blue/taupe/slate measures 3.00–3.31:1 against the required 4.5:1. They pass AA Large (≥3.0:1) but only barely, and 11px-bold doesn't qualify as "Large" under the WCAG definition (need ≥18.6px or ≥14pt-bold). This regression is acknowledged and resolved in subsequent phases:
  - **Phase 5** (quadrant header redesign) will switch label color to deep charcoal + accent-colored dot prefix, restoring AA normal contrast while preserving quadrant identity.
  - Until Phase 5 lands, light-mode quadrant labels are visually low-contrast; functionality unaffected (titles also live in `aria-label` on the section).
- Q1 "Do First" reads as calm/sage rather than alarming/orange. Users who anchor on "orange = urgent" will need to re-learn. Intentional per spec ("urgent but calm").
- The `gsd-logo.tsx` mosaic mark loses its high-contrast Q1 emphasis. A monochrome alternate (`GsdLogoMonochrome`) is provided in the same file; switching is a one-import-line change.

### Out of scope

- No font-family changes (kept Geist + Instrument Serif; spec asked for Freight Text/Tiempos/Spectral but the existing pair already serves the editorial aesthetic without webfont costs — see redesign-plan.md D4).
- No structural matrix layout changes (Phase 4 task).
- No capture-bar elevation / icon changes (Phase 3 task).
- The legacy `--quadrant-{focus,schedule,delegate,eliminate}` tint tokens (light: peach/blue/green/yellow) remain in `globals.css` because they have zero consumers — cleanup deferred to a future sweep.

## Verification

Measured against running dev server at `localhost:3000` on 2026-05-01, light + dark mode, via in-page DOM contrast calculator.

### Light mode results

| Element | fs / weight | Foreground | Background | Ratio | AA threshold | Verdict |
|---|---|---|---|---|---|---|
| Q1 label "DO FIRST" | 11 / 700 | sage `#7A8B7E` | canvas `#f6f5f1` | **3.31:1** | 4.5 | **fail AA normal**, pass AA Large |
| Q2 label "SCHEDULE" | 11 / 700 | dusty `#7B8FA3` | canvas `#f6f5f1` | **3.06:1** | 4.5 | **fail AA normal**, pass AA Large |
| Q3 label "DELEGATE" | 11 / 700 | taupe `#9D8B7A` | canvas `#f6f5f1` | **3.00:1** | 4.5 | **fail AA normal**, pass AA Large (boundary) |
| Q4 label "ELIMINATE" | 11 / 700 | slate `#8A8C8E` | canvas `#f6f5f1` | **3.09:1** | 4.5 | **fail AA normal**, pass AA Large |
| Quadrant hint text | 12 / 400 | warm-gray `#6B6865` | canvas | 5.07:1 | 4.5 | pass |
| Quadrant count badge | 11 / 500 | warm-gray | canvas | 4.73:1 | 4.5 | pass |
| Empty state italic | 14 / 400 | warm-gray | canvas | 5.07:1 | 4.5 | pass |
| Task card title | 15 / 600 | foreground `#18181b` | card `#FEFDFB` | 17.43:1 | 4.5 | pass |
| Capture bar input | 14.5 / 400 | foreground | card | 17.43:1 | 4.5 | pass |
| Add button text | 13 / 500 | canvas (white-ish) | accent `#5B6B8F` | 16.24:1 | 4.5 | pass |

### Dark mode results

| Element | Ratio | Verdict |
|---|---|---|
| Q1 label sage on `#0c0c0d` | 5.42:1 | pass |
| Q2 label dusty blue on `#0c0c0d` | 5.87:1 | pass |
| Q3 label warm taupe on `#0c0c0d` | 5.97:1 | pass |
| Q4 label slate gray on `#0c0c0d` | 5.79:1 | pass |
| Quadrant hint | 7.63:1 | pass |
| Task title | 16.74:1 | pass |

### What axe-core would flag

`color-contrast` violations on the four quadrant header labels in light mode only. All other introduced color pairs pass. CDN script-load is blocked by the existing CSP (`script-src 'self' 'unsafe-inline'`), so the in-page DOM calculator above stands in for `@axe-core/react`.

## Alternatives considered

1. **Add parallel `--color-{sage,dusty-blue,...}` semantic tokens** alongside the existing `--quadrant-accent-*`. Rejected — duplicates the naming surface and creates ambiguity for future contributors about which to use.
2. **Bump quadrant label size to 18px+ to qualify as AA Large.** Rejected for this PR — that's a Phase 5 markup concern, not a Phase 2 token concern. Folding it forward would couple the PRs and inflate the diff.
3. **Use deep-charcoal text + colored dot for quadrant labels in this PR.** Rejected — the user-authored spec example (§5) explicitly shows accent-colored label text. Surfacing the contrast tradeoff to the user with measured ratios is more honest than silently changing the spec.
4. **Pre-derive lifted dark variants for all quadrant accents.** Rejected — measurement-driven approach revealed dark already passes AA cleanly with same RGB triples, saving four arbitrary derivations.

## Open question for the user (resolve before Phase 5)

Quadrant labels in light mode at 11px bold fail WCAG 2.1 AA normal (3.00–3.31:1 vs. required 4.5:1). Three options for Phase 5:

- **(α) Honor the spec.** Keep accent-colored labels at 11px bold; accept AA fail. Reason given: editorial calm aesthetic; quadrant title is also exposed via `aria-label` on the section so screen readers aren't affected.
- **(β) Bump to AA Large.** Switch labels to 14pt bold (≥18.6px) — qualifies as AA Large. Trades visual hierarchy (labels become more prominent than intended).
- **(γ) Two-color treatment.** Deep charcoal text + accent-colored dot prefix (e.g., a 6px sage dot before "Do First"). Restores AA normal contrast, keeps quadrant identity visible, doesn't bulk up the typography.

Default proposal: **γ**. Decide before Phase 5.
