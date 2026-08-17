---
name: GSD Task Manager
description: Inkwell "GSD Editorial", a calm, focused system for an Eisenhower-matrix task manager.
colors:
  canvas-light: "#F4F1E9"
  paper-light: "#FFFFFF"
  slate-light: "#211E1A"
  raised-light: "#FBF9F3"
  accent-light: "#2C6680"
  accent-light-hover: "#234F63"
  success-light: "#3E7D52"
  success-light-ink: "#2F5F44"
  danger-light: "#B23A2E"
  danger-light-ink: "#98301F"
  warning-light: "#C78E3F"
  warning-light-ink: "#8A5A1F"
  q1-light: "#B23A2E"
  q2-light: "#2C6680"
  q3-light: "#8A6A22"
  q4-light: "#6F685F"
  q1-light-ink: "#B23A2E"
  q2-light-ink: "#2C6680"
  q3-light-ink: "#74591C"
  q4-light-ink: "#615B54"
  q1-light-wash: "#F4EBE5"
  q2-light-wash: "#E9EFF1"
  q3-light-wash: "#F2EDE1"
  q4-light-wash: "#EFEDE7"
  q1-light-header: "#F4E4E0"
  q2-light-header: "#E1ECF1"
  q3-light-header: "#F0E9D8"
  q4-light-header: "#ECE9E3"
  neutral-100-light: "#ECE7DC"
  neutral-200-light: "#E3DDD0"
  neutral-300-light: "#D8D1C1"
  neutral-500-light: "#6E6760"
  neutral-700-light: "#3A372F"
  control-border-light: "#938A7B"
  pane-border-light: "#D8D1C1"
  canvas-dark: "#17150F"
  raised-dark: "#1B1812"
  paper-dark: "#221E17"
  slate-dark: "#F1ECE2"
  accent-dark: "#6FAACB"
  accent-dark-hover: "#5A93B5"
  success-dark: "#6FB07F"
  success-dark-ink: "#9CCBA6"
  danger-dark: "#E0705F"
  danger-dark-ink: "#E8907F"
  warning-dark: "#D9A55F"
  warning-dark-ink: "#D9A55F"
  q1-dark: "#E0705F"
  q2-dark: "#6FAACB"
  q3-dark: "#CFB266"
  q4-dark: "#A9A096"
  q1-dark-ink: "#E0705F"
  q2-dark-ink: "#6FAACB"
  q3-dark-ink: "#CFB266"
  q4-dark-ink: "#A9A096"
  q1-dark-wash: "#231914"
  q2-dark-wash: "#171E1E"
  q3-dark-wash: "#201D12"
  q4-dark-wash: "#1E1B15"
  q1-dark-header: "#3A211D"
  q2-dark-header: "#173039"
  q3-dark-header: "#322B17"
  q4-dark-header: "#2A2620"
  neutral-100-dark: "#1B1812"
  neutral-200-dark: "#2A2620"
  neutral-300-dark: "#322D24"
  neutral-500-dark: "#A79F92"
  neutral-700-dark: "#C8C0B2"
  control-border-dark: "#746A5B"
typography:
  display:
    fontFamily: "ui-serif, 'New York', var(--font-newsreader), Georgia, serif"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "ui-serif, 'New York', var(--font-newsreader), Georgia, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  section:
    fontFamily: "ui-serif, 'New York', var(--font-newsreader), Georgia, serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-serif, 'New York', var(--font-newsreader), Georgia, serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.008em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 430
    lineHeight: 1.55
  small:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 430
    lineHeight: 1.5
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
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
    textColor: "#FFFFFF"
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
    backgroundColor: "{colors.danger-light}"
    textColor: "#FFFFFF"
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

Inkwell **GSD Editorial** carries that intent with a warm paper canvas, white card surfaces,
graphite ink, a serif display voice over a quiet system-sans working voice, and one restrained
tide-blue interaction color. Four bounded quadrant pigments make the matrix scannable without
turning the rest of the application into a rainbow. Color communicates hierarchy or state; it is
not decoration.

