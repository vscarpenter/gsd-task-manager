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

## Review round two (adversary, 2026-11-20)

- F2 regression, fixed: `basis-48` without a prefix set the sentence's height in the phone column (192px for 42px of text). Now `sm:basis-48`, pinned by a 390px e2e check (AC7a). The unit test asserted class substrings, and `"sm:basis-48"` contains `"basis-48"`, so it couldn't fail; it now uses `toHaveClass` tokens.
- F4 regression, fixed: closing a menu or the drawer jumped the page (Chromium 43 to 116px, Firefox recentered by up to 370px). Two changes. The top margin is the topbar's measured height plus 0.5rem (`--topbar-height` from `topbar.tsx:usePublishedHeight`), and focus returns through the existing `restoreFocusOrMainContent`, which uses `preventScroll`. I first wrote a new `lib/return-focus.ts`, then found the existing helper in the lib README and moved mine to the scratchpad. One side effect: `useDialogFocus` now falls back to `#main-content` when the opener is gone, as the help drawer and detail sheet already do.
- F4 gap, fixed: a phone at 150% text had 54 hidden stops under a 252px bar, and the 768x640 signed-out bar is 131px against the old 128px margin. Both are covered by the measured height (AC15a, AC15b).
- The drawer's jump hid from a final-offset check: Chromium jumped 116px and put the page back a frame later. The focus-return tests sample every painted frame. Scroll events were the wrong signal: WebKit reports an offset it never paints when a modal's scroll lock lifts.
- Pre-existing, parked: WebKit moves the page itself when Radix lifts a modal menu's scroll lock (958 to 290 on a phone, 530 to 59 at 1280x600). It happens before focus returns and with every margin forced to 0. The WebKit menu cases are `test.fixme`.
- Harness race, fixed: under load the phone topbar sometimes never tucked, because the park scroll landed before `useScrollChrome` attached its listener. The park step now retries a step up and back down until the bar tucks. 120 of 120 passed on six workers after.
- Capture bar Escape, fixed: it blurred the field on a composing Escape. The weekly sweep half of that finding was refuted: its panels hold buttons and a date input, with no text field to compose in.
- `edit-drawer.tsx` grew from 470 to 478 lines against the spec's limit. `handleTagKeyDown` moved to `edit-drawer-tag-keys.ts`, the spec's named fallback, and the drawer is 457.
- Parked for the owner: with the opt-in smart-view strip on, the pinned stage at 1024x640 is 112px, under the 10rem floor. It predates the branch at 1024 and up. The stage-floor test now fixes the clock to the longest date.
