# Implementation notes — 2026-09-15 iOS 27 refresh follow-on (web)

Tactical deviations and findings while executing `tasks/spec-ios27-refresh.md`.
Distill into `tasks/lessons.md` and delete this file before the session ends.

## Deviations from the approved design

- The scroll hook lives in `SimplifiedTopbar` behind a `quietOnScroll` prop instead of
  in `AppShell`. The shell only passes the flag through. Reason: the code-shape
  ratchet caps `AppShell` at 115 lines and the topbar at 53, and the hook call plus
  prop plumbing pushed both over. Behavior is unchanged; the matrix still opts in.
- Swipe is a wrapper (`SwipeableTaskCard`) the quadrant pane renders, not a prop on
  `TaskCard`. Reason: `TaskCard` is pinned at 110 lines by the ratchet and the
  archive page renders the plain card with no-op handlers, so a wrapper is both
  cheaper and safer.

## Findings

- A `setState` updater that reads a mutable local reassigned after the call is a
  latent bug: React runs the updater eagerly when the queue is empty and lazily at
  render time otherwise. The scroll sampler's first sample worked and the second
  read a zero delta. Snapshot the value before the updater.
- The code-shape ratchet (`bun run quality:shape`) rejects any per-file increase in
  violation count or maximum, so a one-line prop added to a function already over 40
  lines fails CI. Plan new plumbing as module-level helpers or wrapper components.
- Paper ink clears AA on every swipe ground in both themes: 4.93, 5.50, 5.94 light;
  6.47, 6.44, 5.25 dark (olive, slate, rust).
