---
name: GSD Task Manager
description: Inkwell "Violet Frost", a calm, focused system for an Eisenhower-matrix task manager.
colors:
  canvas-light: "#F3F3F7"
  paper-light: "#FDFDFF"
  slate-light: "#242331"
  raised-light: "#F7F7FA"
  accent-light: "#5C4F7D"
  accent-light-hover: "#4E426B"
  success-light: "#4F7B5F"
  success-light-ink: "#3B644A"
  danger-light: "#B95F5A"
  danger-light-ink: "#873F3C"
  warning-light: "#A17D37"
  warning-light-ink: "#71551F"
  q1-light: "#B95F5A"
  q2-light: "#4D7A72"
  q3-light: "#A17D37"
  q4-light: "#7A7D8E"
  q1-light-ink: "#873F3C"
  q2-light-ink: "#315B54"
  q3-light-ink: "#71551F"
  q4-light-ink: "#56596B"
  q1-light-wash: "#FBF5F4"
  q2-light-wash: "#F2F8F6"
  q3-light-wash: "#FAF7EF"
  q4-light-wash: "#F5F5F8"
  q1-light-header: "#F2DEDC"
  q2-light-header: "#DDEBE7"
  q3-light-header: "#F0E6CF"
  q4-light-header: "#E6E6ED"
  neutral-100-light: "#ECECF2"
  neutral-200-light: "#E2E1EA"
  neutral-300-light: "#D9D9E4"
  neutral-500-light: "#646477"
  neutral-700-light: "#3F3E50"
  control-border-light: "#8D8C9D"
  pane-border-light: "#D6D5E0"
  canvas-dark: "#14131B"
  raised-dark: "#191821"
  paper-dark: "#211F2B"
  slate-dark: "#ECEAF2"
  accent-dark: "#A99BCB"
  accent-dark-hover: "#BBAFDA"
  success-dark: "#82B793"
  success-dark-ink: "#A0C9AB"
  danger-dark: "#D88C86"
  danger-dark-ink: "#E7A7A3"
  warning-dark: "#D0AF68"
  warning-dark-ink: "#E0C485"
  q1-dark: "#D88C86"
  q2-dark: "#83B2A8"
  q3-dark: "#D0AF68"
  q4-dark: "#A5A7B8"
  q1-dark-ink: "#E7A7A3"
  q2-dark-ink: "#A6CEC6"
  q3-dark-ink: "#E0C485"
  q4-dark-ink: "#C3C4D0"
  q1-dark-wash: "#1C181E"
  q2-dark-wash: "#171E1D"
  q3-dark-wash: "#1E1B17"
  q4-dark-wash: "#1B1B22"
  q1-dark-header: "#352327"
  q2-dark-header: "#253632"
  q3-dark-header: "#352E20"
  q4-dark-header: "#2C2C37"
  neutral-100-dark: "#292734"
  neutral-200-dark: "#302E3B"
  neutral-300-dark: "#393645"
  neutral-500-dark: "#AAA6B8"
  neutral-700-dark: "#D0CDD9"
  control-border-dark: "#6F6B80"
typography:
  display:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  section:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.008em"
  body:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 430
    lineHeight: 1.55
  small:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 430
    lineHeight: 1.5
  caption:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "var(--font-albert), system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  xs: "4px"
  icon: "8px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "20px"
  full: "999px"
spacing:
  micro: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.accent-light-hover}"
  button-secondary:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.slate-light}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "38px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.slate-light}"
    rounded: "{rounded.sm}"
  button-danger:
    backgroundColor: "{colors.danger-light-ink}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.slate-light}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "38px"
  card:
    backgroundColor: "{colors.paper-light}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  pane:
    backgroundColor: "{colors.raised-light}"
    rounded: "{rounded.lg}"
---

# Design System: GSD Task Manager

## 1. Overview

**Creative North Star: “The Strategist’s Matrix”**

