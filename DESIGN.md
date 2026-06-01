---
name: GSD Task Manager
description: Inkwell "Indigo & Cloud", a calm editorial system for an Eisenhower-matrix task manager.
colors:
  cool-stone: "#F4F4F0"
  cloud-white: "#FFFFFF"
  ink-slate: "#13141B"
  oat: "#DDDCDF"
  deep-indigo: "#3B4A8C"
  deep-indigo-pressed: "#2A3768"
  sage: "#788C5D"
  rust: "#B04A3F"
  rust-pressed: "#9A3F3F"
  amber: "#C78E3F"
  amber-ink: "#A06A2A"
  slate-blue: "#5C7CA3"
  sky: "#6A8CAF"
  gray-100: "#EDEDEA"
  gray-300: "#CFCFCC"
  gray-500: "#6F6F75"
  gray-700: "#3A3B41"
typography:
  display:
    fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.008em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 430
    lineHeight: 1.55
  label:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  xs: "4px"
  sm: "8px"
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
    backgroundColor: "{colors.deep-indigo}"
    textColor: "{colors.cloud-white}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.deep-indigo-pressed}"
  button-secondary:
    backgroundColor: "{colors.cloud-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "38px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.gray-700}"
    rounded: "{rounded.sm}"
  button-danger:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.cloud-white}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.cloud-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "38px"
  card:
    backgroundColor: "{colors.cloud-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  badge-neutral:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.gray-700}"
    rounded: "{rounded.full}"
---

# Design System: GSD Task Manager

## 1. Overview

**Creative North Star: "The Strategist's Matrix"**

GSD is built around one act: deciding what matters before doing anything. The interface should feel like a strategist's well-ordered planning surface, not a cockpit of dials. Everything is calm, deliberate, and legible at a glance; the four-quadrant Eisenhower grid is the argument the whole system makes, and the visual language exists to make that prioritization decision feel obvious rather than busy. The Inkwell "Indigo & Cloud" system carries this: a cool-stone paper ground, a single deep-indigo accent for intent, serif headings that lend authority without shouting, and a 1.5px hairline that draws structure with the lightest possible touch.

The personality is calm and focused. Surfaces are quiet (cool stone, cloud-white panels), type does the talking, and the one saturated color (deep indigo) is spent only where it means something: a primary action, the current selection, a focus ring. Color carries meaning, never decoration. The four quadrant hues (rust, indigo, sage, amber) are a fixed vocabulary, paired always with a label and a position so the matrix reads even in grayscale.

This system explicitly rejects the four traps named in PRODUCT.md: the flashy AI-startup look (purple gradients, glassmorphism, gradient text, buzzword copy); the gamified todo toy (mascots, points, badge economies); the dense enterprise PM tool (Jira/Asana toolbars and feature soup); and the generic SaaS dashboard (cookie-cutter card grids and the hero-metric template). Delight is reserved for genuine moments (completing a task) and never spread across the surface.

**Key Characteristics:**
- Cool-stone editorial ground; cloud-white panels; deep indigo as the sole accent.
- Serif headings (Georgia family) against a system-sans body: a contrast pairing, not two competing sans.
- The 1.5px hairline is the signature border; structure is drawn, not boxed in shadow.
- Four fixed quadrant hues (rust / indigo / sage / amber), always paired with label + position.
- Flat at rest; surfaces lift only in response to state. Motion is 120–300ms, ease-out, never decorative.
- First-class dark mode (Pattern B), WCAG-AA contrast by construction.

## 2. Colors

A cool, restrained palette: stone-and-cloud neutrals carrying a single deep-indigo accent, with four semantic hues that double as the Eisenhower quadrant language.

