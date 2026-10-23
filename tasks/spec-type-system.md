# Spec: one type system for the web app (`/impeccable typeset`)

Approved by the owner on 2026-10-22: serif weight 600 (DESIGN.md updated), quadrant pane titles move to the serif H3, 13px folds into Small 14, and the iPhone zoom fix ships first in its own PR.

## Goal

Make DESIGN.md's type ramp true in code:
- one size per role, from eight documented steps plus one new documented Numeral role;
- one weight per voice;
- headings in the serif voice wherever DESIGN.md and the iOS app put them;
- text that follows the user's browser font-size setting, as iOS Dynamic Type and Android `sp` already do.

## Inputs and outputs

- **Inputs:** `app/css/inkwell-tokens.css` `--t-*`, the `@theme` text tokens in `app/globals.css`, Inkwell component literals in `app/css/inkwell-components.css`, 63 `text-[Npx]` utilities and 13 inline `fontSize` values across about 25 components.
- **Outputs:**
  - the ramp in rem;
  - Tailwind's `text-xs/sm/base/2xl` remapped onto the ramp (size, line height, weight);
  - every arbitrary and inline size replaced by a ramp step;
  - DESIGN.md updated (serif weight 600, the Numeral role, the corrected spelling note);
  - `tests/fixtures/inkwell-token-contract.json` regenerated on purpose.

## Role map

| Role | Step |
|---|---|
| Page title | H1 32 serif 600 |
| Onboarding title, settings section titles | H2 24 serif 600 |
| Drawer, palette and dialog titles; quadrant pane titles; empty-state headlines; help concept titles; editable title field | H3 19 serif 600 |
| Numeral (new): stat numbers | 40 serif 600, `tabular-nums` |
| Prose | Body 16 / 430, or Small 14 / 430 for dense help text |
| Compact control text (12.5, 13, 13.5, 14.5, 15) and task titles (14 / 600) | Small 14 |
| Chips, badges, metadata, chart text (10, 11, 11.5, 12.5) | Caption 12 / 500 |
| Uppercase labels | Eyebrow 11 / 600 / 0.12em sans; mono kickers stay on About only |
| `kbd` | 11 mono, defined once |

## Constraints

- At the default 16px root, every ramp value renders exactly as today.
- Boxes that hold text use `min-height`, never a fixed `height`, so larger text cannot clip.
- No `clamp()` headings in the product shell (DESIGN.md).
- No new font family or weight file.
- The code-shape ratchet stays green without new violations.

## Edge cases

- A raised browser default font size (125% and 150%) must not clip text: icon rail labels, badges, `kbd`, buttons, truncating titles.
- Inputs on coarse pointers stay at 16px or more (fixed in the zoom PR).
- Dark mode keeps contrast after the weight changes.
- The matrix pane title in serif must still separate clearly from 14px task titles at 390px.

## Out of scope

- Eyebrow count per screen (`/impeccable distill`).
- Help drawer copy that still describes the old palette (`/impeccable clarify`).
- Newsreader's optical-size axis.
- Measure caps beyond the About page and the Settings intro.

## Acceptance criteria

1. `--t-*` tokens are rem, and the token contract fixture is regenerated in the same commit, with the reason stated.
2. No `text-[Npx]` utility or numeric inline `fontSize` remains in `components/` or `app/`. The only exceptions are documented ones such as the Numeral role, which comes from a token.
3. `text-sm` and `text-small` compute the same size, line height and weight; likewise `text-xs` and `text-caption`.
4. The serif renders at 600 everywhere.
5. Every heading role in the map renders in the serif.
6. At a 150% browser default font size, no text in the matrix, the dashboard, settings, the edit drawer or the help drawer clips, and the hierarchy order holds.
7. The detector's `--scope type` reports 0 findings on `app` and `components`.
8. Rendered axe stays at 0 violations across the 32 audit states.
9. Every CI job command passes.

## Test stubs

- Unit: `text-sm` and `text-small` resolve to the same token values, read from the built CSS or `@theme`.
- Unit: no `text-\[[0-9.]+px\]` in `components/**/*.tsx` or `app/**/*.tsx`, as a guard test.
- e2e: at a 150% default font size (CDP `Page.setFontSizes`), the rail label, badges and `kbd` don't overflow their boxes.
- e2e: quadrant pane titles compute to the serif family at 19px.
