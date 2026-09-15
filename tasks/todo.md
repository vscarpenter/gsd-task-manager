# Session state, 2026-09-15 (iOS 27 refresh follow-on, web)

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
- [x] 8. Gates: `bun run test`, `bun typecheck`, `bun lint`, `bun run build`,
      `bun run quality:shape`, touched e2e on all three browsers; verify-frontend-change
      at 390px in both themes.
- [x] 9. Version trio to 13.1.0, change report and quiz. PR #547 opened 2026-09-15.

## Resuming From Here

- Done: all nine steps. Nine commits on `feat/ios27-refresh`; every gate green locally
  (`bun run test` except one pre-existing local-only service-worker failure that also
  fails against the committed `sw.js` while CI on main is green; `bun typecheck`;
  `bun lint`; `bun run build`; `bun run quality:shape`; the six touched e2e specs on
  Chromium, Firefox, and WebKit, 100 passed). Real-browser pass at 390px light and dark
  and 1440px light: PASS, no console errors.
- Next: PR #547 is open (https://github.com/vscarpenter/gsd-task-manager/pull/547).
  Watch `gh pr checks 547`, then the usual merge (`gh pr merge 547 --squash --admin`),
  fast-forward main, delete the branch.
- Not done on purpose: the `bun.lock` churn stays uncommitted (pre-existing `bun
  update` refresh). The deployed `sw.js` reads 13.0.1; this branch sets the trio to
  13.1.0.
- Assumptions: snooze means "quiet the reminders" (`snoozedUntil`), the field iOS
  writes; the desktop hover cluster stays without snooze per the brief; `SnoozeDropdown`
  was removed because nothing rendered it after that decision.