GSD is built around one act: deciding what matters before doing anything. The interface should
feel like a strategist’s well-ordered planning surface, not a cockpit of dials. Everything is
calm, deliberate, and legible at a glance. The four-quadrant Eisenhower grid is the argument the
whole system makes, and the visual language exists to make prioritization obvious without making
the product busy.

Inkwell **Violet Frost** carries that intent with a lavender-gray canvas, pale paper surfaces,
Albert Sans, quiet 1px boundaries, and one restrained aubergine interaction color. Four bounded
quadrant pigments make the matrix scannable without turning the rest of the application into a
rainbow. Color communicates hierarchy or state; it is not decoration.

This system rejects four traps: the flashy AI-startup look, the gamified todo toy, the dense
enterprise PM tool, and the generic SaaS dashboard. Violet Frost’s aubergine is an interaction
ink, not permission for purple gradients, glowing violet blobs, gradient text, or decorative
spectacle. Delight is reserved for genuine moments such as completing a task.

**Key characteristics**

- Lavender-gray canvas, near-white paper, and a subtle raised surface establish depth quietly.
- Albert Sans carries display, body, labels, and controls as one coherent family.
- Aubergine is reserved for global interaction: actions, current selection, links, and focus.
- Four fixed quadrant families use pigment, darker/lighter ink, wash, and header tokens.
- Matrix identity is stated in the pane header and card marker; unrelated metadata stays neutral.
- Surfaces are restrained at rest and respond with small contrast, elevation, or motion changes.
- Light and dark modes are independently tuned and share one semantic contract.

## 2. Colors

Violet Frost is a restrained application palette: more than 90% neutral surface and ink, one
global interaction accent, semantic status colors, and four matrix-only quadrant families.

### Light foundation

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--ivory` | `#F3F3F7` | Page background |
| Paper | `--paper` | `#FDFDFF` | Cards, panels, fields, overlays |
| Primary ink | `--slate` | `#242331` | Primary text and strong boundaries |
| Raised | `--oat` | `#F7F7FA` | Secondary raised and pane surfaces |
| Interaction | `--accent` | `#5C4F7D` | Primary actions, active navigation, links, focus |
| Interaction hover | `--accent-d` | `#4E426B` | Hover and pressed interaction state |
| Success | `--olive` | `#4F7B5F` | Success and addition state |
| Danger pigment | `--rust` | `#B95F5A` | Danger marks and tinted surfaces |
| Danger ink | `--rust-d` | `#873F3C` | Danger text and solid destructive actions |
| Warning pigment | `--warning` | `#A17D37` | Warning marks and tinted surfaces |
| Warning ink | `--warning-dark` | `#71551F` | Warning text |

The light neutral ramp is `#ECECF2`, `#E2E1EA`, `#D9D9E4`, `#646477`, and `#3F3E50`
for `--gray-100` through `--gray-700`. Muted text uses `#646477` or darker; it measures
5.69:1 on paper. Primary ink measures 15.20:1 on paper, and aubergine measures 7.20:1.

### Light quadrant families

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#B95F5A` | `#873F3C` | `#FBF5F4` | `#F2DEDC` |
| Q2 · Schedule | `#4D7A72` | `#315B54` | `#F2F8F6` | `#DDEBE7` |
| Q3 · Delegate | `#A17D37` | `#71551F` | `#FAF7EF` | `#F0E6CF` |
| Q4 · Eliminate | `#7A7D8E` | `#56596B` | `#F5F5F8` | `#E6E6ED` |

Pigments belong on icons, rules, completion discs, and the task-card spine. Quadrant titles use
the ink token, never the raw pigment; every ink/header pairing clears WCAG AA. Washes are quiet
ground, not another assertion of the quadrant.

### Dark companion

Dark mode is designed, not inverted. Its surface stack is canvas `#14131B`, raised `#191821`,
paper `#211F2B`, and primary ink `#ECEAF2`. Aubergine lifts to `#A99BCB`, with `#BBAFDA`
for hover/pressed interaction. Text on a filled dark-mode accent uses dark paper ink, not white.