### Primary
- **Deep Indigo** (#3B4A8C): The one accent. Primary buttons, the current selection, focus rings, links, the eyebrow rule, and Q2 (Schedule) in the matrix. Pressed/hover deepens to **Deep Indigo Pressed** (#2A3768). In dark mode it lifts to a periwinkle (#7A8AD1) to hold contrast.

### Secondary
- **Sage** (#788C5D): Success, additions, and Q3 (Delegate). Paired with a 16%-tint background for success surfaces.
- **Rust** (#B04A3F): Danger, deletions, overdue state, and Q1 (Do First). Pressed deepens to #9A3F3F.
- **Amber** (#C78E3F): Warning, blocked state, and Q4 (Eliminate). Amber text darkens to **Amber Ink** (#A06A2A) for AA contrast on light surfaces.

### Tertiary
- **Slate Blue** (#5C7CA3): Informational state.
- **Sky** (#6A8CAF): Alternate info and the second data-viz series in dashboard charts.

### Neutral
- **Cool Stone** (#F4F4F0): The page ground: a barely-warm cool stone, never a cream or sand.
- **Cloud White** (#FFFFFF): Card and panel surfaces, raised one step above the stone ground.
- **Ink Slate** (#13141B): Primary text; a near-black with a slight cool undertone.
- **Oat** (#DDDCDF): Tertiary surfaces, hover thumbnails, link underlines at rest.
- **Putty Grays** (#EDEDEA / #CFCFCC / #6F6F75 / #3A3B41): The cool-putty neutral ramp. #CFCFCC is the default hairline border; #6F6F75 (gray-500) is the muted-text floor, annotated at 5.05:1 on cloud-white and 4.64:1 on cool-stone so muted text never drifts below AA.

### Named Rules
**The Quadrant Quartet Rule.** Rust = Do First, Indigo = Schedule, Sage = Delegate, Amber = Eliminate. These four assignments are fixed. Never reassign a quadrant hue, and never convey a quadrant by color alone; always pair it with its label and grid position.

**The One Accent Rule.** Deep indigo is spent only on intent: primary actions, current selection, focus, links. It is never a decorative fill or a gradient. If indigo appears somewhere that isn't an action or a state, remove it.

## 3. Typography

**Display Font:** Georgia (via `ui-serif, Georgia, "Times New Roman", Times, serif`)
**Body Font:** System UI (via `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
**Label/Mono Font:** System mono (via `ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace`)

**Character:** A serif-plus-sans contrast pairing. The serif (Georgia at weight 500) lends headings quiet authority and an editorial calm; the system sans keeps the working UI native, fast, and familiar. Mono is reserved for labels, keyboard chips, eyebrows, and code: small functional moments, never prose. No web fonts are loaded; every face is a system stack, which keeps the app instant and offline-first.

### Hierarchy
- **Display** (serif, 500, 48px, line-height 1.1, letter-spacing −0.02em): Reserved for the largest editorial moments (About page, marketing surfaces). Fixed px, never fluid clamp.
- **Headline** (serif, 500, 32px → 24px, line-height 1.2–1.3, letter-spacing −0.01em): Page and section titles (H1/H2).
- **Title** (serif, 500, 19px, line-height 1.22; or 18px sans for compact UI titles): Card and panel headings.
- **Body** (system-sans, 430, 16px, line-height 1.55): All running text and most UI copy. Cap prose at 65–75ch.
- **Label** (mono, 500, 11px, line-height 1, letter-spacing 0.12em, uppercase): Eyebrows, keyboard chips, micro-labels.

### Named Rules
**The Serif-Up Rule.** Serif climbs (display → title), sans holds the body and the working UI. Never set body copy in the serif, and never set a display heading in the sans. The contrast between the two faces is the hierarchy.

**The One Eyebrow Rule.** The mono uppercase eyebrow with its leading 24px indigo rule (`.eyebrow`) is a deliberate, named brand element used sparingly. It is the exception that proves the ban: a single signature kicker, never a tracked-uppercase label stamped above every section.

## 4. Elevation

A hybrid system that leans on borders, not shadow, for structure. The 1.5px hairline draws every panel, card, and field; shadows are warm, low-spread, and reserved almost entirely for *response to state* (hover lift, the floating action button, dialogs). At rest the interface is flat (stone ground, cloud-white panels, hairline separation), and depth appears only when something is interacted with.

### Shadow Vocabulary
- **shadow-sm** (`box-shadow: 0 1px 2px rgba(20,20,19,0.06)`): Resting card/column elevation; switch thumbs.
- **shadow-md** (`box-shadow: 0 4px 14px rgba(20,20,19,0.08)`): Dropdowns, popovers.
- **shadow-lg** (`box-shadow: 0 12px 28px rgba(20,20,19,0.12)`): Dialogs and the edit drawer.
- **shadow-card-hover** (`box-shadow: 0 10px 30px rgba(20,20,19,0.10)`): Card hover lift, paired with a small `translateY(-3px)`.

In dark mode the same roles switch to pure-black-based shadows (`rgba(0,0,0,0.45–0.55)`) since warm low-alpha shadows vanish on dark surfaces.

### Named Rules
**The Flat-at-Rest Rule.** Surfaces are flat until they respond. Shadow is the language of state (hover, focus, float, overlay), not a default decoration. If a resting element has a shadow but no interaction, it should probably be a hairline border instead.

## 5. Components

Components are **refined and restrained**: understated, hairline-bordered, with subtle hover lifts and a quiet active press. Every interactive primitive carries default / hover / focus / active / disabled states. The canonical layer is the React `components/ui/*` set composing the Inkwell `.btn` / `.input` / `.badge` / `.card` primitives; the legacy `.matrix-card` and `.rd-*` (redesign-scope) classes are deprecated and should not be extended.

### Buttons
- **Shape:** Gently rounded (8px, `rounded.sm`), 38px tall, 1.5px transparent border, mono-free 14px/500 sans label.
- **Primary:** Deep-indigo fill, cloud-white text; hover deepens to #2A3768.
- **Secondary (`subtle`):** Cloud-white fill, ink-slate text, gray-300 hairline; hover fills gray-100.
- **Ghost:** Transparent, gray-700 text; hover fills gray-100.
- **Destructive:** Rust fill, cloud-white text; hover deepens to #9A3F3F.
- **Hover / Focus / Active:** 120ms background/border transition; focus shows a 2px indigo ring with a 2px offset; active presses to `scale(0.97)`.

### Chips / Badges
- **Style:** Pill (`rounded.full`), 22px tall, 12px/500 text.
- **Variants:** Neutral (gray-100 / gray-700), Accent (indigo-tint / indigo), Success (sage-tint / sage), Warning (amber-tint / amber-ink), Danger (rust fill / cloud-white). Tinted variants use a ~14–16% tint of the hue's own color, never gray text on a colored ground.

### Cards / Containers
- **Corner Style:** 14px (`rounded.lg`); stat cards use 12px (`rounded.md`).
- **Background:** Cloud-white on the cool-stone ground.
- **Shadow Strategy:** Flat at rest (hairline border only); link cards lift `translateY(-3px)` with `shadow-card-hover` and an ink-slate border on hover.
- **Border:** The 1.5px gray-300 hairline. This is the signature; it replaces shadow as the default separator.
- **Internal Padding:** 24px (`spacing.lg`) for cards, 20–22px for stat cards.

### Inputs / Fields
- **Style:** Cloud-white fill, 1.5px gray-300 hairline, 8px radius, 38px tall, 14px sans. Placeholder uses gray-500 (AA-compliant, never lighter).
- **Focus:** Border shifts to deep indigo with a 3px indigo focus halo (`0 0 0 3px` of `accent-focus-ring`).
- **Error / Disabled:** Error shifts border + halo to rust; disabled fills gray-100 with gray-500 text and `not-allowed` cursor.
- **Field group:** Label (13px/500 ink-slate), control, then help (12px gray-500) or error (12px/500 rust), stacked with 6px gaps.

### Navigation
- **Style:** A persistent top bar plus an icon rail in the v9 single-matrix shell; full-page settings use a sidebar that collapses below 1024px. Active state is carried by the indigo accent; hover by a gray-100 fill. Touch targets expand to ≥44px on coarse pointers.

### Signature Component: The Eisenhower Matrix Grid
The four-quadrant grid is the product's defining surface. Each quadrant pane carries a ~17–22% color-mix wash of its quadrant hue over cloud-white (rust / indigo / sage / amber), a 3px top accent bar, and a header tinted ~10–14%. In dark mode the washes switch from `mix-with-paper` to `mix-with-transparent` so they read on the dark ground. The grid is two columns on desktop, single-column stacked on mobile.

## 6. Do's and Don'ts

### Do:
- **Do** use the 1.5px hairline (`#CFCFCC`) as the default border. It is the brand; structure is drawn, not shadowed.
- **Do** reserve the serif (Georgia) for display and headings and the system sans for body and working UI: the contrast pairing is the hierarchy.
- **Do** spend deep indigo only on intent: primary actions, current selection, focus rings, links. Keep it on ≤10% of any screen.
- **Do** pair every quadrant hue with its label and grid position, so the matrix reads in grayscale and for color-blind users.
- **Do** keep surfaces flat at rest and lift them only on interaction (hover `translateY(-3px)`, focus halo, dialog shadow).
- **Do** honor `prefers-reduced-motion` with an instant/crossfade fallback on every animation, and keep touch targets ≥44px on coarse pointers.
- **Do** hold muted text at gray-500 (#6F6F75) or darker (the AA floor), never a lighter "elegant" gray.

### Don't:
- **Don't** ship the flashy AI-startup look: no purple gradients, no glassmorphism as default, no `background-clip: text` gradient text, no buzzword copy (supercharge / streamline / seamless).
- **Don't** drift toward a gamified todo toy: no mascots, no points or badge economies, no juvenile illustration. One tasteful completion confetti is the deliberate exception, not a license.
- **Don't** build a dense enterprise PM tool: no overwhelming toolbars, no deeply nested settings, no feature soup. GSD is a focused personal tool.
- **Don't** fall into the generic SaaS dashboard: no cookie-cutter card grids, no hero-metric template (big number + small label + gradient accent).
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe. The legacy `.stat-card.warn` (`border-left: 4px`) and `.overdue-task` left-border are anti-patterns to migrate, not to copy. Use a full hairline, a background tint, or a leading icon instead.
- **Don't** extend the deprecated `.matrix-card` or `.rd-*` (redesign-scope) class systems. Build on `components/ui/*` and the Inkwell primitives.
- **Don't** introduce a web font or a third type family. Three system stacks (serif / sans / mono) carry everything; more reads as indecision.
- **Don't** set fluid `clamp()` headings in product UI. The type scale is fixed px on purpose; a heading that shrinks in a sidebar looks worse, not better.
