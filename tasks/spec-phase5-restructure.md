# Spec: modernization Phase 5, restructure and burn down code shape

Date: 2026-10-07. Tier: non-trivial. The approved design is
`../gsd-modernize/analysis/gsd-taskmanager/MODERNIZATION_BRIEF.md` §3 Phase 5.
Vinny approved the full plan on 2026-10-05 and asked to start Phase 5 on
2026-10-07. Where this spec and the brief differ, the brief wins. The baseline
is the "Before Phase 5" section of `../gsd-modernize/analysis/gsd-taskmanager/BASELINE.md`.

## Goal

Meet Phase 5's six exit criteria without changing behavior. The measured
code-shape total on `main` at `d4baa2d` is 133 (complexity 34, max-depth 4,
max-lines 0, max-lines-per-function 95). The target is at most 118, with no
file gaining an exception it doesn't have in `code-shape-d4baa2d.json`.

## Rules for every bundle

- Nothing changes behavior unless Vinny ticks a §7 item. The three items found
  while mapping this phase (CSP drift, the missing "Synced" tooltip, and the
  off-by-one build version) start unticked, so they keep today's behavior.
- Test first. A move that keeps behavior gets a test that pins the behavior and
  passes before and after. A new guard, such as a drift check or a generated-file
  check, must fail on a deliberate one-copy edit before it counts.
- A bundle that lowers a code-shape count regenerates
  `scripts/code-shape-baseline.json` through a temp file and lowers the
  ceilings in `scripts/code-shape-debt.json` to the new measured totals.
- Builds run scrubbed: `env -i HOME="$HOME" PATH="$PATH"`.
- Each bundle passes `bun run test`, the MCP suite, `bun typecheck`,
  `bun lint`, `bun run quality:shape`, and a scrubbed `bun run build` that
  leaves the tree clean. UI bundles also pass the export journeys and a check
  in the running app.
- No push, PR, or merge without Vinny's go-ahead.

## Bundles

One branch per bundle, cut from `main` at `d4baa2d`. A goes first, because
until it lands every build rewrites `public/sw.js`.

### A. Stamp the cache version into `out/sw.js` (`chore/stamp-sw-version-in-out`)

- `public/sw.js` commits a fixed placeholder for `CACHE_VERSION`. Development
  serves it as is, so dev caches stop rotating between versions.
- `scripts/update-sw-version.cjs` takes a target path, stamps the version from
  `.build-info.json` into it, and exits 1 if the placeholder line is missing or
  still there afterward.
- `scripts/build-static-export.sh` stamps `out/sw.js` after the export check.
  The `build` script in `package.json` and the hand-written chain in
  `docker/Dockerfile` stop stamping `public/sw.js`.
- The deployed `CACHE_VERSION` keeps today's value, so the deployed worker
  behaves as before.
- Tests: the script stamps a given file and refuses one without the
  placeholder, and the fake build in `tests/data/build-config.test.ts` shows
  `out/sw.js` stamped and `public/sw.js` untouched.
- Docs: `.claude/rules/sw-cache.md`, `AGENTS.md`, and the header comments.

### B. Generate `public/sw-cache-logic.js` from the TypeScript (`chore/generate-sw-cache-logic`)

- `scripts/generate-sw-cache-logic.cjs` uses TypeScript's `transpileModule`,
  which is already a dev dependency. It strips `export`, so the functions stay
  globals for `importScripts`, and adds a generated header and the
  `module.exports` footer the tests load.
- The build doesn't write the file. A test regenerates it in memory and fails
  unless it matches the committed copy byte for byte.
- The first regeneration may reformat the committed copy, which changes the
  deployed worker's bytes once.
- The pinned-copies case table stays and now proves the generator keeps
  behavior.

### C. One CSP source (`refactor/csp-single-source`)

- `config/csp.cjs`, with a `.d.cts`, holds the ordered directives and
  `buildCsp("cloudfront" | "selfhost")`. It reproduces today's two policies
  exactly.
- `readProductionCsp()` in `scripts/lib/static-export-server.cjs` returns
  `buildCsp("cloudfront")`.