Dark semantic colors are success `#82B793` with ink `#A0C9AB`, danger `#D88C86` with ink
`#E7A7A3`, warning `#D0AF68` with ink `#E0C485`, and alternate information/slate
`#A5A7B8`. The dark neutral ramp is `#292734`, `#302E3B`, `#393645`, `#AAA6B8`, and
`#D0CDD9`; the stronger control boundary is `#6F6B80`.

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#D88C86` | `#E7A7A3` | `#1C181E` | `#352327` |
| Q2 · Schedule | `#83B2A8` | `#A6CEC6` | `#171E1D` | `#253632` |
| Q3 · Delegate | `#D0AF68` | `#E0C485` | `#1E1B17` | `#352E20` |
| Q4 · Eliminate | `#A5A7B8` | `#C3C4D0` | `#1B1B22` | `#2C2C37` |

### Named rules

**The Aubergine Restraint Rule.** Aubergine is the global interaction ink. Use it for actions,
selection, links, and focus. Never use it as Q2, a decorative wash, a glow, or a gradient.

**The Quadrant Quartet Rule.** Q1 muted rose, Q2 juniper, Q3 ochre, and Q4 smoke slate are fixed.
Never reassign them, and never convey a quadrant by hue alone: pair pigment with title, icon, and
grid position.

**The Semantic Separation Rule.** Quadrant pigments describe priority only. Tags, sync state,
navigation, and other metadata use neutral, interaction, or status tokens according to their own
meaning. A shared hex family does not make two roles interchangeable.

## 3. Typography

**Display and body font:** Albert Sans, loaded through `next/font` and exposed as
`--font-albert`, with the system sans stack as fallback.

**Functional mono:** System mono, reserved for code and keyboard notation when equal-width glyphs
carry meaning.

Albert Sans is the product’s single visual voice. Its open forms keep the working interface clear,
while medium weights and tight display tracking give headings authority without introducing a
second family. Compatibility tokens named `--serif` and `font-serif` intentionally resolve to
Albert Sans; they are not permission to reintroduce an editorial typeface.

### Hierarchy

- **Display:** 48px/1.1, weight 500, tracking −0.02em. Reserved for the largest editorial moments.
- **H1:** 32px/1.2, weight 500, tracking −0.01em.
- **H2:** 24px/1.3, weight 500, tracking −0.01em.
- **H3/title:** 19px/1.22, weight 500, tracking −0.008em.
- **Body:** 16px/1.55, weight 430. Cap prose at 65–75ch.
- **Small:** 14px/1.5, weight 430.
- **Caption:** 12px/1.4, weight 500.
- **Eyebrow:** 11px/1, weight 600, tracking 0.12em, uppercase and used sparingly.

**The One-Family Rule.** Albert Sans carries display and working UI. Hierarchy comes from scale,
weight, spacing, and contrast, not from switching families.

**The One-Eyebrow Rule.** A small tracked eyebrow can introduce one key section. It is a deliberate
exception, not a template label stamped above every heading.

**The One-Ramp Rule.** The eight steps above are the whole type scale. Tailwind's default size names
are permitted only where they land exactly on a step — `text-xs` = Caption, `text-sm` = Small,
`text-base` = Body, `text-2xl` = H2 — and read as spelling, not as a second scale. Sizes with no step
behind them are not: `text-xl` (20px) and `text-3xl` (30px) belong to Tailwind's ramp, not this one.

Two consequences follow. Do not add a GSD-only alias for a step Inkwell already ships; `text-title`
and `text-label` were exactly that, and both had drifted off the documented values before they were
removed. And do not reach for an arbitrary `text-[Npx]` — the mechanical detector catches whole-pixel
arbitrary values, but it cannot see a fractional one or a named Tailwind step, so a new size that is
genuinely needed gets documented here first.

## 4. Elevation

Violet Frost preserves the compact floating-pane structure. Boundaries are quiet 1px rules;
surface contrast and whitespace do most of the grouping. A light resting shadow is acceptable
where a task card needs to separate from its pane, but stronger depth is reserved for hover,
popovers, drawers, dialogs, and other state changes.

