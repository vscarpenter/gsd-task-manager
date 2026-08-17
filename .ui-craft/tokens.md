# Design Tokens

<!-- Always loaded by the ui-craft skill. This documents the shipped GSD Editorial contract.
     Runtime foundation/status tokens live in app/css/inkwell-tokens.css. GSD quadrant and
     component aliases live in app/globals.css. Keep automatic and forced-dark branches identical. -->

## Token spine

GSD Editorial uses three practical layers:

1. **Foundation:** surface, ink, accent, neutral, type, spacing, radius, shadow, motion and z-index
   values in `app/css/inkwell-tokens.css`.
2. **Semantic:** interaction and status roles that remap deliberately between light and dark.
3. **Component/domain:** quadrant families and aliases such as `--shadow-card` and
   `--status-overdue-ink` in `app/globals.css`.

Use semantic or component tokens in UI code. Raw values belong only in the token declarations,
self-contained degraded fallbacks, and fixed-format assets that cannot consume CSS variables.

## Color

### Light foundation

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--ivory` | `#F4F1E9` |
| Paper | `--paper` | `#FFFFFF` |
| Primary ink | `--slate` | `#211E1A` |
| Raised surface | `--oat` | `#FBF9F3` |
| Interaction | `--accent` | `#2C6680` |
| Interaction hover/pressed | `--accent-d` | `#234F63` |
| Ink on interaction | `--on-accent` | `#FFFFFF` |
| Interaction tint | `--accent-tint` | `rgba(44, 102, 128, 0.14)` |
| Focus halo | `--accent-focus-ring` | `rgba(44, 102, 128, 0.22)` |
| Strong accent boundary | `--accent-strong-border` | `rgba(44, 102, 128, 0.5)` |

### Dark foundation

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--ivory` | `#17150F` |
| Raised surface | `--oat` | `#1B1812` |
| Paper | `--paper` | `#221E17` |
| Primary ink | `--slate` | `#F1ECE2` |
| Interaction | `--accent` | `#6FAACB` |
| Interaction hover/pressed | `--accent-d` | `#5A93B5` |
| Ink on interaction | `--on-accent` | `#17150F` |
| Interaction tint | `--accent-tint` | `rgba(111, 170, 203, 0.18)` |
| Focus halo | `--accent-focus-ring` | `rgba(111, 170, 203, 0.28)` |
| Strong accent boundary | `--accent-strong-border` | `rgba(111, 170, 203, 0.6)` |

The light tide accent has 6.33:1 contrast on paper. The lifted dark tide accent pairs with dark
paper ink at 7.20:1. `--on-accent` must switch with the theme; white is not valid text on the
lifted dark accent.

### Neutral and shell tokens

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--gray-100` | `#ECE7DC` | `#1B1812` | Sunken/inset fill |
| `--gray-200` | `#E3DDD0` | `#2A2620` | Quiet rule |
| `--gray-300` | `#D8D1C1` | `#322D24` | Default boundary |
| `--gray-500` | `#6E6760` | `#A79F92` | Muted text |
| `--gray-700` | `#3A372F` | `#C8C0B2` | Secondary strong ink |
| `--ink-3` | `#797368` | `#948A79` | Quiet chart/glyph ink, not body text |
| `--control-border` | `#938A7B` | `#746A5B` | 3:1+ control boundary |
| `--pane-border` | `#D8D1C1` | `#322D24` | Quadrant pane boundary |
| `--rail` | `#F0ECE2` | `#1B1812` | Icon rail |
| `--topbar` | `#FBF9F3` | `#1B1812` | Top bar |

Light `--gray-500` measures 5.6:1 on paper (4.9:1 on ivory). Do not use `--ink-3` for normal text;
scoped surfaces may rebind it to `--gray-500` when text contrast is required.

### Semantic status families

| Role | Light pigment / ink | Dark pigment / ink | On solid fill |
| --- | --- | --- | --- |
| Success | `#3E7D52` / `#2F5F44` | `#6FB07F` / `#9CCBA6` | `#FFFFFF` / `#17150F` |
| Danger | `#B23A2E` / `#98301F` | `#E0705F` / `#E8907F` | `#FFFFFF` / `#17150F` |
| Warning | `#C78E3F` / `#8A5A1F` | `#D9A55F` / `#D9A55F` | Use the theme's contrast-safe ink |
| Information | `#2C6680` | `#6FAACB` | Use `--on-accent` |
| Alternate information | `#4E7E96` | `#7FB0CB` | Use the paired semantic ink |

Additional destructive control tokens are light `--danger-fill: #B23A2E` and
`--danger-fill-hover: #98301F`; dark remaps them to `#E0705F` and `#D5614F`. Base pigments
are suitable for icons, rules, dots, and tinted-surface construction. Text on tints uses the
`*-d`, `*-dark`, or `*-ink` token.

Status aliases:

- Overdue: `--status-overdue`, `--status-overdue-muted`, `--status-overdue-ink` → danger family.
- Blocked: `--status-blocked`, `--status-blocked-muted`, `--status-blocked-ink` → warning family.
- Blocking: `--status-blocking`, `--status-blocking-muted`, `--status-blocking-ink` → slate family.
- Success: `--status-success`, `--status-success-muted`, `--status-success-ink` → success family.

### Quadrant families

Quadrant color means matrix priority, not general interaction or metadata. Use pigment for icons,
rules, completion discs and the 3px task-card spine; ink for text; wash for the pane; header for
the title band.

