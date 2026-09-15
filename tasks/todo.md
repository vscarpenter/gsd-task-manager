# Session state — 2026-09-15 (iOS 27 refresh follow-on, web)

Branch: `feat/ios27-refresh`, cut from `main` @ `001b077`. Spec:
`tasks/spec-ios27-refresh.md` (design approved in chat 2026-09-15). Brief:
`design_handoff_ios27_refresh/gsd-taskmanager.md`.

The `bun.lock` and `public/sw.js` edits in the tree predate this session and stay
unstaged.

## Plan

Each step is red, green, refactor, commit.

- [x] 1. Token contract guard: `tests/data/inkwell-token-contract.test.ts` plus the
      JSON fixture; strip contrast table for the swipe pairings.
- [x] 2. Scroll chrome decision: `resolveChromeHidden` in `lib/use-scroll-chrome.ts`.
- [x] 3. `useScrollChrome` hook, `SimplifiedTopbar.hidden`, `AppShell.quietChromeOnScroll`,
      matrix opt-in; unit tests in `tests/ui/app-shell.test.tsx`.
- [x] 4. Swipe resolver: `lib/swipe-gesture.ts` (`lockDirection`, `clampSwipeOffset`,
      `resolveSwipeEnd`), `SWIPE_CONFIG` in `lib/constants.ts`.
- [x] 5. `SwipeActionRow` component wrapping the card; touch-only pointer handling; one
      open row store; unit tests in `tests/ui/task-card-swipe.test.tsx`.
- [x] 6. Snooze plumbing: `handleSnooze` in the matrix, `onSnooze` through grid and
      pane, mobile menu item, snoozed chip, desktop cluster stops forwarding.
- [x] 7. E2E: `tests/e2e/quiet-chrome.spec.ts`, `tests/e2e/swipe-actions.spec.ts`.
- [ ] 8. Gates: `bun run test`, `bun typecheck`, `bun lint`, `bun run build`,
      `bun run quality:shape`, touched e2e on all three browsers; verify-frontend-change
      at 390px in both themes.
- [ ] 9. Version trio to 13.1.0, change report and quiz, PR.

## Resuming From Here

- Done: spec approved and written; branch cut.
- Next: step 8.
- Blockers: none.
- Assumptions: snooze on the web means "snooze reminders" (`snoozedUntil`), the same
  field iOS writes; the desktop hover cluster stays without snooze per the brief.