### Shape vocabulary

- Icon buttons: 8px.
- Inputs and buttons: 10px.
- Task and stat cards: 12px.
- Quadrant panes and large panels: 14px.
- Expressive overlays: 20px.
- Pills: fully rounded.

### Motion vocabulary

- Fast feedback: 120ms.
- Standard UI transition: 150ms.
- Large or one-time transition: 300ms.
- Use ease-out; avoid bounce and ornamental motion.
- Exit faster than entrance, and honor `prefers-reduced-motion` with an instant or crossfade path.

## 5. Components

Components are refined and restrained. Every interactive primitive carries default, hover, focus,
active, and disabled states. The canonical layer is `components/ui/*` composing the Inkwell
primitives; deprecated `.matrix-card` and `.rd-*` systems must not be extended.

### Buttons

- Controls are 38px tall on pointer devices and expand to at least 44px on coarse pointers.
- Primary buttons use aubergine; dark mode swaps to dark paper text on the lifted accent.
- Secondary buttons use paper, primary ink, and a control-strength boundary.
- Destructive buttons use the contrast-safe danger ink/fill, not the lighter Q1 pigment as text.
- Focus uses the global aubergine ring; active feedback may press to `scale(0.97)`.

### Chips and badges

- Default height is 22px with a 12px/500 label.
- Tags and ordinary metadata stay neutral.
- Status badges use complete semantic background/ink/border triples.
- Quadrant color never decorates a tag simply because its task sits in that quadrant.

### Cards and containers

- Cards use paper on the canvas or on a quadrant wash; panes use the raised/wash layer.
- Default card radius is 12px; pane radius is 14px.
- Quiet borders and low resting elevation preserve hierarchy without boxing in every section.
- Standard internal card padding is 24px; denser stat cards may use 20–22px.

### Inputs and fields

- Inputs use paper, primary ink, a 10px radius, 38px desktop height, and a 1px boundary.
- Focus shifts to an aubergine boundary plus a 3px focus halo.
- Error fields use the danger family; disabled fields use the neutral sunken surface.
- Placeholder and help text never drift lighter than the muted-text contrast floor.

### Navigation

The v9 shell uses a persistent top bar and icon rail; full-page settings use a sidebar that
collapses below 1024px. Active navigation uses aubergine, never Q1 or another quadrant pigment.

### Signature component: the matrix

Each quadrant pane uses its exact wash, an exact header band, a 3px pigment rule, a Lucide icon,
and an ink-safe title. Each task card carries one 3px inset spine plus a completion disc in the
same quadrant pigment. The matrix is two columns on desktop and one stacked column on mobile.
Header and card markers state the quadrant with conviction; tags and general metadata remain
neutral.

## 6. Do's and Don'ts

### Do

- Use the exact Violet Frost surface, interaction, semantic, and quadrant tokens.
- Keep Albert Sans as the only visual type family across display and working UI.
- Spend aubergine on global interaction and keep it to a small share of each view.
- Pair every quadrant pigment with title, icon, and position so the matrix works without color.
- Use `--q*-ink` for quadrant text and `--q*` for non-text marks.
- Keep washes quiet and state the quadrant primarily in the header and card marker.
- Honor reduced motion and 44px coarse-pointer targets.

### Don’t

- Don’t turn Violet Frost into a purple-gradient aesthetic. No violet/cyan gradients, glowing
  blobs, gradient text, or glassmorphism-by-default.
- Don’t use aubergine as Q2 or a generic decorative fill.
- Don’t color tags or unrelated metadata with their task’s quadrant.
- Don’t use raw quadrant pigments for normal-size text when an ink token exists.
- Don’t drift toward mascots, points, badge economies, feature soup, or cookie-cutter card grids.
- Don’t extend deprecated `.matrix-card` or `.rd-*` component systems.
- Don’t introduce another display or body font; the single-family Albert Sans system is deliberate.
- Don’t use fluid `clamp()` headings inside the product shell; the fixed scale is intentional.
