# Product

## Register

product

## Users

Individuals managing their own work and life, not teams running shared projects. They reach for GSD when a flat to-do list has stopped helping and they need to decide *what actually matters* before doing anything. The defining trait is a desire for control over both their priorities and their data: many choose GSD specifically because it runs locally and asks for nothing.

Context of use is varied and often quick: a desktop browser during a planning block, a phone as an installed PWA between meetings, occasionally Claude Desktop via the MCP server for natural-language task capture. The job to be done is always the same underneath: *triage by urgency and importance, then focus on the one quadrant that deserves it.*

## Product Purpose

GSD Task Manager turns the Eisenhower Matrix into a working surface. Tasks are sorted into four quadrants by two booleans (urgent, important): Do First, Schedule, Delegate, and Eliminate. Prioritization becomes a structural decision the app makes visible, not a label the user has to remember.

It is privacy-first by construction: all data lives in the browser via IndexedDB, with JSON export/import for backups and an *optional* self-hosted PocketBase sync for multi-device users. It works fully offline as a PWA. Around the core matrix sit dependencies, recurring tasks, subtasks, tags, batch operations, and a dashboard of completion and quadrant analytics.

Success looks like a user who spends less time in Q1 (reactive firefighting) and more in Q2 (strategic, important-but-not-urgent work), and who trusts the tool enough to keep their real life in it because nothing leaves their device unless they say so.

## Brand Personality

**Calm and focused.** GSD should feel like a quiet desk, not a cockpit. The interface is unhurried and low-noise; the editorial restraint of the Inkwell system (serif display against a system sans, a single indigo accent, the 1.5px hairline, cool-stone surfaces) is the personality made visible.

- **Emotional goal:** the user feels clear-headed and in control: never overwhelmed, never behind, never nagged.
- **Voice:** plain and direct. Respects the reader's attention and intelligence. Names what the product literally does. No productivity hype, no buzzwords, no exclamation-point cheerleading.
- **Tone:** encouraging without being saccharine. Completion is worth a brief celebration; everything else stays composed.

## Anti-references

GSD should explicitly NOT look or feel like:

- **A flashy AI startup:** no purple gradients, glassmorphism-by-default, gradient text, or supercharge/streamline/seamless copy. Substance over shine.
- **A gamified todo toy:** no cartoon mascots, no points/badges economy, no juvenile illustration. (One tasteful completion confetti is the deliberate exception, not a license for toy aesthetics.)
- **A dense enterprise PM tool:** not Jira/Asana. No overwhelming toolbars, deeply nested settings, or feature soup. GSD is a focused *personal* tool; complexity is a failure, not a feature.
- **A generic SaaS dashboard:** no cookie-cutter card grids, no hero-metric template (big number + small label + gradient accent), no interchangeable enterprise-app sameness.

## Design Principles

1. **The tool disappears into the task.** Calm and focused means minimal chrome and no decoration competing with content. Users come to decide and act, not to admire the UI. When in doubt, remove.

2. **Privacy is the foundation, not a feature to advertise.** Local-first by default, sync strictly opt-in, no tracking, no dark patterns. Every flow should make it obvious the user owns their data, and never pressure them out of that ownership.

3. **The matrix is the argument.** GSD exists to make the urgent/important distinction tangible. Design should reinforce prioritization (the four-quadrant color language, washes, and accents carry meaning) rather than flattening tasks back into a generic list.

4. **Earned familiarity over novelty.** Drag-and-drop, command palette, keyboard shortcuts, and standard form controls, all done well. Don't reinvent standard affordances for flavor; a focused personal tool wins on trust and muscle memory, not surprise.

5. **Delight in moments, restraint on pages.** Reserve celebration and personality for genuine moments (task completion). Keep every other surface composed. This is the line between "calm & focused" and the gamified/flashy traps above.

## Accessibility & Inclusion

WCAG 2.1 AA is the baseline, enforced by construction and review (see `coding-standards.md` Part 2 and the `a11y-reviewer` agent):

- **Contrast:** body text ≥4.5:1, large text ≥3:1. Neutral tokens carry annotated contrast ratios (e.g. `--gray-500` at 5.05:1 on paper) so muted text never drifts below the floor.
- **Motion:** every animation has a `prefers-reduced-motion: reduce` fallback (crossfade or instant). Reveals enhance already-visible content; they never gate visibility.
- **Touch:** interactive targets expand to ≥44px on coarse pointers (WCAG 2.5.5) while staying compact on mouse-driven desktops.
- **Color independence:** the four-quadrant language pairs color with labels and position, never relying on hue alone to convey quadrant or task state.
- **Dark mode:** first-class (Inkwell Pattern B: system preference with manual override), with lifted hues tuned to hold contrast on dark surfaces.
