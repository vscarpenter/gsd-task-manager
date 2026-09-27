# Spec: Vitest 5 migration (root package)

Date: 2026-09-27. Branch: `chore/vitest-5-migration`. Tier: non-trivial (test-runner
major, shared `vitest.config.ts` used by all 241 test files).

## Goal

Move the root test suite from Vitest 4.1.11 to 5.0.2 without losing a test or a
covered file, so the stack stops pinning the one package `bun update --latest` held
back for a test-runner reason.

## Inputs / Outputs

- Input: `package.json` devDependencies `vitest` and `@vitest/coverage-v8`, both at
  `4.1.11` today.
- Output: both at `5.0.2`, a refreshed `bun.lock`, two migrated test files, and one
  added coverage `include` glob. No app code, no Zod schema, no data shape changes.
  No change to anything that ships in `out/`.

## Discovery (measured on this branch, Node 22.19)

| Signal | Vitest 4.1.11 | Vitest 5.0.2, no other change |
|---|---|---|
| Tests | 3,193 passed | 57 failed, 3,136 passed |
| Failing files | none | `tests/data/notifications.test.ts` (46), `tests/data/notifications/badge.test.ts` (11) |
| Covered files | 269 | 268: `lib/sync/sync-provider.tsx` drops out |
| Coverage (stmts / branches / fns / lines) | 88.9 / 82.58 / 89.36 / 90.02 | 88.2 / 81.82 / 88.77 / 89.23 |

Root causes, from the official Vitest 4 to 5 migration guide:

1. "Assignments to properties on globalThis or window in jsdom ... are now
   propagated." jsdom's `navigator` has only a getter, so `global.navigator = x`
   throws. All 57 failures are this one error.
2. Coverage patterns "are now matched against each file's path relative to the
   project root, without contains." Vitest 4 matched `lib/**/*.ts` as a substring of
   `lib/sync/sync-provider.tsx`. Vitest 5 matches exactly, so the only `.tsx` file in
   `lib/` falls out.

Checked and not affected: wildcard-free coverage patterns (the three
`tools/stagehand/*.ts` includes and the two barrel excludes still match), snapshots
(none exist), `vi.mock` hoisting, `toThrow("")`, `test.sequential`, removed
`vitest/*` entry points, `VITEST_POOL_ID`, and `-t` filters (none used).

## Design decisions (the approval gate)

- **D1. Replace `navigator` assignments with `vi.stubGlobal("navigator", value)`**, and
  add `afterEach(() => vi.unstubAllGlobals())` in both files. This matches the four
  files that already stub globals (`confetti`, `submit-feedback`,
  `use-settings-data`, `feedback-settings`), each of which unstubs in its own file.
  Property writes on the stub (`global.navigator.setAppBadge = mock`) and
  `Object.defineProperty(global.navigator, "serviceWorker", ...)` keep working,
  because they write to our plain stub object, not to jsdom's.
  Rejected: a global `unstubGlobals: true` config (changes behavior for every file),
  and hand-rolled `Object.defineProperty(window, "navigator", ...)` (manual restore
  bookkeeping for no gain).
- **D2. Add `"lib/**/*.tsx"` to `coverage.include`** so `lib/sync/sync-provider.tsx`
  stays measured. It is the provider fixed in PR #558 and carries real logic.
- **D3. Accept Vitest 5's new `clearMocks: true` default.** The measured run shows no
  test depends on call history carried across tests. Rejected: pinning
  `clearMocks: false`, which keeps the weaker v4 default for no measured benefit.
- **D4. No CI workflow change.** Vitest 5 needs Node 22.12 or later. CI installs Bun
  but not Node, so Vitest runs on the runner's Node: 22.23.2 on the ubuntu-24.04 image
  20260920 (24.21.0 is cached). Local default is Node 26.10.
- **D5. Root package only.** `packages/mcp-server` stays on Vitest 4.1.11, pinned by
  `tests/data/security-hardening-scripts.test.ts:358-359`, and migrates in its own PR.
  Bun nests the MCP copy, so the two versions do not collide.

