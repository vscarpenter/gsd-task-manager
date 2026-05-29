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

Still remaining for F2.1: 6 UI padding files in `tests/ui/` (`coverage-boost-ui`, `final-function-push`, `gap-closing`, `gap-closing-2`, `more-function-coverage`, `task-card-coverage`), then add the guardrail test banning metric-named test files.

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
