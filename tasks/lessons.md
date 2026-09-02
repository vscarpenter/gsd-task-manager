# Lessons Learned

Project-specific learnings, gotchas, and patterns. Review at the start of every session.

---

## Decoupling coverage-padding test files (finding F2.1)

When removing a `*-boost` / `*-coverage-push` / `gap-closing` padding test file, **classify by delete-and-measure, not by similarity.** Asking "does a canonical test that looks similar exist?" is unreliable and over-classifies tests as duplicates: in the batch removal of `final-coverage-push` / `function-coverage-final` / `last-function-push`, `lib/command-actions.ts` function coverage silently fell 83%→50% because the padding tests were the *sole* invokers of certain `buildCommandActions` lambdas, even though a similar-looking canonical test existed.

The reliable method, per file:
1. Snapshot per-module baseline from `coverage/coverage-summary.json`.
2. Delete the file *alone*, run `bun run test -- --coverage`.
3. Any module whose lines/func/branch drop = that file's unique coverage. Open lcov, find the test hitting the now-uncovered lines, migrate **that** test into the canonical module-named file (rewriting tautological `expect(typeof x).toBe('string')` assertions into real ones).
4. Only delete once the module holds baseline.

All 7 data-layer padding files are now eliminated. Where each one's unique coverage went:
- `coverage-boost` → smart-views pin/prefs to `smart-views.test.ts`; rest duplicates.
- `sync-and-utils-boost` → 4 BackgroundSyncManager branch tests to `sync/background-sync.test.ts`; rest duplicates.
- `db-coverage` → all duplicates.
- `functions-branches-boost` → `useCountUp` to new `use-count-up.test.ts`; 2 settings edge-cases to `notifications/settings.test.ts`; rest duplicates.
- `final-coverage-push` → command-actions `condition()` tests + filters `isEmptyFilter`/`getFilterDescription`/`readyToWork` branches (command-actions 83→100% func).
- `function-coverage-final` + `last-function-push` → snooze + time-tracking real-execution branches to new `tasks/crud-side-effects.test.ts` (the canonical files mock `@/lib/db` + crud helpers, so `?? false`/`|| []` branches were only hit by real fake-indexeddb); `getAutoSyncConfig` to `sync/config.test.ts`; `haveDependenciesChanged` inner loop to `task-card-memo.test.ts`.

Key gotcha: mock-based canonical tests (`vi.mock('@/lib/db')` + helpers) leave the real-execution defensive branches uncovered. The padding files happened to cover them via real fake-indexeddb. Migrate those as a real-DB integration test, not into the mocked canonical file.

UI padding files (different from data files — these were the *sole* tests for their components, so the fix was rename/relocate, not delete):
- `gap-closing-2` → `install-pwa-prompt.test.tsx` (rename); `coverage-boost-ui` → `task-card-subcomponents.test.tsx` (rename); `task-card-coverage` → `task-card-states.test.tsx` (rename); `final-function-push` → deleted (dupes).
- `gap-closing` + `more-function-coverage` split into `pwa-update-toast.test.tsx` + a consolidated `task-timer.test.tsx`; the unique get-set branch (getSyncStatus deviceId fallback) moved to `sync/config.test.ts`; filter tests were dupes.

**F2.1 is complete.** Guardrail in place: `tests/suite-hygiene.test.ts` fails if any test file name matches `/(coverage|boost|gap-closing|function-push|function-final|function-coverage)/i` (verified it does not false-positive on `pb-push`). All 13 padding files eliminated; total coverage held/improved at every step (delete-and-measure gated each change).

---

## PocketBase v0.23+ Gotchas

- System fields (`created`, `updated`) **cannot** be used in `sort` or `filter` — use custom fields like `client_updated_at` instead.
- Custom indexes cannot reference system columns (`updated`, `created`).
- The `_pb_users_auth_` placeholder doesn't work as a `collectionId` for relation fields — use `text` type for owner FK or look up the real collection ID.
- Admin auth endpoint is `/api/collections/_superusers/auth-with-password` (not `/api/admins/auth-with-password`).

## Import/Export Schema

- Import schema uses `.strip()` (not `.strict()`) to accept legacy exports with extra fields (e.g., `vectorClock` from the old Cloudflare sync system).
- Export schema still uses `.strict()` to ensure clean outgoing data.

## Sync Engine

- Push operations are throttled (100ms between requests) to avoid PocketBase 429 errors.
- `fetchRemoteTaskIndex()` pre-fetches all remote task IDs in one request instead of N individual lookups.
- SSE subscriptions auto-reconnect; periodic sync runs as safety net.
- Echo filtering skips own-device changes via `device_id` comparison.

## Testing

- Use `bun run test` (not `bun test`) — the latter invokes bun's built-in runner, not Vitest.
- Mock IndexedDB with `fake-indexeddb` for data layer tests.
- The sync module (`lib/sync/`) has no tests yet — critical gap for multi-device features.

## Build & Deploy

