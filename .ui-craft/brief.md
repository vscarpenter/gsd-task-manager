# Project Brief

<!-- Always-loaded by the ui-craft skill. Keep this concise — it anchors every design decision.
     Source of truth for strategic intent is PRODUCT.md at the repo root; this file is the
     working design contract distilled from it. When they disagree, PRODUCT.md wins. -->

## Design Intent

A quiet desk, not a cockpit. GSD turns the Eisenhower Matrix into a working surface: the
urgent/important split is a structural decision the app makes visible, not a label the user has
to remember. The interface is unhurried and low-noise — the user should feel clear-headed and in
control, never overwhelmed, never behind, never nagged.

The visual system is Inkwell 1.4.0 GSD Editorial: Newsreader serif display over system sans, a
warm paper canvas with quiet 1px boundaries, and restrained tide interaction ink. Four bounded
quadrant families (rust / tide / ochre / slate) make priority visible without colouring
unrelated metadata.

## Audience

Individuals managing their own work and life — not teams running shared projects. They arrive
when a flat to-do list has stopped helping and they need to decide *what actually matters* before
doing anything. The defining trait is a desire for control over both priorities and data: many
choose GSD specifically because it runs locally and asks for nothing.

Context of use is varied and often quick: a desktop browser during a planning block, a phone as
an installed PWA between meetings, occasionally Claude Desktop via the MCP server.

## Voice and Tone

Plain and direct. Respects the reader's attention and intelligence. Names what the product
literally does. No productivity hype, no buzzwords, no exclamation-point cheerleading.
Encouraging without being saccharine — completion is worth a brief celebration; everything else
stays composed.

## Principles

<!-- Numbered in conflict-resolution order. These are the override registry: a finding that
     conflicts with a principle is deferred against it, citing the number. -->

1. **The tool disappears into the task.** Minimal chrome; no decoration competing with content.
   Users come to decide and act, not to admire the UI. When in doubt, remove.
2. **Privacy is the foundation, not a feature to advertise.** Local-first by default, sync
   strictly opt-in, no tracking, no dark patterns.
3. **The matrix is the argument.** Design reinforces the urgent/important distinction in two
   confident places: the pane header and the task-card marker. Washes stay quiet and unrelated
   metadata stays neutral rather than flattening tasks back into a generic list.
4. **Earned familiarity over novelty.** Drag-and-drop, keyboard shortcuts, the command palette and
   standard form controls, all done well. Don't reinvent standard affordances for flavour.
5. **Delight in moments, restraint on pages.** Reserve celebration and personality for genuine
   moments (task completion). Every other surface stays composed.

## Anti-references

GSD must not look or feel like:

- **A flashy AI startup** — no tide/cyan gradients, glowing blobs, glassmorphism-by-default,
  gradient text, or supercharge/streamline/seamless copy. Tide is restrained interaction
  ink, never gradient decoration.
- **A gamified todo toy** — no mascots, no points/badges economy, no juvenile illustration, no
  emoji standing in for designed icons. (One completion confetti is the deliberate exception.)
- **A dense enterprise PM tool** — not Jira/Asana. Complexity is a failure, not a feature.
- **A generic SaaS dashboard** — no cookie-cutter card grids, no hero-metric template, no
  interchangeable enterprise sameness.

## Constraints

- **WCAG 2.1 AA is the floor**, enforced by construction and review: body text ≥4.5:1, large text
  ≥3:1, ≥44px touch targets on coarse pointers, `prefers-reduced-motion` fallback on every
  animation, and colour never the sole carrier of meaning.
- **Dark mode is first-class**, not an inversion — Inkwell Pattern B (system preference with
  manual override), using the independently tuned `#17150F` canvas, `#1B1812` raised surface,
  `#221E17` paper, `#F1ECE2` ink and `#6FAACB` interaction accent.
- **Offline-first PWA.** Every surface must render from IndexedDB with no network. Data surfaces
  must distinguish "loading" from "empty" — an empty state asserts something specific and must
  never be shown before the local read resolves.
- **Static export.** No SSR or API routes; all components are client components.

## Learned constraints

<!-- Corrections made on this project. Each is binding: they override skill defaults but never
     the a11y floor. Add new ones with /remember. -->

1. **Colour on the matrix means quadrant, and only quadrant.** Tag chips, status pills and other
   metadata read neutral. Tinting them with the quadrant pigment restates a fact the pane header
   and card spine already carry, and implies the tag itself says something about urgency — "home"
   and "infra" are orthogonal to the matrix. (2026-07-30, supersedes the earlier
   "tag chips in the quadrant wash" rule.)
2. **State the quadrant twice, with conviction — not five times at half volume.** The pigment's
   home is the pane header (band, icon, title, 3px rule) and the card (spine, completion disc).
   Washes are quiet ground. Redundant signalling forces every statement to be timid, which is
   what reads as generic. (2026-07-30)
3. **Quadrant titles use `--q*-ink`, not `--q*`.** Raw pigments do not all clear AA against their
   own header at 15px. The ink tokens preserve the approved exact header bands while giving every
   title a contrast-safe voice. This supersedes the earlier percentage-based header-tint ladder.
   (2026-07-31)
4. **Tide means global interaction, not decorative styling.** Use it for actions, active
   navigation, links and focus. Q2 shares tide's hex by design, but `--accent` and `--q2` stay
   separate tokens; never use tide as a decorative wash, glow, or gradient. That distinction keeps
   Editorial calm instead of reading like a flashy AI-startup theme. (2026-07-31)
