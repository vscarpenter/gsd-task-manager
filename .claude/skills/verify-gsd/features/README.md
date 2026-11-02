# GSD verification map

This directory is the maintained source for verifying the user-facing behavior of the GSD web app. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Run commands from the repository root. `gsd-verify` means `bash .claude/skills/verify-gsd/scripts/gsd-verify`.
- Start an instance with `gsd-verify up` and require `Ready: http://127.0.0.1:<port>`.
- Run `gsd-verify doctor` and require exit 0 before trusting a result.
- Never drive an instance this checkout didn't start. Don't point a journey at `bun dev`, at production, or at a port another session owns.
- Each test gets an empty browser profile. Sync is off, the onboarding tour is suppressed, and the first-visit redirect is off unless a test sets `firstVisit`.

## Driving conventions

- Each sub-feature ID is a Playwright test title. Run one with `gsd-verify drive <journey> -g <id>`.
- Treat every command as literal.
- Prefer `data-testid`, then ARIA role and accessible name, over CSS selectors or DOM position.
- Use `seed` only for preconditions you can't create through the UI in a reasonable number of steps.
- Write new journeys in `journeys/adhoc/` as `*.journey.ts`. See the Drive section of `SKILL.md`.

## Proof and skip reporting

- Capture the action and the resulting state. The trace records both, and `proof.capture` adds a settled screenshot and an ARIA snapshot.
- A write needs a second view: reload the page, or read the rows with `proof.rows`.
- A download needs its contents parsed. A filename alone proves nothing.
- A green run also means no `console.error` and no uncaught exception, because the journey fails on either one.
- Name the run folder and the sub-feature IDs you drove in your report.
- Report an unreachable path with the attempted command and the unmet precondition.
- Don't report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with gsd-verify` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

If the seed data lacks a precondition a journey needs, the journey reports a failure and the reason goes in `Gotchas`. Never weaken a journey to make it pass.

## Features

- [Capture a task](./capture.md) covers the capture bar, its parser, the full form, every keyboard and palette entry, the share target, and the bookmarklet.
- [Task lifecycle](./task-lifecycle.md) covers editing, completing, recurring, moving with undo, and deleting with restore from Trash.
- [Search](./search.md) covers the matrix search field and the command palette, on the matrix and from other pages.
- [Review](./review.md) covers the empty state, seeded analytics, and the numbers a real completion produces.
- [Backup and restore](./backup.md) covers export, cross-client import, merge, replace, and rejected files.

## Not mapped yet

- Saved items, the archive, dependencies, snooze, notifications, and the settings sections beyond Data & Storage and Trash. `tests/e2e/` has specs to start from.
- Phone layouts and touch gestures. Set `test.use({ viewport: { width: 390, height: 844 } })` in a spec, and start from `tests/e2e/swipe-actions.spec.ts`.
- Signed-in sync, which needs production credentials or a mocked backend. The local sign-in UI is covered by `tests/e2e/sync-auth.spec.ts` and `tests/e2e/sync-auth-token.spec.ts`.