- Static export mode means no API routes or SSR.
- CloudFront Function needed for SPA routing (S3 doesn't auto-serve `index.html` for directory paths).
- Run `deploy-cloudfront-function.sh` after adding new App Router routes.

## Coding Standards Compliance (April 2026 audit)

- Removed unused `dompurify` / `@types/dompurify` — React handles XSS natively.
- Pinned `canvas-confetti` from `^1.9.4` to exact `1.9.4`.
- Migrated `.parse()` to `.safeParse()` in user-input paths (import, create).
- Refactored `clearIndexedDB()` and `checkAndNotify()` for function length compliance.

## 2026-07-05 — Edit-drawer autofocus is a test trap (unit AND e2e)

`EditDrawerForm` moves focus to the title input ~100ms after mount
(`UI_TIMING.FOCUS_DELAY_MS`). Any test (jsdom or Playwright) that interacts
with a *later* drawer field immediately after opening loses focus mid-action —
which also closes the dependency-suggestion popup via its container onBlur.
Fix pattern: wait for the title to be focused before touching other fields
(unit: `waitFor(() => expect(title).toHaveFocus())`; e2e:
`locator("[data-testid='edit-title']:focus").waitFor()` — now baked into
`MatrixPage.openEditDrawer`). Same root cause bit both layers in one session.

## 2026-08-11 — Stagehand integration

- **A full-screen modal blinds Stagehand observe/act while extract keeps working.** The onboarding tour makes the app inert; the interactive-element snapshot is honestly empty (~1.8k input tokens is the tell) but extract reads the inert tree anyway — so AI verdicts can describe UI a user cannot touch. Suppress gates the same way e2e fixtures do (pre-seed the flag via addInitScript) and treat "observe returns 0 for every phrasing" as structural, not a wording problem.
- **Extract-after-act races Dexie liveQuery.** The DOM updates a beat after a mutating act; extracting immediately reads the pre-update tree. A short render settle after mutating steps fixes it deterministically.
- **Bun resolves modules from the script's location, not cwd** — scratch scripts outside the repo can't import the repo's node_modules; run diagnostics from a gitignored in-repo dir instead.

## 2026-08-27 — Anonymous feedback: making a privacy claim testable

- **Purity is what makes a "here's what we send" disclosure trustworthy.** The
  usual failure mode is that someone adds a field to the request and forgets the
  disclosure. Keeping `buildPayload` pure — submission id, version, and
  timestamp all injected — lets the preview render the *same object* the body is
  serialized from, so a test can assert they're identical instead of trusting
  copy to stay accurate. Cost: the timestamp is the last-edit moment, not the
  button press. Worth it.
- **Rebuild persisted state field by field, never spread it.** `localStorage` is
  writable by devtools and by anything achieving XSS. Spreading parsed JSON into
  a draft would let an injected key ride along toward the payload; reconstructing
  from known fields makes that structurally impossible.
- **An in-memory fallback must key off a *failed write*, not an empty read.**
  Falling back whenever storage reads empty conflates "nothing stored" with
  "storage broken" — it resurrects drafts the user cleared, and it leaks state
  between tests. Tying the copy to a write that actually failed is both correct
  and self-resetting.
- **`useSyncExternalStore` beats a state-setting effect for persisted UI state.**
  The static export prerenders these pages, so reading storage during render
  breaks hydration and reading it in an effect trips
  `react-hooks/set-state-in-effect` (fatal under `--max-warnings=0`). A frozen
  server snapshot plus a cached client snapshot solves both. `lib/use-is-hydrated.ts`
  is the existing precedent.
- **Identifiers are only dangerous in combination.** Reusing the existing
  `syncMetadata.deviceId` would have made "anonymous" feedback joinable against
  sync traffic and sync history. The answer wasn't a second id — it was none at
  all, with vote integrity moved client-side.
- **The code-shape ratchet is per-file with a zero allowance for new files.**
  New components must land at complexity ≤10 / depth ≤3 / ≤400 lines / ≤40 lines
  per function. Refresh the baseline with
  `node scripts/check-code-shape.cjs --print-baseline` and diff it before
  committing — a full refresh also tightens stale entries, which is safe but
  shows up as unrelated churn.

## 2026-09-02 — Feedback nudge: verifying a conditional surface in the running app

- **The SW re-registers on every load, so bust it immediately before each reload you
  intend to trust.** One reset at the start of a session is not enough: `PwaRegister`
  puts the worker back on the next load and it caches the chunk you are about to change.
  The symptom was a hot-reloaded footer beside a stale `<p>` nudge on the same page.
- **The Chrome extension's `resize_window` can report success without changing the
  viewport.** `innerWidth` stayed at 1863 after a "successful" 390×844 resize. For narrow
  breakpoints use headless Playwright with a mobile context (`isMobile`, `hasTouch`) and
  seed IndexedDB inside that context; it also proves the coarse-pointer 44px targets.
- **Click by element ref, not by coordinates, after any resize or reload.** A click at
  coordinates taken from an earlier screenshot missed once the viewport height changed.
- **A handler that reads nothing from props or state belongs at module scope.** Moving
  `dismissNudge` out of the component was the difference between 41 and 36 lines under
  the ≤40 lines-per-function ratchet, with no behaviour change.
- **Derive "returning user" from the user's own records rather than a first-run
  timestamp.** Oldest `createdAt` plus completion history works retroactively for people
  already using the app, adds no tracking key, and measures use rather than install age.
- **A control that unmounts itself on activation must hand focus off first.**
  `restoreFocusOrMainContent(null)` before the store write keeps keyboard focus on
  `#main-content` instead of `<body>`; the a11y reviewer caught it, a unit test now pins it.
