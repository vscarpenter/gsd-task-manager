# Spec: First-load JavaScript budget and two low-risk splits (PRF-1)

Date: 2026-09-19. Tier: Non-trivial (CI gate, root layout, shared module). Scope
approved by the owner on 2026-09-19: "budget plus two cheap splits". Audit
finding PRF-1.

## Goal

Stop first-load JavaScript from growing unnoticed, and take two low-risk
modules off routes that do not use them. CI has no byte budget today, so the
438 KB that every route shares can grow with no signal.

## Background (measured on the `out/` build of `186ac53`, gzip)

- Six routes. 20 chunks load on all of them: 438.4 KB. `/` loads 521.4 KB.
- Most of the shared bytes are React and Next, Zod 4, Sentry, Dexie, and Radix.
  Every route needs those. Deferring Sentry made cold LCP 38% worse in the
  2026-09-13 makefaster run, so it stays.
- `@tanstack/react-query` has two consumer routes, `/archive` and
  `/sync-history`. `QueryProvider` wraps all six from `app/layout.tsx`.
- `canvas-confetti` (6.8 KB) loads eagerly on `/` through
  `task-actions.ts` to `lib/confetti.ts`.
- The service worker caches hashed chunks on first fetch and precaches none. A
  lazy chunk never fetched while online is missing offline.
- `MatrixSimplified` is at its code-shape ceiling of 269 lines.

## Design

1. `scripts/check-bundle-budget.cjs`, modeled on `check-code-shape.cjs`.
   - Finds every route `index.html` under `out/`, collects its same-origin
     `<script src>` files, and sums their gzip sizes.
   - Compares each route with `scripts/bundle-budget.json`. A route fails when it
     exceeds its recorded bytes plus `allowanceBytes` (5,120). A route missing
     from the file fails. `--write-baseline` rewrites the file and keeps the allowance.
   - The allowance lets ordinary feature work through. A new dependency in a
     shared chunk trips it, and raising the recorded bytes shows up in review.
   - Script `quality:bundle`. The CI `build` job runs it after the build.
2. `QueryProvider` leaves `app/layout.tsx`. New `app/(archive)/layout.tsx` and
   `app/(sync)/layout.tsx` provide it to the two routes that use it.
3. `lib/confetti.ts` loads `canvas-confetti` with `import()` on first use. It
   also fetches the chunk once when the browser is idle, so the service worker
   caches it while online. Reduced-motion users skip both.

## Inputs / Outputs

- Input: a built `out/`. Output: a per-route table on stdout, and exit code 1
  with a named route on a breach.
- `scripts/bundle-budget.json`: `{ "allowanceBytes": number, "routes": { "<route>": bytes } }`.
- No task schema, sync, or export contract changes.

## Constraints

- No new dependency. `node:zlib` at level 9.
- `celebrateCompletion()` keeps its synchronous `void` signature. No call site
  and no existing mock changes.
- No edit to `MatrixSimplified`. New files meet the code-shape limits.
- The baseline comes from a build with the CI flags (`NEXT_DISABLE_SWC_BINARY=1`).
- Keep a split only if the measured route bytes drop.

## Edge Cases

- `out/` missing: the script fails with a message naming `bun run build`.
- A new route with no budget entry: fails and names the route.
- A route far under its budget: passes, and the output suggests a refresh.
- `404` and `_not-found` pages: skipped, since users do not land on them.
- Offline with the confetti chunk uncached: no animation, no error toast, and
  the next attempt retries the import.
- Reduced motion: the library never loads.
- Prerender in Node: no idle fetch is scheduled.
- Leaving `/archive` unmounts its `QueryClient`. The next visit reads IndexedDB
  again, which is local.

## Out of Scope

- The sync stack split (four static import paths, one through the write path).
- Lazy-mounting the command palette.
- Zod, Sentry, Dexie, or Radix.
- The 500 ms `SyncProvider` poll for signed-out users. Worth a separate fix.
- LCP. This work is judged on bytes.

## Acceptance Criteria

- AC1: The script sums gzip bytes of each route's same-origin scripts and skips
  the `404` and `_not-found` pages.
- AC2: A route over budget plus allowance fails by name. At the limit it passes.
- AC3: A route with no budget entry fails by name.
- AC4: A written baseline round-trips: checking against it passes.
- AC5: A missing `out/` fails with a message naming `bun run build`.
- AC6: Both route-group layouts give their children a `QueryClient`, and
  `app/layout.tsx` no longer imports the provider.
- AC7: `celebrateCompletion()` loads the library on first use, not at import.
- AC8: Reduced motion loads nothing, on use or on idle.
- AC9: A failed import shows no error and the next call retries.
- AC10: The idle warm-up fetches the library once in a browser, never in Node.
- AC11: CI runs `quality:bundle` after the static export build.
- AC12: Measured bytes drop on `/`, `/about`, `/dashboard`, and `/settings`, and
  `/archive` and `/sync-history` still work in the running app.

## Test Stubs

`tests/data/bundle-budget.test.ts`:

- `should_sum_gzip_bytes_of_each_routes_scripts_and_skip_error_pages` (AC1)
- `should_fail_a_route_over_its_budget_and_pass_one_at_the_limit` (AC2)
- `should_fail_a_route_that_has_no_budget_entry` (AC3)
- `should_pass_against_its_own_written_baseline` (AC4)
- `should_name_the_build_command_when_the_export_is_missing` (AC5)
- `should_run_the_bundle_budget_after_the_static_export_build_in_ci` (AC11)

`tests/ui/query-route-layouts.test.tsx`:

- `should_give_archive_and_sync_history_children_a_query_client` (AC6)
- `should_keep_the_query_provider_out_of_the_root_layout` (AC6)

`tests/data/confetti.test.ts`:

- `should_not_load_the_library_until_the_first_celebration` (AC7)
- `should_load_nothing_under_reduced_motion` (AC8)
- `should_stay_quiet_and_retry_after_a_failed_import` (AC9)
- `should_warm_the_library_once_when_the_browser_is_idle` (AC10)

AC12 is verified by building and measuring, and by loading both routes in the
running export.