This is the same visual language the iOS/iPadOS/Mac app, gsdtaskmanager.com, and the brand kit
ship, so a user moving between devices meets one product. It was restored in August 2026 after a
short-lived web-only "Violet Frost" divergence; the structural improvements from that era (the
four-layer quadrant families, the fill/on-color token pairs, the 1px rule system, the fixed type
ramp) were kept — only the brand values changed.

This system rejects four traps: the flashy AI-startup look, the gamified todo toy, the dense
enterprise PM tool, and the generic SaaS dashboard. Tide is an interaction ink, not permission
for blue gradients, glowing blobs, gradient text, or decorative spectacle. Delight is reserved
for genuine moments such as completing a task.

**Key characteristics**

- Warm paper canvas, white cards, and a soft raised surface establish depth quietly.
- Two voices: an editorial serif (New York / Newsreader) for display, system sans for working UI.
- Tide is reserved for global interaction: actions, current selection, links, and focus.
- Four fixed quadrant families use pigment, text-safe ink, wash, and header tokens.
- Matrix identity is stated in the pane header and card marker; unrelated metadata stays neutral.
- Surfaces are restrained at rest and respond with small contrast, elevation, or motion changes.
- Light and dark modes are independently tuned and share one semantic contract.

## 2. Colors

GSD Editorial is a restrained application palette: more than 90% neutral surface and ink, one
global interaction accent, semantic status colors, and four matrix-only quadrant families.

### Light foundation

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--ivory` | `#F4F1E9` | Page background — warm paper |
| Paper | `--paper` | `#FFFFFF` | Cards, panels, fields, overlays |
| Primary ink | `--slate` | `#211E1A` | Primary text and strong boundaries |
| Raised | `--oat` | `#FBF9F3` | Secondary raised and pane surfaces |
| Interaction | `--accent` | `#2C6680` | Primary actions, active navigation, links, focus |
| Interaction hover | `--accent-d` | `#234F63` | Hover and pressed interaction state |
| Success | `--olive` | `#3E7D52` | Success and addition state |
| Success ink | `--olive-d` | `#2F5F44` | Success text on tinted chips |
| Danger pigment | `--rust` | `#B23A2E` | Danger marks, filled destructive actions |
| Danger ink | `--rust-d` | `#98301F` | Danger text on tinted chips |
| Warning pigment | `--warning` | `#C78E3F` | Warning marks and tinted surfaces |
| Warning ink | `--warning-dark` | `#8A5A1F` | Warning text |

The light neutral ramp is `#ECE7DC`, `#E3DDD0`, `#D8D1C1`, `#6E6760`, and `#3A372F`
for `--gray-100` through `--gray-700`. Muted text uses `#6E6760` or darker; it measures
5.63:1 on paper. Primary ink measures 15.87:1 on paper, and tide measures 6.33:1.
The stronger control boundary `#938A7B` measures 3.41:1. Tertiary ink `--ink-3` is
`#797368` (dark `#948A79`), matching the iOS app's `Surface.ink3`: it carries quiet
tertiary text, icons, and the dotted chart series, and body-size text on ivory steps
up to `--gray-500`.

### Light quadrant families

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#B23A2E` | `#B23A2E` | `#F4EBE5` | `#F4E4E0` |
| Q2 · Schedule | `#2C6680` | `#2C6680` | `#E9EFF1` | `#E1ECF1` |
| Q3 · Delegate | `#8A6A22` | `#74591C` | `#F2EDE1` | `#F0E9D8` |
| Q4 · Eliminate | `#6F685F` | `#615B54` | `#EFEDE7` | `#ECE9E3` |

Pigments belong on icons, rules, completion discs, and the task-card spine. Rust and tide are
dark enough to double as their own text inks (5.9:1 and 6.3:1 on white); ochre and slate use a
darkened ink — the same values gsdtaskmanager.com derived — so every ink/header pairing clears
WCAG AA. Washes are quiet ground, not another assertion of the quadrant; headers are the
stronger tint family the iOS app and landing page carry.