- A test fails unless the CloudFront JSON value, the Caddyfile CSP line, and
  the export server's header each equal their target's string exactly.
- `cloudfront/response-headers-policy.json` stays byte-identical, so merging
  fires no CloudFront infra deploy.
- Out of scope: the development meta tag in `app/layout.tsx` and the copy in
  `SECURITY.md`.

### D. Dead code and knip (`chore/knip-dead-exports`)

- Delete exports that only tests call, with their tests: `isEmptyFilter` and
  `getFilterDescription` (`lib/filters.ts`); `categorizeError`,
  `ErrorCategory`, and `isPermanentError` (`lib/sync/error-categorizer.ts`);
  `areTaskCardPropsEqual` and its helpers (`lib/task-card-memo.ts`, keeping
  `TaskCardProps`); `lib/use-all-tags.ts`; and `lib/hooks/use-guide-mode.ts`.
- Keep `exportTasks` and `exportToJson` for now. Two RULE-265 pins call
  `exportTasks`, so those pins move to the live export path before either one
  goes.
- Add knip as an exact-pinned dev dependency, with a `knip` script that runs
  `knip --production`, `!` production entries in `knip.json`, and a step in
  the `lint` job after the code-shape check. Its first run must come back clean,
  with every remaining finding fixed or ignored with a reason.

### E. One sync-status store (`refactor/sync-status-*`, five PRs)

1. Every status poll catches and logs its failures through a new
   `SYNC_STATUS` logger context. The polls are the enabled check, the
   coordinator status, the last-sync read, and both pending-count reads. A
   failed read no longer surfaces as the generic error toast, which is what the
   exit criterion asks for.
2. Remove the health monitor's own timer, whose result nobody reads.
3. Add `lib/sync/sync-status-store.ts` behind `useSyncExternalStore`, started
   once by `SyncProvider`. The poll still runs while
   `isEnabled || isSyncing || pendingRequests > 0`, and the idle-polling and
   render-count tests move over with it.
4. Point both `useSyncStatus` hooks at the store, which removes four duplicate
   timers, and fix the stale mocks.
5. Merge the provider's and the sync button's health checks into one store
   poll, keeping the sync button's timing and toast `id`.

### F. `MatrixSimplified`, one extraction per PR (`refactor/matrix-*`)

First add a matrix-level test of URL extraction from a title. Then: (a) use
the shared `useIsHydrated`; (b) `useMatrixOverlay`; (c) a pure
`buildCreateInitial`; (d) `createFromDraft` and `deleteWithUndo` in
`task-actions.ts`; (e) `useIntroBriefing` and `useQuadrantFocus`; (f) split the
board JSX from the overlay JSX. Each PR also runs the matrix tests, the export
journeys, and a check in the running app.

### G. Small burn-downs (`refactor/shape-*`)

`lib/analytics/time-tracking.ts`, `lib/use-app-shortcuts.ts`,
`lib/use-drag-and-drop.ts`, four small JSX extractions (`hero-section`,
`settings-sidebar`, `terminal-block`, `settings-page`), and the MCP server's
`validateDependencies`, `retry`, and `handleGetCacheStats`. A shared key-guard
helper for the shortcut handlers goes in only if the tests show it changes no
key event's outcome.

### H. Final ratchet

After the bundles merge, lower the ledger's ceilings to the measured totals
and tick the exit criteria with evidence.

## Acceptance criteria (brief Phase 5 exit criteria)

1. `scripts/code-shape-debt.json` lists fewer exceptions than the recorded
   baseline, with none added. The baseline is the measured 133.
2. A local `bun run build` leaves `public/sw.js`, `package.json`, and
   `bun.lock` unchanged in git.
3. One source defines the CSP for CloudFront, Caddy, and the export test
   server, and a test fails when any copy differs.
4. One store owns sync-status polling, and every poll logs its failures.
5. knip runs in CI, and the dead exports the assessment named are gone.
6. Every P0 rule in §5 still passes, and the Playwright suite passes in all
   three browsers.
