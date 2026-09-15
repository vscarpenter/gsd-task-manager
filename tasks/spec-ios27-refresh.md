# Spec: iOS 27 refresh follow-on (web)

Date: 2026-09-15. Branch: `feat/ios27-refresh`. Source brief:
`design_handoff_ios27_refresh/gsd-taskmanager.md`. Design approved in chat on 2026-09-15.

## Goal

Give the web the two interaction patterns iOS 27 adds, without adopting its material:
quieter chrome on scroll, and one swipe vocabulary on touch. Land zero Inkwell token
changes, and make that rule mechanical.

## Inputs and outputs

### 1. Topbar hides on scroll (compact widths only)

- Input: window scroll on the matrix page at viewport widths below 768px.
- Output: the topbar translates off the top edge on scroll-down past a small threshold
  and returns on any scroll-up or when the page is back at the top. The nav rail,
  capture dock, and every desktop layout stay exactly as they are.
- Surface: `SimplifiedTopbar` gains a `hidden` prop and a `data-chrome-hidden`
  attribute. `AppShell` gains a `quietChromeOnScroll` opt-in; only the matrix sets it.
- Logic: `lib/use-scroll-chrome.ts` exports a pure `resolveChromeHidden` decision plus
  the `useScrollChrome` hook (passive listener, rAF-throttled, media-query gated).

### 2. Swipe actions on touch (matrix cards)

- Input: a touch pointer dragging horizontally on a task card body.
- Output, matching `gsd-iosapp/App/Matrix/QuadrantCell.swift`:
  - Leading swipe (rightward): Complete, or Uncomplete on a done card. Olive
    `--status-success` ground, `--paper` ink. A full swipe past half the card width
    commits without a tap.
  - Trailing swipe (leftward): Snooze one hour on slate `--q4`, then Delete on rust
    `--rust`, both `--paper` ink. Tap only, no full-swipe commit.
- Gesture rules: `pointerType === "touch"` only; `touch-action: pan-y` on the card;
  12px directional lock; 84px per button; snap open at 60 percent of the reveal
  width; one open row at a time; tapping an open card closes it. Sizes live in
  `SWIPE_CONFIG` in `lib/constants.ts`.
- Handlers: Complete reuses `onToggleComplete` (confetti plus Undo). Delete reuses
  `onDelete` (faithful Undo toast). Snooze is a new `handleSnooze` in the matrix that
  calls `snoozeTask(id, 60)` and toasts "Snoozed for 1 hour"; errors go through
  `reportTaskMutationError`.
- Plumbing: `onSnooze` flows `MatrixSimplified` to `MatrixGrid` to `QuadrantPane` to
  `TaskCard`. `TaskCardActions` stops forwarding `onSnooze` to the desktop hover
  cluster (the brief forbids hover-device changes) and adds "Snooze 1 hour" to the
  mobile overflow menu as the non-gesture route.
- Visible result: the card footer shows a "Snoozed · 1h" chip while `isTaskSnoozed`.

### 3. Token contract guard

- `tests/data/inkwell-token-contract.test.ts` extracts every `--name: value` pair from
  `app/css/inkwell-tokens.css` and the `--q1` to `--q4` families in `app/globals.css`,
  for the light block and both dark blocks, and compares them to
  `tests/fixtures/inkwell-token-contract.json`.
- A mismatch fails with a message that names the three-repo paired-change rule and
  the `UPDATE_INKWELL_TOKEN_CONTRACT=1` flag that rewrites the fixture.

## Constraints

- No token values change. The guard test is the proof.
- No hover-device changes. Mouse and pen pointers never start a swipe; the desktop
  action cluster is untouched.
- No new dependencies.
- Reduced motion: the global `prefers-reduced-motion: reduce` reset zeroes every
  transition, so the topbar and the swipe snap are instant under that preference.
- WCAG AA on every strip pairing. Contrast is computed in the test suite for all six
  light and dark pairs.
- Code shape ratchet (`bun run quality:shape`): no new complexity, depth, or length
  violations.

## Edge cases

- Vertical-dominant drags release to native scroll; short taps still reach the card.
- A drag that starts on the grip goes to dnd-kit, not the swipe (listeners live on the
  grip only, so no change is needed; the unit test pins it).
- Opening a second row closes the first.
- A completed card's leading action reads "Uncomplete".
- The topbar never hides while at the top, and never hides at 768px or wider.
- Swiping Complete on a recurring task spawns the next instance exactly as the disc
  does, because both go through `handleToggle`.

## Out of scope

- Backup envelope, wire schema, capture parser, field limits, feedback payload.
- Any visual redesign, nav rail motion, desktop chrome changes, dashboard swipes.
- PRODUCT.md prose, ADRs.

## Acceptance criteria

1. On a 390px viewport, scrolling the matrix down past the threshold hides the topbar;
   scrolling up restores it. On a 1280px viewport the topbar never moves.
2. On a touch pointer, a rightward swipe reveals Complete; a full swipe completes the
   task with the same Undo toast the disc offers.
3. A leftward swipe reveals Snooze then Delete in that order; tapping Snooze sets
   `snoozedUntil` one hour out and shows the chip; tapping Delete removes the card with
   the Undo toast.
4. A mouse drag of the same shape does nothing.
5. The mobile overflow menu offers "Snooze 1 hour"; the desktop hover cluster is
   unchanged.
6. The token guard passes on this branch and fails when any pinned value changes.
7. `bun run test`, `bun typecheck`, `bun lint`, `bun run build`, `bun run
   quality:shape`, and the touched e2e specs on Chromium, Firefox, and WebKit are green.

## Test stubs

- `tests/data/scroll-chrome.test.ts`: `resolveChromeHidden` decision table.
- `tests/ui/app-shell.test.tsx`: topbar toggles `data-chrome-hidden` on scroll when the
  compact query matches; stays visible when it does not; inert without the opt-in.
- `tests/data/swipe-gesture.test.ts`: `lockDirection`, `clampSwipeOffset`,
  `resolveSwipeEnd`.
- `tests/ui/task-card-swipe.test.tsx`: touch swipe right opens Complete; full swipe
  calls `onToggleComplete`; swipe left opens Snooze then Delete; mouse is ignored;
  one row open at a time.
- `tests/ui/task-card-subcomponents.test.tsx`: mobile menu shows "Snooze 1 hour";
  desktop cluster has no snooze; snoozed chip renders.
- `tests/ui/matrix-simplified.test.tsx`: `handleSnooze` calls `snoozeTask(id, 60)` and
  toasts; failure reports through the error path.
- `tests/data/inkwell-token-contract.test.ts`: snapshot match; strip contrast table.
- `tests/e2e/quiet-chrome.spec.ts` and `tests/e2e/swipe-actions.spec.ts`.