### Dark companion

Dark mode is designed, not inverted. Its surface stack is canvas `#17150F`, raised `#1B1812`,
paper `#221E17`, and primary ink `#F1ECE2`. Tide lifts to `#6FAACB`, with `#5A93B5` for
hover/pressed interaction. Text on a filled dark-mode accent uses dark paper ink `#17150F`,
not white.

Dark semantic colors are success `#6FB07F` with ink `#9CCBA6`, danger `#E0705F` with ink
`#E8907F`, and warning `#D9A55F` (its own text ink). The dark neutral ramp is `#1B1812`,
`#2A2620`, `#322D24`, `#A79F92`, and `#C8C0B2`; the stronger control boundary is `#746A5B`.

| Quadrant | Pigment | Ink | Wash | Header |
| --- | --- | --- | --- | --- |
| Q1 · Do First | `#E0705F` | `#E0705F` | `#231914` | `#3A211D` |
| Q2 · Schedule | `#6FAACB` | `#6FAACB` | `#171E1E` | `#173039` |
| Q3 · Delegate | `#CFB266` | `#CFB266` | `#201D12` | `#322B17` |
| Q4 · Eliminate | `#A9A096` | `#A9A096` | `#1E1B15` | `#2A2620` |

The lifted dark pigments clear AA as text on their washes and headers, so dark inks equal
their pigments.

### Named rules

**The Tide Restraint Rule.** Tide is the global interaction ink. Use it for actions, selection,
links, and focus. Q2 shares its hex by design — that is Editorial’s signature, matching the iOS
app and the landing page — but `--accent` and `--q2` remain separate tokens. Never use tide as a
decorative wash, a glow, or a gradient.

**The Quadrant Quartet Rule.** Q1 rust, Q2 tide, Q3 ochre, and Q4 slate are fixed. Never
reassign them, and never convey a quadrant by hue alone: pair pigment with title, icon, and
grid position.

**The Semantic Separation Rule.** Quadrant pigments describe priority only. Tags, sync state,
navigation, and other metadata use neutral, interaction, or status tokens according to their own
meaning. Rust doubling as danger and tide doubling as accent are shared hexes, not merged roles —
a shared hex family does not make two roles interchangeable.

## 3. Typography

**Display serif:** New York on Apple devices via `ui-serif`, with self-hosted Newsreader
(exposed as `--font-newsreader` through `next/font`) as the cross-platform stand-in. Carries
display, headlines, section heads, and card titles.

**Working sans:** The system sans stack carries body, labels, controls, and dense UI — it stays
legible at the 11–12px chip sizes the matrix leans on.

**Functional mono:** System mono, reserved for code and keyboard notation when equal-width glyphs
carry meaning — plus one editorial exception: the uppercase kicker voice (`.kicker`, 11px mono at
0.08em tracking), the sanctioned eyebrow treatment on marketing and docs surfaces. Mono never
carries body text.

This is the same two-voice pairing as the iOS app (New York titles over SF body) and
gsdtaskmanager.com (Newsreader over system sans).

### Hierarchy

- **Display:** 48px/1.1 serif, weight 500, tracking −0.02em. Reserved for the largest editorial moments.
- **H1:** 32px/1.2 serif, weight 500, tracking −0.01em.
- **H2:** 24px/1.3 serif, weight 500, tracking −0.01em.
- **H3/title:** 19px/1.22 serif, weight 500, tracking −0.008em.
- **Body:** 16px/1.55 sans, weight 430. Cap prose at 65–75ch.
- **Small:** 14px/1.5 sans, weight 430.
- **Caption:** 12px/1.4 sans, weight 500.
- **Eyebrow:** 11px/1 sans, weight 600, tracking 0.12em, uppercase and used sparingly.

**The Two-Voice Rule.** The serif carries display and headings; the sans carries working UI.
Hierarchy inside each voice comes from scale, weight, spacing, and contrast — never from
introducing a third family.

