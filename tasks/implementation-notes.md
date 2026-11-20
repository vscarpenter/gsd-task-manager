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
