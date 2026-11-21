# Implementation notes: usability audit fixes (2026-11-20)

Tactical deviations from the 2026-11-20 spec section. None changes the approved design.

## F1

- `isImeComposing` takes the native shape (`Pick<KeyboardEvent, "isComposing" | "keyCode">`) rather than a React event. React handlers pass `event.nativeEvent`, and the drawer's window listener passes its event as is, so one helper serves both.
- Added AC4a: the drawer's `useEscapeToClose` skips a composing Escape. The combobox's early return would otherwise pass the IME's cancel Escape on to the window listener and close the drawer, which is worse than today. The same Escape already closed the drawer from every other field. The spec section now records this.
- The tag IME tests live in `tests/ui/edit-drawer.test.tsx`, not `edit-drawer-fields.test.tsx`, because `handleTagKeyDown` lives in the drawer and `TagsField` only receives it as a prop.
- The plain-key halves of AC2 to AC4 are existing tests: "normalizes typed tags and ignores duplicate tags before submit" (AC2), "adds a subtask and submits it" (AC3), the "keyboard selection" block (AC4), and "Esc closes the drawer" (AC4a).

## F2 and F3

- One commit for both. They're coupled: F2's wrap makes the briefing taller, which shrinks the pinned stage F3 protects, and the shared layout-fit helpers can't be split across two commits without hand-made patches.
- The wrapped layout differs from the spec's prediction. Below about 1000px of content width, the date and the sentence share line 1 and the Schedule button takes line 2, under the date. The ACs only bound the sentence's width and overlap, so this is in contract.
- The stage already had `data-testid="matrix-stage"`, so F4 targets that instead of adding a `data-matrix-stage` attribute.
- Measured on the rebuilt export: the sentence is 206px at 768x640 (was 0) and 446px at 1280x720 with 24px text (was 125). 768x640 and 900x660 scroll the page. The pinned stage is 180px at 1024x640, 260 at 1280x720, and 446 at 768x1024.

## F4

- The focus checks run under reduced motion, so each focus scroll lands at once and the checks need no timing waits. The margins don't depend on motion.
- AC11 (phone About and Review) and AC13 (small pinned stage) pass before the fix too, so they are guards rather than reproductions. Chromium scrolls a focused control only when it's out of view, so a stop is left under the rail only when it's already on screen there, and that didn't happen in 60 presses. AC13 also pins the stage exemption directly, because in a 180px stage a margin cuts cards off rather than hiding them.
- The chrome needs no explicit zero: the rule covers only `main` and the footer right after it, and the topbar, rails, and overlays sit outside both. Only the phone dock (inside `main`) and the pinned stage get explicit exemptions.
- The 200% text test reloads before tabbing. Without that, the app's scroll to the last new card landed after the reset to the top, and the first stop read as hidden (top -456).

## Review follow-ups

- The a11y review flagged that the F1 guards returned before `preventDefault`, so an Enter reported as keyCode 229 (some Android keyboards) skipped it and could submit the drawer's form. The guide's pattern swallows Enter first and checks composition under each key gate. Fixed with tests: Enter is always canceled, a composing comma isn't, and a 229 Backspace still removes the last tag. Real-engine IME check (CDP `Input.imeSetComposition`) re-run on the rebuilt export.
- The review's claim that the edit drawer sits inside `main` didn't hold: the DOM has one `main`, the dialog is outside it, and its fields compute 0px margins.
- Known trade-off, not changed: `scroll-margin` applies at every scroll container above a control, so inner scrollers in `main` (unpinned quadrant pane bodies, the archive and sync-history lists) also leave up to 8rem above a control reached by Shift+Tab. Nothing is hidden (the focus checks pass at 1280x600 and 768x640), and exempting those scrollers would also drop the margin the page scroll needs. Page-level `scroll-padding` avoids this but moved the `/` landing.
- AC14 raced the matrix's scroll to the newest card in the full suite (scrollY 793, not 600). `loadMatrixWithTasks` now reloads after seeding.