**The One-Eyebrow Rule.** A small tracked eyebrow can introduce one key section. It is a deliberate
exception, not a template label stamped above every heading.

**The One-Ramp Rule.** The eight steps above are the whole type scale. Tailwind's default size names
are permitted only where they land exactly on a step — `text-xs` = Caption, `text-sm` = Small,
`text-base` = Body, `text-2xl` = H2 — and read as spelling, not as a second scale. A spelling carries
size only, never the serif voice, since the Two-Voice Rule is wired to the ramp classes themselves;
headings must use `.text-display`/`.text-h1`/`.text-h2`/`.text-h3`, not their Tailwind-spelling
equivalents. Sizes with no step behind them are not: `text-xl` (20px) and `text-3xl` (30px) belong to
Tailwind's ramp, not this one.

Two consequences follow. Do not add a GSD-only alias for a step Inkwell already ships; `text-title`
and `text-label` were exactly that, and both had drifted off the documented values before they were
removed. And do not reach for an arbitrary `text-[Npx]` — the mechanical detector catches whole-pixel
arbitrary values, but it cannot see a fractional one or a named Tailwind step, so a new size that is
genuinely needed gets documented here first.

## 4. Elevation

GSD Editorial preserves the compact floating-pane structure. Boundaries are quiet 1px rules;
surface contrast and whitespace do most of the grouping. A light resting shadow is acceptable
where a task card needs to separate from its pane, but stronger depth is reserved for hover,
popovers, drawers, dialogs, and other state changes. Shadows are warm ink, low spread.

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
- Primary buttons use tide with white text; dark mode swaps to dark paper text on the lifted accent.
- Secondary buttons use paper, primary ink, and a control-strength boundary.
- Destructive buttons use the rust fill with white text; danger text on tints uses `--rust-d`.
- Focus uses the global tide ring; active feedback may press to `scale(0.97)`.

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
- Focus shifts to a tide boundary plus a 3px focus halo.
- Error fields use the danger family; disabled fields use the neutral sunken surface.
- Placeholder and help text never drift lighter than the muted-text contrast floor.

### Navigation

The v9 shell uses a persistent top bar and icon rail; full-page settings use a sidebar that
collapses below 1024px. Active navigation uses tide, never Q1 or another quadrant pigment.

### Signature component: the matrix

Each quadrant pane uses its exact wash, an exact header band, a 3px pigment rule, a Lucide icon,
and an ink-safe title. Each task card carries one 3px inset spine plus a completion disc in the
same quadrant pigment. The matrix is two columns on desktop and one stacked column on mobile.
Header and card markers state the quadrant with conviction; tags and general metadata remain
neutral.

## 6. Do's and Don'ts

### Do

- Use the exact GSD Editorial surface, interaction, semantic, and quadrant tokens.
- Keep the two-voice type system: editorial serif for display, system sans for working UI.
- Spend tide on global interaction and keep it to a small share of each view.
- Pair every quadrant pigment with title, icon, and position so the matrix works without color.
- Use `--q*-ink` for quadrant text and `--q*` for non-text marks.
- Keep washes quiet and state the quadrant primarily in the header and card marker.
- Honor reduced motion and 44px coarse-pointer targets.

### Don’t

- Don’t turn Editorial into a blue-gradient aesthetic. No tide/cyan gradients, glowing blobs,
  gradient text, or glassmorphism-by-default.
- Don’t use tide as a generic decorative fill, and don’t use quadrant pigments outside the matrix
  language.
- Don’t color tags or unrelated metadata with their task’s quadrant.
- Don’t use raw ochre or slate pigments for normal-size text when their ink tokens exist.
- Don’t drift toward mascots, points, badge economies, feature soup, or cookie-cutter card grids.
- Don’t extend deprecated `.matrix-card` or `.rd-*` component systems.
- Don’t introduce a third type family, and don’t let the serif leak into dense working UI.
- Don’t use fluid `clamp()` headings inside the product shell; the fixed scale is intentional.
