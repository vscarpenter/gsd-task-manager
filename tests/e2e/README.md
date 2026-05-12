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

The dev server starts automatically via the `webServer` block in `playwright.config.ts`.
If you already have `bun dev` running, Playwright reuses it locally; in CI it always
spawns a fresh one.

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
├── fixtures/test-fixtures.ts       ← Playwright fixtures (IndexedDB cleanup)
├── helpers/test-helpers.ts         ← shared utility functions
├── pages/matrix-page.ts            ← page-object model for the matrix shell
├── task-crud.spec.ts               ← create / read / update / delete / complete
├── quadrant-classification.spec.ts ← capture-parser quadrant assignment + move
├── matrix-navigation.spec.ts       ← matrix ↔ dashboard ↔ settings routing
├── search.spec.ts                  ← title and tag search
└── settings-navigation.spec.ts     ← section nav, theme, toggles, export
```

## Conventions

- **Selectors**: prefer `[data-testid='…']` for stable hooks, then role/text locators.
  When you need a new testid, add it to the component along with the test — don't add
  speculative testids ahead of time.
- **Page object model**: encapsulate multi-step UI flows in `pages/matrix-page.ts`.
  Spec files should read like a story, not a sequence of locator strings.
- **No `page.waitForTimeout` for state**: prefer `waitFor` / `expect.toBeVisible`.
  The few fixed timeouts that remain are documented at the call site and exist to
  ride out animations rather than to mask flakes.

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

The `clearIndexedDB` fixture in `fixtures/test-fixtures.ts` navigates to the app
origin and deletes the Dexie database (`GsdTaskManager`, matching `lib/db.ts:31`)
**before** each test's body runs. Tests opt in by destructuring it:

```ts
test.beforeEach(async ({ page, clearIndexedDB }) => {
  /* clean slate guaranteed */
});
```

Playwright contexts are already isolated per test, so this is belt-and-braces:
the database is gone, then the test reopens it via the app's normal Dexie boot.

## Known gaps versus the original spec

`tasks/e2e-testing-spec.md` was written generically; v9's single-matrix refactor
(see `docs/adr/0011-v9-single-matrix-refactor.md`) removed several surfaces the
spec assumed. The following spec stubs are intentionally **not** implemented:

- **Smart views** (`smart-views.spec.ts`) — v9 deleted the pinning UI, 1-9
  shortcuts, and the `useSmartViewShortcuts` hook. The `smartViews` Dexie table
  remains for data continuity but has no UI surface.
- **Search by subtask** — the search filter does include subtask titles, but
  the v9 edit drawer has no subtask editor (only a count badge on cards).
- **Archive navigation** — `/archive` exists and is reachable from
  Settings → Archive → View archive, but that link is conditional on
  `archivedCount > 0`. Covering it requires seeding archived tasks first.

These gaps are tracked in `tasks/todo.md` § "E2E test gaps left by v9 surface
removal" and would be reopened if the underlying features are resurrected.

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

- `forbidOnly: true` — `.only` calls fail the build.
- `retries: 2` — flaky tests retry; first failure produces trace, screenshot, and
  video in `test-results/`.
- `workers: 1` — serial execution in CI for log readability.

Locally, retries are disabled and workers run in parallel.