#### Light

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#B23A2E` | `#B23A2E` | `#F4EBE5` | `#F4E4E0` |
| Q2 · Schedule | `#2C6680` | `#2C6680` | `#E9EFF1` | `#E1ECF1` |
| Q3 · Delegate | `#8A6A22` | `#74591C` | `#F2EDE1` | `#F0E9D8` |
| Q4 · Eliminate | `#6F685F` | `#615B54` | `#EFEDE7` | `#ECE9E3` |

#### Dark

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#E0705F` | `#E0705F` | `#231914` | `#3A211D` |
| Q2 · Schedule | `#6FAACB` | `#6FAACB` | `#171E1E` | `#173039` |
| Q3 · Delegate | `#CFB266` | `#CFB266` | `#201D12` | `#322B17` |
| Q4 · Eliminate | `#A9A096` | `#A9A096` | `#1E1B15` | `#2A2620` |

The lifted dark pigments clear AA as text on their washes and headers, so dark inks equal their
pigments. Automatic dark mode and `[data-theme="dark"]` must declare the same values.

### Color rules

- Tide is restrained global interaction ink: actions, selection, links, and focus.
- Q2 shares tide's hex by design, but `--accent` and `--q2` stay separate tokens; never use tide
  as a decorative wash, a glow, or gradient decoration.
- Never create tide/cyan gradients or gradient text; don't turn Editorial into a blue-gradient
  aesthetic.
- Tags and unrelated metadata stay neutral; quadrant identity stays in the matrix header/card marks.
- Never place gray text on a colored surface. Use the hue's ink or adaptive on-color token.

## Typography

Newsreader is loaded with `next/font` at weights 400, 500 and 600, normal and italic. It is
self-hosted in the static build and exposed as `--font-newsreader`.

- `--serif`: `--font-newsreader` (Newsreader) feeds the serif chain, standing in for Apple's New
  York on non-Apple platforms; it carries display and headlines.
- `--sans`: the system sans stack — carries body, labels, and working UI.
- `--mono`: system mono for code and keyboard notation, plus the uppercase kicker voice —
  the `.kicker` component class (11px mono, 0.08em tracking) is the sanctioned eyebrow
  treatment on marketing/docs surfaces. Mono never carries body text.

| Token | Size / line-height | Weight | Tracking |
| --- | --- | --- | --- |
| `--t-display` | 48px / 1.1 | 500 | −0.02em |
| `--t-h1` | 32px / 1.2 | 500 | −0.01em |
| `--t-h2` | 24px / 1.3 | 500 | −0.01em |
| `--t-h3` | 19px / 1.22 | 500 | −0.008em |
| `--t-body` | 16px / 1.55 | 430 token | default |
| `--t-small` | 14px / 1.5 | 430 token | default |
| `--t-caption` | 12px / 1.4 | 500 | default |
| `--t-eyebrow` | 11px / 1 | 500–600 by component | 0.12em |

Use tabular numerals for aligned stats. Balance headings, keep prose to 65–75ch, and do not add
a second display/body family.

## Spacing

8px base with a 4px micro step:

`--sp-1: 4px` · `--sp-2: 8px` · `--sp-3: 12px` · `--sp-4: 16px` ·
`--sp-5: 24px` · `--sp-6: 32px` · `--sp-7: 48px` · `--sp-8: 64px`

Default page padding is 24px. Content widths are 820px narrow, 920px default and 1120px wide.

## Radius and borders

| Token | Value | Typical role |
| --- | --- | --- |
| `--r-xs` | 4px | Tiny indicators |
| `--r-icon` | 8px | Icon buttons |
| `--r-sm` | 10px | Inputs and buttons |
| `--r-md` | 12px | Task and stat cards |
| `--r-lg` | 14px | Quadrant panes and large panels |
| `--r-xl` | 20px | Expressive overlays |
| `--r-pill` | 999px | Pills and circular controls |

Default, strong, hairline and rule borders are all 1px. Use `--control-border` when an interactive
boundary must clear 3:1; the quieter gray/pane boundaries are for grouping, not affordance.

## Shadows and backdrop

Light shadows are two-layer warm-ink-tinted stacks:

- `--shadow-sm`: `0 1px 2px rgba(40,33,22,.055), 0 6px 15px rgba(40,33,22,.035)`.
- `--shadow-md`: `0 3px 8px rgba(40,33,22,.07), 0 14px 30px rgba(40,33,22,.055)`.
- `--shadow-lg`: `0 5px 12px rgba(40,33,22,.08), 0 20px 44px rgba(40,33,22,.07)`.
- `--shadow-card-hover`: `0 4px 10px rgba(40,33,22,.08), 0 16px 34px rgba(40,33,22,.07)`.

Dark shadows use black at 45–55% opacity. `--backdrop` is `rgba(21,18,13,.52)` in light and
`rgba(0,0,0,.6)` in dark. Component aliases are `--shadow-card`, `--shadow-column`, and
`--shadow-fab`.

## Motion and z-index

- Durations: `--t-fast: 120ms`, `--t-base: 150ms`, `--t-slow: 300ms`.
- Standard easing: `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Expressive easing exists as `--ease-pop`, but bounce is not the default interaction language.
- Every animation honors `prefers-reduced-motion`.
- Z-index: base 1, raised 10, sticky 20, overlay 30, modal 50.
