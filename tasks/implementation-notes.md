# Implementation notes: usability audit fixes (2026-11-20)

Tactical deviations from the 2026-11-20 spec section. None changes the approved design.

## F1

- `isImeComposing` takes the native shape (`Pick<KeyboardEvent, "isComposing" | "keyCode">`) rather than a React event. React handlers pass `event.nativeEvent`, and the drawer's window listener passes its event as is, so one helper serves both.
- Added AC4a: the drawer's `useEscapeToClose` skips a composing Escape. The combobox's early return would otherwise pass the IME's cancel Escape on to the window listener and close the drawer, which is worse than today. The same Escape already closed the drawer from every other field. The spec section now records this.
- The tag IME tests live in `tests/ui/edit-drawer.test.tsx`, not `edit-drawer-fields.test.tsx`, because `handleTagKeyDown` lives in the drawer and `TagsField` only receives it as a prop.
- The plain-key halves of AC2 to AC4 are existing tests: "normalizes typed tags and ignores duplicate tags before submit" (AC2), "adds a subtask and submits it" (AC3), the "keyboard selection" block (AC4), and "Esc closes the drawer" (AC4a).
