# Design Tokens

<!-- Always loaded by the ui-craft skill. This documents the shipped Violet Frost contract.
     Runtime foundation/status tokens live in app/css/inkwell-tokens.css. GSD quadrant and
     component aliases live in app/globals.css. Keep automatic and forced-dark branches identical. -->

## Token spine

Violet Frost uses three practical layers:

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
| Canvas | `--ivory` | `#F3F3F7` |
| Paper | `--paper` | `#FDFDFF` |
| Primary ink | `--slate` | `#242331` |
| Raised surface | `--oat` | `#F7F7FA` |
| Interaction | `--accent` | `#5C4F7D` |
| Interaction hover/pressed | `--accent-d` | `#4E426B` |
| Ink on interaction | `--on-accent` | `#FDFDFF` |
| Interaction tint | `--accent-tint` | `rgba(92, 79, 125, 0.12)` |
| Focus halo | `--accent-focus-ring` | `rgba(92, 79, 125, 0.24)` |
| Strong accent boundary | `--accent-strong-border` | `rgba(92, 79, 125, 0.52)` |

### Dark foundation

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--ivory` | `#14131B` |
| Raised surface | `--oat` | `#191821` |
| Paper | `--paper` | `#211F2B` |
| Primary ink | `--slate` | `#ECEAF2` |
| Interaction | `--accent` | `#A99BCB` |
| Interaction hover/pressed | `--accent-d` | `#BBAFDA` |
| Ink on interaction | `--on-accent` | `#14131B` |
| Interaction tint | `--accent-tint` | `rgba(169, 155, 203, 0.18)` |
| Focus halo | `--accent-focus-ring` | `rgba(169, 155, 203, 0.30)` |
| Strong accent boundary | `--accent-strong-border` | `rgba(169, 155, 203, 0.62)` |

The light aubergine has 7.20:1 contrast on paper. The lifted dark aubergine has 6.36:1
contrast with dark paper ink. `--on-accent` must switch with the theme; white is not valid text
on the lifted dark accent.

### Neutral and shell tokens

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--gray-100` | `#ECECF2` | `#292734` | Sunken/inset fill |
| `--gray-200` | `#E2E1EA` | `#302E3B` | Quiet rule |
| `--gray-300` | `#D9D9E4` | `#393645` | Default boundary |
| `--gray-500` | `#646477` | `#AAA6B8` | Muted text |
| `--gray-700` | `#3F3E50` | `#D0CDD9` | Secondary strong ink |
| `--ink-3` | `#89899B` | `#777383` | Quiet chart/glyph ink, not body text |
| `--control-border` | `#8D8C9D` | `#6F6B80` | 3:1+ control boundary |
| `--pane-border` | `#D6D5E0` | `#393645` | Quadrant pane boundary |
| `--rail` | `#EEEFF4` | `#191821` | Icon rail |
| `--topbar` | `#F7F7FA` | `#191821` | Top bar |

Light `--gray-500` measures 5.69:1 on paper. Do not use `--ink-3` for normal text; scoped
surfaces may rebind it to `--gray-500` when text contrast is required.

### Semantic status families

| Role | Light pigment / ink | Dark pigment / ink | On solid fill |
| --- | --- | --- | --- |
| Success | `#4F7B5F` / `#3B644A` | `#82B793` / `#A0C9AB` | `#FDFDFF` / `#14131B` |
| Danger | `#B95F5A` / `#873F3C` | `#D88C86` / `#E7A7A3` | `#FDFDFF` / `#14131B` |
| Warning | `#A17D37` / `#71551F` | `#D0AF68` / `#E0C485` | Use the theme's contrast-safe ink |
| Information | `#5C4F7D` | `#A99BCB` | Use `--on-accent` |
| Alternate information | `#7A7D8E` | `#A5A7B8` | Use the paired semantic ink |

Additional destructive control tokens are light `--danger-fill: #873F3C` and
`--danger-fill-hover: #753633`; dark remaps them to `#D88C86` and `#E7A7A3`. Base pigments
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
| Q1 · Do First | `#B95F5A` | `#873F3C` | `#FBF5F4` | `#F2DEDC` |
| Q2 · Schedule | `#4D7A72` | `#315B54` | `#F2F8F6` | `#DDEBE7` |
| Q3 · Delegate | `#A17D37` | `#71551F` | `#FAF7EF` | `#F0E6CF` |
| Q4 · Eliminate | `#7A7D8E` | `#56596B` | `#F5F5F8` | `#E6E6ED` |

#### Dark

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#D88C86` | `#E7A7A3` | `#1C181E` | `#352327` |
| Q2 · Schedule | `#83B2A8` | `#A6CEC6` | `#171E1D` | `#253632` |
| Q3 · Delegate | `#D0AF68` | `#E0C485` | `#1E1B17` | `#352E20` |
| Q4 · Eliminate | `#A5A7B8` | `#C3C4D0` | `#1B1B22` | `#2C2C37` |

The dark ink/header pairs measure 7.36:1, 7.42:1, 7.94:1 and 7.97:1 respectively.
Automatic dark mode and `[data-theme="dark"]` must declare the same values.

### Color rules

- Aubergine is restrained global interaction ink: actions, selection, links, and focus.
- Aubergine is never Q2, a decorative wash, a glow, or gradient decoration.
- Never create purple/cyan gradients or gradient text from the Violet Frost name.
- Tags and unrelated metadata stay neutral; quadrant identity stays in the matrix header/card marks.
- Never place gray text on a colored surface. Use the hue's ink or adaptive on-color token.

## Typography

Albert Sans is loaded with `next/font` at weights 400, 500 and 600, normal and italic. It is
self-hosted in the static build and exposed as `--font-albert`.

- `--sans`: Albert Sans → system sans fallback.
- `--serif`: compatibility alias to the same Albert Sans stack; it does not introduce a serif.
- `--mono`: system mono for code and keyboard notation only.

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

Light shadows are two-layer aubergine-tinted stacks:

- `--shadow-sm`: `0 1px 2px rgba(36,35,49,.055), 0 6px 15px rgba(36,35,49,.035)`.
- `--shadow-md`: `0 3px 8px rgba(36,35,49,.07), 0 14px 30px rgba(36,35,49,.055)`.
- `--shadow-lg`: `0 5px 12px rgba(36,35,49,.08), 0 20px 44px rgba(36,35,49,.07)`.
- `--shadow-card-hover`: `0 4px 10px rgba(36,35,49,.08), 0 16px 34px rgba(36,35,49,.07)`.

Dark shadows use black at 45–55% opacity. `--backdrop` is `rgba(36,35,49,.52)` in light and
`rgba(7,6,11,.68)` in dark. Component aliases are `--shadow-card`, `--shadow-column`, and
`--shadow-fab`.

## Motion and z-index

- Durations: `--t-fast: 120ms`, `--t-base: 150ms`, `--t-slow: 300ms`.
- Standard easing: `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Expressive easing exists as `--ease-pop`, but bounce is not the default interaction language.
- Every animation honors `prefers-reduced-motion`.
- Z-index: base 1, raised 10, sticky 20, overlay 30, modal 50.
