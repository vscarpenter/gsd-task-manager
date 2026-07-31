# Design Decisions

<!-- Lazy-loaded — loaded only when a task requires prior rationale or decision reference.
     Append-only log. Never delete entries; mark superseded ones with a note.
     Format: ### YYYY-MM-DD — {title} followed by **Status**: accepted | rejected | tried -->

### 2026-01-01 — Example decision entry

**Status**: accepted

We chose X over Y because Z. The key constraint was [constraint]. Alternatives considered:
- Option A — rejected because [reason]
- Option B — tried but caused [issue]

### 2026-07-30 — Matrix reskin: state the quadrant twice, not five times

**Status**: accepted

The matrix read "dated/generic" despite a mature token system. The cause was not
missing design but **redundant signaling**: each quadrant asserted its identity
five ways at once (pane wash, 3px top rule, tinted header band, header text
color, card spine) plus quadrant-tinted tag chips. Five simultaneous statements
force each one to be quiet, and uniformly quiet color is what reads as generic.

Kept at full strength (the pigment's real home): pane header, 3px rule, card
spine, completion disc. Demoted:

- **Pane washes → ~45% of former strength.** A half-empty quadrant used to be a
  large flat field of pigment; four such fields around white cards read as a
  kanban board, not a matrix. Washes stay because PRODUCT.md names them as
  carrying meaning — this tunes the tint, it does not remove the language.
- **Tag chips → neutral.** Reverses the earlier tested rule ("tag chips in the
  quadrant wash + accent, not neutral gray", tests/ui/task-card-anatomy.test.tsx).
  Tags are orthogonal to the matrix: "home" and "infra" say nothing about
  urgency, so tinting them implied a meaning they don't carry. Color on this
  surface now means quadrant, and only quadrant.
- **Dark-mode washes** additionally sat *lighter* than `--paper`, so cards
  appeared recessed into their own pane. Now page < pane < card.

Alternatives considered:
- Remove washes entirely (Linear/Things-style neutral panes) — rejected:
  PRODUCT.md principle 3 names the washes as part of "the matrix is the
  argument". Out of bounds for a reskin without being asked.
- Drop the card spine instead of softening washes — rejected: the spine is the
  only quadrant cue that survives drag, search results, and dense panes.

Also replaced the smart-view strip's nine emoji with the Lucide set already used
app-wide (PRODUCT.md anti-reference: "a gamified todo toy"). Built-in views are
computed at read time, never persisted, so `icon` values changed from glyphs to
registry keys with no migration; custom views with legacy glyphs still render.

<!-- Add new decisions above this comment, newest first. -->