## Constraints

- Test files only, plus `vitest.config.ts`, `package.json`, and `bun.lock`. No
  production code changes, so bundle size and the PocketBase, IndexedDB, and privacy
  surfaces are untouched.
- Both touched test files stay under their current size (837 and 141 lines). No new
  function over 40 lines.
- Coverage thresholds stay as configured (80 / 80 / 80 / 75). No threshold changes.
- The covered-file set must match the Vitest 4 set exactly.

## Edge cases

- **`navigator` stubbed as `undefined`.** `badge.test.ts` and `notifications.test.ts`
  both test "navigator is undefined". `vi.stubGlobal("navigator", undefined)` must
  make `typeof navigator === "undefined"` inside `lib/notifications` for the same
  assertion to hold.
- **Stub leaks between tests.** A stub set in one test must not leak into the next.
  `vi.unstubAllGlobals()` in `afterEach` restores jsdom's real `navigator`.
- **`beforeEach` stubs.** `notifications.test.ts` stubs in `beforeEach` (line 73) and
  some tests stub again. The later stub must win for that test, and the next
  `beforeEach` must start from jsdom's original.
- **Node 26 locally.** `service-worker-privacy` fails on Node 26 under Vitest 4 and
  passes on Node 22. It predates this work. The migration must not change its
  status on either version.
- Offline mode, sync conflicts, circular dependencies, multi-device edits, and
  schema migrations do not apply: no runtime code changes.

## Out of scope

- `packages/mcp-server` Vitest upgrade (D5).
- The pre-existing Vite warning about `__dirname` at `vitest.config.ts:63`. It fires
  under Vitest 4 too.
- `jsdom` 30.1.1 and the `zod` hold, both from `bun update --latest`.
- The Node 26 `service-worker-privacy` failure.
- Any test refactor beyond the `navigator` sites, and any new tests of app behavior.

## Acceptance criteria

- **AC1.** `package.json` pins `vitest` and `@vitest/coverage-v8` at `5.0.2`, and
  `bun install --frozen-lockfile` reports no changes.
- **AC2.** The full root suite passes under Vitest 5 on Node 22: 0 failures, and the
  same test count as the Vitest 4 baseline (3,193 passed, 1 skipped).
- **AC3.** No test assigns `navigator` directly (`rg "(global|globalThis|window)\.navigator\s*=" tests`
  finds nothing). Every stub goes through `vi.stubGlobal`.
- **AC4.** Each migrated test keeps its original assertion, and the "navigator is
  undefined" cases still assert `false` from `isBadgeSupported` and friends.
- **AC5.** `bun run test -- --coverage` covers exactly the Vitest 4 file set (269
  files, including `lib/sync/sync-provider.tsx`) and passes the thresholds.
- **AC6.** `bun typecheck`, `bun lint`, `bun run quality:shape`, and `bun run build`
  pass. The MCP suite passes on its own Vitest 4.1.11, and
  `security-hardening-scripts.test.ts` passes unchanged.

## Test stubs

The red tests already exist: they are the 57 tests failing under Vitest 5. No new app
tests are needed. Verification mapping:

```ts
// AC2, AC4: existing suites, red under Vitest 5 until migrated
describe("Notification Badge", () => {
  it("should return false when navigator is undefined"); // badge.test.ts:11
  it("should return true when setAppBadge is available"); // badge.test.ts:24
  it("should handle errors gracefully"); // badge.test.ts:123
  // ...8 more in badge.test.ts
});
describe("Notifications module", () => {
  it("should return true when Notification API is available"); // all 46 fail in beforeEach
  it("should return false when navigator is undefined"); // notifications.test.ts:750
  // ...44 more in notifications.test.ts
});

// AC1: bun install --frozen-lockfile (no changes)
// AC3: rg "(global|globalThis|window)\.navigator\s*=" tests  -> no matches
// AC5: diff of coverage-summary.json keys, Vitest 4 vs Vitest 5 -> empty
// AC6: security-hardening-scripts.test.ts ("pins dependency overrides and MCP dev tools")
```
