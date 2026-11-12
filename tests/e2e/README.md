# End-to-End Tests

Playwright-driven tests that exercise the v9 single-matrix UI through a real browser.
Specs live in this directory; the page-object model, fixtures, and helpers live in
`pages/`, `fixtures/`, and `helpers/` respectively.

## Running

```bash
bun run test:e2e          # all specs, all browsers, headless
bun run test:e2e:ui       # interactive runner with watch + time-travel
bun run test:e2e:debug    # headed, stepping through with the inspector
```

The dev server starts automatically via the `webServer` block in `playwright.config.ts`,
which runs `bun run dev:e2e`. If a server already answers on port 3000, such as
`bun dev`, Playwright reuses it. Before the first test, `global-setup.ts` requests
every `app/**/page.tsx` route once and fails the run if one does not load. CI doesn't
use this config; see [CI behaviour](#ci-behaviour).

Target a single file, project, or test:

```bash
bun run test:e2e -- tests/e2e/task-crud.spec.ts            # one spec
bun run test:e2e -- --project=chromium                     # one browser
bun run test:e2e -- -g "should update task title"          # by test name
```

## Layout

```
tests/e2e/
├── README.md                       ← this file
├── global-setup.ts                 ← warms every route on the dev server before the suite
├── fixtures/test-fixtures.ts       ← Playwright fixtures (IndexedDB cleanup, runtime-error check)
├── helpers/test-helpers.ts         ← shared utility functions
├── pages/matrix-page.ts            ← page-object model for the matrix shell
├── task-crud.spec.ts               ← create / read / update / delete / complete
├── quadrant-classification.spec.ts ← capture-parser quadrant assignment + move
├── matrix-navigation.spec.ts       ← matrix ↔ dashboard ↔ settings routing
├── search.spec.ts                  ← title and tag search
├── settings-navigation.spec.ts     ← section nav, theme, toggles, export
├── data-management.spec.ts         ← import flows and import validation
├── about.spec.ts                   ← about page smoke tests
├── first-time-redirect.spec.ts     ← first-visit /about redirect
├── quiet-chrome.spec.ts            ← topbar tucks away on scroll at phone widths
├── swipe-actions.spec.ts           ← touch swipe: Complete / Snooze / Delete on cards
└── *.spec.ts                       ← many more specs, one per surface or behavior
```

The tree names only some of the specs. Run `ls tests/e2e/*.spec.ts` for the full list.

## Conventions

- **Selectors**: prefer `[data-testid='…']` for stable hooks, then role/text locators.
  When you need a new testid, add it to the component along with the test — don't add
  speculative testids ahead of time.
- **Page object model**: encapsulate multi-step UI flows in `pages/matrix-page.ts`.
  Spec files should read like a story, not a sequence of locator strings.
- **No `page.waitForTimeout` for state**: prefer `waitFor` / `expect.toBeVisible`.
  No spec uses a fixed timeout today.

## Capture-parser shorthand

Quadrant tests and any spec that creates tasks rely on the capture-parser syntax
defined in `lib/capture-parser.ts`:

| Suffix     | Effect                       | Lands in |
| ---------- | ---------------------------- | -------- |
| `task !!`  | urgent + important           | Q1       |
| `task *`   | important only               | Q2       |
| `task !`   | urgent only                  | Q3       |
| `task`     | neither                      | Q4       |
| `… #tag`   | adds `tag` to `task.tags`    | —        |

Tokens must be space-bounded. `!important` is parsed as a literal word in the title,
**not** as an urgency flag. (The pre-v9 test suite assumed otherwise; all those
"different quadrant" tasks silently landed in Q4. Fixed 2026-05-11.)

## IndexedDB cleanup

The `clearIndexedDB` fixture in `fixtures/test-fixtures.ts` opens a blank page on the
app origin and deletes the Dexie database (`GsdTaskManager`, matching `lib/db.ts`)
**before** each test's body runs. It also seeds the first-visit and onboarding flags,
clears Cache Storage, and leaves the page at `/`. Tests opt in by destructuring it:

```ts
test.beforeEach(async ({ page, clearIndexedDB }) => {
  /* clean slate guaranteed */
});
```

Playwright contexts are already isolated per test, so this is belt-and-braces:
the database is gone, then the test reopens it via the app's normal Dexie boot.

The same file holds `runtimeErrors`, a fixture that runs for every test. It fails a
test that logs a `console.error` or throws a page error. A test that expects one sets
the `expectedConsoleErrors` option to a pattern.

## Known gaps versus the original spec

`tasks/e2e-testing-spec.md` was written generically; v9's single-matrix refactor
(see `docs/adr/0011-v9-single-matrix-refactor.md`) removed several surfaces the
spec assumed. Some of those surfaces have since returned in a new form. The following
test stubs from that document are still **not** implemented:

- **Smart views** (`smart-views.spec.ts`) — v9 deleted the pinning UI, 1-9
  shortcuts, and the `useSmartViewShortcuts` hook. Smart views now show as an
  opt-in strip above the matrix and in the command palette, off by default.
  No e2e test file covers that strip yet.
- **Search by subtask** — the search filter does include subtask titles, and
  the edit drawer now has a subtask editor (`SubtasksField`). No e2e test
  file covers subtask search yet.
- **Archive navigation** — `/archive` exists and is reachable from
  Settings → Archive → View archive, but that link is conditional on
  `archivedCount > 0`, so covering that link requires seeding archived tasks
  first. The command palette action "View archived tasks" also opens `/archive`
  and has no such condition. No e2e test file opens `/archive` yet.

`tasks/todo.md` no longer has a section that tracks these gaps.

## Adding a new spec

1. Add or update a method on `pages/matrix-page.ts` for the user flow you're
   testing.
2. Write the test using the `clearIndexedDB` fixture and the page object.
3. Run it once — it should fail with "selector not found" if you needed a new
   `data-testid`.
4. Add the `data-testid` to the component and re-run to green.
5. Run the full suite on chromium before committing:
   `bun run test:e2e -- --project=chromium`.

## CI behaviour

CI runs every spec against the production static export. Each browser leg runs
`bun run build:e2e`, then `bun run test:e2e:export -- --project=<browser>`, which serves
`out/` on port 3100 under the production CSP (`playwright.export.config.ts`). Run the
same two commands to reproduce a CI failure locally. Between them, the CI leg also
runs the PWA check, `bun run test:pwa -- <browser>`. The chromium leg also runs
`bun run test:csp`.

- `forbidOnly: true`: `.only` calls fail the build.
- `retries: 2`: flaky tests retry. A failure saves a screenshot and video in
  `test-results/`, and the first retry records a trace.
- `workers: 2`: each browser leg runs two tests at a time.

Locally, retries are disabled and Playwright picks its default worker count.

React's dev-only warnings, such as duplicate keys, invalid DOM nesting, and StrictMode
double effects, appear only on the dev server, so CI no longer fails on them. Run
`bun run test:e2e -- --project=chromium` before shipping UI work. On the dev server,
the `runtimeErrors` fixture fails any test that logs one.
