# Session state, 2026-10-07: modernization Phase 5, restructure and burn down code shape

Spec: `tasks/spec-phase5-restructure.md`. Approved design: brief §3 Phase 5. Both entry boxes are
ticked, and the baseline is in `../gsd-modernize/analysis/gsd-taskmanager/BASELINE.md` (measured
code shape 133 at `d4baa2d`; the ledger's ceilings total 153). Branches are cut from `main` @
`d4baa2d`, one per bundle.

- [x] Baseline recorded, entry boxes ticked, and three new §7 items added unticked (CSP drift,
      the missing "Synced" tooltip, the off-by-one build version).
- [ ] A. stamp the cache version into `out/sw.js`, `chore/stamp-sw-version-in-out`
- [ ] B. generate `public/sw-cache-logic.js`, `chore/generate-sw-cache-logic`
- [ ] C. one CSP source, `refactor/csp-single-source`
- [ ] D. dead code and knip, `chore/knip-dead-exports`
- [ ] E. one sync-status store, five PRs
- [ ] F. `MatrixSimplified` extractions, one per PR
- [ ] G. small burn-downs
- [ ] H. final ratchet and exit boxes

# Resuming From Here, 2026-10-07: modernization Phase 3 signed off

- [x] All four Phase 3 exit boxes in the brief are ticked with evidence. Each of the 15 fixes was
      reversed on `main` @ `a1d3444` with the tests kept, and every item had a test fail on the
      pre-fix code. Table: `../gsd-modernize/analysis/gsd-taskmanager/CONTRACT_MAP.md`.
- [x] `8d385ce` (a structured 429 or 5xx is transient) missed #579 because it was never pushed.
      It landed as #583 (`bb5c42a`). All 15 PR checks passed, and so did `main`'s runs.
- [ ] Next: record the code-shape counts in `BASELINE.md`, then start Phase 5. The ratchet
      expires 2026-12-31. Phase 4 waits on Vinny's §7 decisions.
- [ ] Cleanup, needs Vinny's OK: the four agent worktrees, the bundle and `worktree-agent-*`
      branches, `fix/phase-3-defects` (now fully merged), and the remote branch
      `fix/sync-structured-5xx-transient`.

Blockers: none. Full handoff: `../gsd-modernize/HANDOFF.md`.

# Resuming From Here, 2026-10-06: 13.8.0 release and gsd-mcp-server 1.3.0

- [x] Local sign-in on `dev.local:8080` timed out by design: since #569 the hosted bounce
      returns only to gsd.vinny.dev. Google sign-in verified on production.
- [x] Web 13.8.0: PR #581, tag `v13.8.0`. The release run failed its audit on
      GHSA-6qxp-vccf-f47h, so Vinny deployed locally. Prod `sw.js` reads 13.8.1 and serves
      13.8.0 code, but that build has no attestation.
- [x] MCP SDK 1.30.1 to 1.31.0 and gsd-mcp-server 1.3.0: PR #582 (`a1d3444`), tag
      `mcp-v1.3.0`, run 37531982567. On npm since 21:21 UTC with provenance; `latest` is 1.3.0.
- [ ] Optional: cut the next web tag so production returns to a gated, attested build.
      `v13.8.0` can't re-run green because its commit still pins SDK 1.30.1.
- [ ] Later: SDK 1.32.x as its own change (it accepts `tools/call` without arguments).
- [ ] The `braces` audit exception expires 2027-01-05.

Blockers: none. Assumption: 1.3.0 (not 1.2.9) because `list_devices` left the tool surface.

# Session state, 2026-10-06: modernization Phase 3, fix the ticked defects

Spec: `tasks/spec-phase3-defects.md`. Approved design: brief §3 Phase 3, with
Vinny's §7 decisions of 2026-10-06 (production stays on the bare PocketBase
binary; extract-rules skipped; 11 revisions accepted; 15 items to fix, 4 kept;
`list_devices` removed). Branches are cut from `main` @ `53418f1`, one per bundle.

- [x] Recorded the §7 decisions in the brief; unticked the four Phase 3 exit boxes Vinny
      ticked early (his request); ticked SEC-002's Phase 2 exit box under the accepted revision.
- [x] A. completion metrics, `fix/completion-date-metrics` (Claude)
- [x] B. reminders, `fix/app-level-reminders` (Claude)
- [x] C. MCP correctness and `list_devices` removal, `fix/mcp-write-correctness` (worker)
- [x] D. sync, RULE-194 and RULE-192, `fix/sync-realtime-and-deletion` (Claude)
- [x] E. agent skills, OpenAPI, About snippet, `fix/agent-facing-docs` (worker)
- [x] F. self-host fresh migrations, `fix/self-host-fresh-migrations` (worker)
- [x] G. export message and trash cutoff, `fix/export-and-trash-hardening` (worker)
- [x] All 19 bundle commits stacked on `fix/phase-3-defects` (no conflicts), plus 6 review
      follow-ups. Reviews: a11y clean; pb-sync 0 blocking; adversarial A+B, C+E, F+G found one
      real bug (an unparseable `completed_at` crashed the dashboard) and three tests that passed on
      the old code; all fixed and re-probed against the pre-fix source.
- [x] Final verification on `fix/phase-3-defects`: root 3,435, MCP `test:coverage` 348, typecheck,
      lint, shape, scrubbed build, `quality:bundle`, export journeys 28/28, PocketBase system 6/6.
      Headless check on the built app: dashboard counts and streak, About snippet, and a reminder
      fired and marked on `/dashboard` in full headless Chrome.
- [x] `CONTRACT_MAP.md` rows and a Phase 3 section; `RULE_REVIEWS.json` notes, `.md` regenerated.
- [x] Push and PR: #579 merged 2026-10-06 as `bbdbd88`. The four exit boxes were ticked on
      2026-10-07, after #583 landed the missing commit (see the block above).

Watch on first CI run: `tests/docker-migrations.test.ts` now requires the sqlite3 CLI (it ships on
`ubuntu-24.04`). `/auth/callback` sits 4.4 KB over its recorded first-load size, inside the
5,120-byte allowance, because the app-level timers added about 3.6 KB to every route.

Follow-ups, not this phase: the MCP delete still reads then deletes with no re-read (pre-existing);
update and bulk preflights still compare raw `client_updated_at`, so a blank-stamp record edited by
a non-stamping writer slips through (Phase 4); `lib/archive.ts` and the v15 migration still compare
ISO strings; `navigator.serviceWorker.ready` can hang the checker with no service worker; the
pocketbase-system test still orphans `next dev`; the agent worktrees under `.claude/worktrees/` and
the eight bundle and `worktree-agent-*` branches can go once the PR merges.

Open for Vinny, not blocking: Phase 1's service-worker `Proposed revision:` line.

---

# Session state, 2026-10-05 (evening): modernization Phase 2, security findings

Spec: `tasks/spec-phase2-security.md`. Approved design: brief §3 Phase 2, with
the owner's §7 decisions of 2026-10-05 (sign out everywhere as an explicit
action only, no rotation on account switch; self-host image only; Claude edits
the ruleset).
Branches are cut from `main` @ `5df1fd7`, one per finding.

- [x] SEC-025: PocketBase 0.40.4 in the self-host image, branch `chore/pocketbase-0-40-4` @ `c490af0`.
      System tests 5/5 on 0.40.4 locally; all gates green. Not pushed.
- [x] SEC-002: "Sign out of all devices", branch `feat/sign-out-everywhere` @ `3dc77ff`.
      Owner's second answer: no automatic rotation on account switch; the cross-account error
      points to the action. Hook test, client test (8), UI tests (51), and a system test that
      fails without the route; browser check passed for the 404 and 204 outcomes.
      Deviation: the logout flow moved unchanged into `components/sync/use-logout.ts` so
      `useSyncAuthDialog` stays under its code-shape baseline (it shrank, 96 -> 95 violations).
      Review fixes taken: local-cleanup failure after a revoke, a 401 on an unexpired token,
      `saveNoValidate`, focus to Cancel and back to the trigger, `role="alert"` errors.
- [x] SEC-011: task logs carry ids only; error-logger masks through logger, branch `fix/redact-task-content-logs` @ `5395078`
- [x] SEC-027: `**/.env`, `**/.env.*`, and a root-only `.*` in `.dockerignore`, branch `chore/dockerignore-nested-env` @ `f4b98ce`
- [x] SEC-028: `next` and `eslint-config-next` to 16.3.8, branch `chore/next-16-3-8` @ `e1cf427` (scrubbed build,
      bundle budget, 28/28 export journeys)
- [x] SEC-030: audit before every deploy and publish, branch `ci/audit-before-deploy` @ `2efecfd`; `audit` added to
      `main-protection` required checks via gh api (owner approved)
- [x] Verified each branch and all six merged: root 3,384, MCP 331, typecheck, lint, shape; PocketBase system
      tests 6/6 on 0.40.4 with the revoke hook.
- [x] Pushed all six branches 2026-10-06; the owner asked for one PR, so the six commits are stacked on
      `fix/phase-2-security-findings` (byte-identical to the verified merge).
- [x] PR #578 merged 2026-10-06 as `53418f1` (tree identical to the PR head). On `main`, the new
      "Security audit / audit" job ran inside publish-docker before `publish`, so SEC-030 works.
- [x] All 14 checks on `main` `53418f1` passed. Brief: five of six Phase 2 exit boxes ticked with evidence;
      SEC-002 left unticked with a note, pending the owner's acceptance of its Proposed revision.
- [x] Owner approved 2026-10-06: deleted the six single-finding branches (local and origin) and
      `origin/fix/phase-2-security-findings` after re-verifying each against `main`. Only `main` remains.
- [ ] Phase 3: owner ticks §7. Review delivered 2026-10-06: 15 to fix (4 low priority or optional),
      4 keep, 2 belong in Phase 4; seven proposed PR bundles, streaks first. With the owner's OK the
      brief's §7 now carries 10 Proposed revision lines, 4 notes, and a new Phase 4 item (an unset
      notify_before is stored as 0). Also still open: the extract-rules skip (recommend skip).

Follow-up found (not this phase): `pocketbase-system.test.ts` spawns `bun run dev:e2e` and
kills only the bun process, so `next dev` survives as an orphan and rewrites
`next-env.d.ts` and `tsconfig.json`. Kill the process group (`detached: true`, then
`process.kill(-pid)`). Locally, stop the orphan and `git restore` both files after each run.

---

# Session state, 2026-10-05: modernization Phase 1, pin the hand-kept copies

Spec: `tasks/spec-phase1-pin-copies.md`. Approved design:
`../gsd-modernize/analysis/gsd-taskmanager/MODERNIZATION_BRIEF.md` §3 Phase 1.
Non-trivial tier. Branches are cut from `main` @ `22b83ee`, one per unit. This
file and the spec stayed uncommitted during Phase 1, because the owner's done
criterion was that `git diff main --stat` shows only test and fixture files.
They ride with the next branch, `chore/source-map-js-audit`.

- [x] Pilot: field limits, branch `test/pin-field-limits` @ `e3e934e`. Probe 10/10.
- [x] PocketBase record shape, branch `test/pin-pb-record-shape` @ `457ee75`. Probe 14/14.
- [x] Completion metrics and streaks, branch `test/pin-completion-metrics` @ `e4c626b`. Probe 17/17.
- [x] Service-worker cache rules, branch `test/pin-sw-cache-rules` @ `80489c5`. The existing
      test caught 28/54 single-copy edits; with the new case table, 54/54.
- [x] P0 map: six rules had no pin for their main outcome (002, 003, 093, 191, 265, 272).
      Branch `test/pin-p0-contract` @ `36c5846`. Probe 16/16; existing pins 45/45.
- [x] Verified: both suites, typecheck, and lint green on each branch alone and on all five
      merged (root 3,357 tests, MCP 331). Diffs are test and fixture files only.
      Cross-platform fixtures match gsd-iosapp and gsd-android by SHA-256.
- [x] `CONTRACT_MAP.md` written; brief Phase 1 boxes ticked; one Proposed revision line.
- [x] Handoff: lessons appended to `tasks/lessons.md`.

## Resuming From Here

Done: Phase 1 is built and verified on five branches, one commit each, cut from
`main` @ `22b83ee`, pushed 2026-10-05 as PRs #572 (pilot, `test/pin-field-limits`),
#573 (record shape), #574 (metrics), #575 (service worker), and #576 (P0 pins).
`CONTRACT_MAP.md` and the brief ticks live in
`../gsd-modernize/analysis/gsd-taskmanager/`. The owner deleted the `GH_API`
token; GitHub's `/user` returned 401 for it, and both brief boxes are ticked.

All five merged 2026-10-05, pilot first (#572 = `50a6f0d`, then up to `e4d44c7`).
Local branches cleaned up. Merged `main` passes both suites (root 3,357, MCP 331),
typecheck, and lint.

Audit fix: `main` went red on the Security Audit workflow (GHSA-68fv-2mgg-jv7q,
`source-map-js` below 1.2.2). Branch `chore/source-map-js-audit` adds an
`overrides` floor of `>=1.2.2`, the guard-test pin, and the lockfile bump, made
with bun 1.3.14. The audit checker and the production audit pass locally.

Next: push the chore branch and open its PR once the owner says so. Then Phase 2
(its entry criteria are met: Phase 1 merged, `GH_API` revoked), which first needs
the owner's SEC-002 choice of per-device or all-device sign-out.

Blocked: nothing. The shell still exports the dead `GH_API` value from somewhere
outside the common profile files; the owner may want to remove it.

Assumptions: this file, the spec, and the lessons addition stay uncommitted, so
every branch diff stays test-only. Commit them on a docs branch if wanted.

Pilot findings for the brief (reported to the owner, not edited into §7):
1. MCP writes `notify_before` 0 where the web writes null, so an MCP edit moves a
   web task's reminder to its due time. Pinned in `pb-record-shape.json`.
2. More hand-kept copies: the estimate limit (1 to 10080) as literals in
   `lib/schema.ts` and two MCP files; the 32-character key check in five places;
   the export messages in `settings-body.tsx` and `backup-download.ts`.
3. The SW pair has no MCP side, hence the Proposed revision on exit criterion 2.
4. RULE-270's card contradicts the code on unparseable remote timestamps.

---

# Session state, 2026-09-30: dependency update repair

Branch `chore/deps-update-2026-09-30`, cut from `main` @ `a0c5b48`, carrying the
owner's uncommitted update. Standard tier: the red guard tests are the failing
tests, and the fixes are pins, two workflow files, and one regex.

Diagnosis: `main` was red before the update. PR #565 added `claude.yml` and
`claude-code-review.yml` without top-level `permissions` or explicit
`persist-credentials` (fails `pipeline-workflows.test.ts`, which reds `test` and
`SonarCloud`), and `undici@7.29.0` picked up two high advisories (reds `audit`).
The update then tripped five more guard tests.

- [x] Workflows rebuilt as HEAD plus the new action pins. A YAML formatter had
      rewritten `[a, b]` as `[ a, b ]`, which broke two text guards. All 13 new
      action SHAs match their tags. `SETUP_NODE_22` in `build-config.test.ts`
      now expects `# v7`.
- [x] Claude workflows: top-level `permissions: contents: read` and
      `persist-credentials: false`. claude-code-action replaces the checkout
      credential with its own token (`replaceCheckoutCredentials` in its
      `git-config.ts`), so it does not need the stored one.
- [x] Overrides: `packageManager` held at bun 1.3.14. `undici` 7.29.1,
      `fast-uri` 4.1.5, `ip-address` 10.7.2. Guard pins updated in the same
      commit. `bun audit` went from 16 advisories (2 high) to none.
- [x] Verified in a clean worktree on bun 1.3.14 and Node 22 with
      `bun install --frozen-lockfile`: 3,177 tests passed, 1 skipped; coverage
      89/83/89/90; typecheck, lint, shape, license, audit, build, bundle budget,
      CSP smoke, MCP coverage (308 passed), and 28 of 28 export journeys on
      Chromium.

## Resuming From Here

Done: pushed and opened as PR #568. The version trio is at 13.6.1
(`5cec9af`), bumped at the owner's request.

Next: merge #568 once its checks pass. It turns `main` green again, so it
should merge before other work.

Open decisions, each with the default this branch took:

1. Bun runtime. The update set `packageManager` to 1.4.2; this branch holds
   1.3.14 to match the ten CI setup pins and the guard test. Moving to 1.4.2 is
   its own branch: bump the ten `bun-version` pins, `packageManager`, and
   `security-hardening-scripts.test.ts:374-378` together.
2. Action majors. `deploy-production-release.yml` and `publish-docker.yml` run
   only on a release or a push to `main`. Watch their first run after merge.

Assumptions: the formatter's flow-sequence spacing (`[ main ]`) was unintended,
so the workflows keep the repo's `[main]` style. An editor that formats YAML on
save will reintroduce it and fail the same two guards.

Follow-up, own branch: `tests/data/service-worker-privacy.test.ts` "deletes
legacy capture entries" fails on Node 24.18 and 26.10 and passes on Node 22.
`engines.node` lists all three lines as supported.

---

# Session state, 2026-09-28: remove Sentry

Branch `claude/remove-sentry-nbj60e`, cut from `main` @ `aca6a90`. Non-trivial
tier by file count, run without a spec gate because the request ("remove
Sentry") is unambiguous and the owner was not in the loop.

- [x] Red: `security-hardening-scripts` asserts both SDKs are gone;
      `security-headers-policy` asserts `connect-src` has no Sentry origin.
- [x] Green: deleted `lib/sentry.ts`, `lib/sentry-safe-keys.ts`,
      `components/sentry-init.tsx`, `packages/mcp-server/src/utils/sentry.ts`
      and their tests; stripped forwarding from both loggers, `error-logger`,
      `global-error`, and the MCP entry point; removed the CSP origin from
      `app/layout.tsx`, the CloudFront policy, and `SECURITY.md`.
- [x] Docs: ADR 0017, trust-boundary row, architecture table, MCP README and
      Unreleased changelog entry, `.env.example`.
- [x] Version trio bumped to 13.6.0 (the export changes). MCP version left for
      the release flow.

## Resuming From Here

Next: open the PR. Follow-ups, each on its own branch: regenerate
`docs/diagrams/architecture.html` without the Sentry node (needs the
diagram-design geometry checker), and refresh `scripts/bundle-budget.json`
after a build now that the browser SDK is out of first-load JS.

---

# Session state, 2026-09-27: Vitest 5 migration

Branch `chore/vitest-5-migration`, cut from `main` @ `243950e`. Non-trivial tier;
the owner approved design decisions D1 to D5 in `tasks/spec-vitest-5-migration.md`.

- [x] Discovery: Vitest 5 fails 57 tests (jsdom's getter-only `navigator`) and drops
      `lib/sync/sync-provider.tsx` from coverage (exact glob matching). CI's runner
      ships Node 22.23.2, above Vitest 5's 22.12 floor.
- [x] Red confirmed, then 16 `navigator` writes moved to `vi.stubGlobal` with
      `vi.unstubAllGlobals()` in `afterEach`. Added `lib/**/*.tsx` to coverage.
- [x] Verified: 3,193 passed under Node 22 (same as Vitest 4), identical 269-file
      coverage set, typecheck, lint, shape, build, license, audit, and the MCP suite
      on its own Vitest 4.1.11.
- [x] Review follow-up (Codex, PR thread): `engines.node` set to jsdom's
      `^22.22.2 || ^24.15.0 || >=26.0.0`, README lists Node, and the three Vitest CI
      jobs pin Node 22. CI then caught MCP `test:coverage` borrowing the root's v5
      coverage provider; MCP now declares its own `@vitest/coverage-v8@4.1.11`.
- [x] PR #564 merged as `aca6a90`. Local branch deleted after an empty diff against
      `main`. No version bump: nothing here reaches `out/`.

## Resuming From Here

Up next, saved by the owner for the next session. One branch each, in any order.

1. **Move `packages/mcp-server` to Vitest 5.** Bump `vitest`, `@vitest/ui`, and
   `@vitest/coverage-v8` together (all 4.1.11 in `packages/mcp-server/package.json`).
   Update the pins in `tests/data/security-hardening-scripts.test.ts:358-359` in
   the same commit; `build-config.test.ts` already requires runner and provider to
   match. Before bumping, capture MCP's `coverage-summary.json` keys, then diff them
   after, because Vitest 5 matches coverage globs exactly. Also check the
   `clearMocks: true` default, hoisted `vi.mock` enforcement, and `test:ui`, which
   now needs the token URL Vitest prints. Verify with
   `bun run --cwd packages/mcp-server test:coverage`, the command CI and SonarCloud run.
2. **Clear the `__dirname` warning in `vitest.config.ts`.** Vite flags
   `path.resolve(__dirname, ".")` at `vitest.config.ts:66` as unsupported by
   `configLoader: 'native'`; use `import.meta.dirname`. Done means the warning is
   gone from `bun run test` output and the `@/` alias still resolves (the full suite
   passes). Leave `next.config.ts:17` alone: `build-config.test.ts` pins
   `turbopack: { root: __dirname }`, and that file is Next's, not Vite's.
3. **Retry jsdom 30.1.1 or newer.** Held at 30.0.1 because 30.1.1 leaves
   `color: var(--error-ink)` unresolved in computed styles, failing
   `tests/ui/global-error.test.tsx:71`. The component is correct in browsers. Check
   the newest jsdom first; if it still fails, choose between keeping the hold and
   changing how the test reads the color. A jsdom bump can change its
   `engines.node`, and `build-config.test.ts` requires the root `engines.node` to
   match it, so update `package.json` engines and the README floor
   (`documentation-currentness.test.ts`) in the same commit.

---

# Session state, 2026-09-26: `bun update --latest` repair

Branch `chore/deps-update-2026-09-26`, cut from `main` @ `7a7ddcf`. Standard
tier: `package.json`, `bun.lock`, the version trio, and three test files.

- [x] Root causes, each bisected in a clean worktree: `zod` 4.6.5 against
      stagehand's exact 4.4.3 pin (the build's type errors), `typescript` 7
      (typescript-eslint crashes), `vitest` 5 (`navigator` is getter-only, 57
      tests), and `jsdom` 30.1.1 (`var()` unresolved in computed `color`).
- [x] Held those four back and kept every other update.
- [x] Fixed the EditDrawer autofocus race in four tests. The new package mix
      exposed it.
- [x] Clean frozen install: typecheck, lint, shape, build, bundle budget, license,
      MCP tests, and the full suite with coverage under Node 22 all pass.

## Resuming From Here

Next: the owner runs a clean reinstall (`rm -rf node_modules && bun install`).
The local tree mixes 28 stale bun isolated-store symlinks into a hoisted layout,
so it loads two copies of React and Dexie. Then push and open the PR on approval.

Later, each on its own branch: migrate to vitest 5 (`vi.stubGlobal` for
`navigator`), revisit jsdom 30.1.1, and drop the zod pin once stagehand widens
its range. The `service-worker-privacy` failure is local to Node 26 and predates
this work.

---

# Session state, 2026-09-20: SyncProvider idle polling

Branch `fix/sync-provider-idle-polling` @ `fffaa29`, PR #558. Standard tier: one
source file, one new test file, no change to the `SyncState` shape.

- [x] Root cause confirmed in code: the 500 ms status poll had no enabled check
      (three IndexedDB reads per tick), and the reducer spread a new state object
      for every polled action, so each tick re-rendered every `useSync()` consumer.
- [x] Red tests, then the fix: poll only while `isEnabled || isSyncing ||
      pendingRequests > 0`, and `mergeIfChanged` in the reducer.
- [x] `pb-sync-reviewer` caught a lockout in my first version (sign-out during a
      running sync left `isSyncing` stuck on). Reproduced red, then fixed.
- [x] Measured on the production export: 65 `syncMetadata` reads per 10 idle
      seconds before, 5 after. Full suite, lint, typecheck, shape, bundle budget,
      and 21 sync e2e specs are green.

## Resuming From Here

Next: the owner merges #558, then sync `main` and delete the branch after the
verified check. Check every workflow on `main` after the merge.

Still open, out of scope here: the 2-second enabled check still polls, and an
enabled but idle provider still does three reads per tick. Both want an event from
the coordinator or a cross-tab signal. `lib/use-shell-command-handlers.ts:150`
still hardcodes `isSyncEnabled: false`.

No version bump: the owner's 13.5.0 bump is uncommitted in `package.json`.

---

# Session state, 2026-09-19: audit remediation (TST-1, SEC-1, E2E-1, PRF-1)

Four findings from the audit report below, one branch each. All four are
implemented, verified, and committed.

- [x] `TST-1`, PR #552, `fix/mcp-setup-require-crash`. Top-level `node:readline`
      import, a compiled-output smoke test, MCP 1.2.7 with a changelog entry.
- [x] `SEC-1`, PR #553, `docs/security-hosted-encryption-posture`. `SECURITY.md`
      separates the hosted service from the Docker image, ADR 0016 records the
      deferral, and a guard test pins the wording.
- [x] `E2E-1`, PR #554, `test/e2e-static-export` @ `cb9fc85`. Shared static export
      server, `playwright.export.config.ts`, 28 journeys, a CI step per browser
      leg. 84 of 84 pass on the built export. Spec appended to `tasks/spec.md`.
- [x] `PRF-1`, PR #555, `perf/bundle-budget-and-splits` @ `c5fe320`. CI byte
      budget, react-query scoped to two routes, confetti loaded on first use. `/`
      drops 11.6 KB of first-load gzip. Spec in `tasks/spec-bundle-budget.md`.

All four PRs were fully green in CI on 2026-09-19. Both new gates ran on the
Linux runners: the export journeys passed on Chromium, Firefox, and WebKit, and
the bundle budget held against the macOS baseline.

## Resuming From Here

Next, in order:

1. Done 2026-09-19: the owner merged #552, #553, #554, and #555. `main` is at
   `5a5885c`, and the four local branches are deleted after a verified check.
2. Done 2026-09-20: the owner merged PR #556. #554 had broken
   `Publish Docker Image` on `main` (`next build` in the image type-checks root
   TypeScript files, `.dockerignore` drops `tests/`, and
   `playwright.export.config.ts` imports from there). `main` @ `52c7bc3` is fully
   green, and the Docker publish passed there, which confirms the fix.
3. Done 2026-09-20: annotated tag `mcp-v1.2.7` on the #552 merge commit
   `46a6f5c`. The owner approved publish run 35510138936 (the `mcp-release`
   environment requires that approval in the GitHub UI), and it succeeded. npm
   serves 1.2.7 with SLSA provenance. Verified from real installs: 1.2.6
   `--setup` prints "Setup failed." with no prompt, and 1.2.7 shows the prompt
   and reaches the URL safety gate. Trap found on the way: `node -e` leaks a
   global `require`, so it hides this bug. Use `--input-type=module` or a `.mjs`
   entry, and run the known-bad version as a control.
4. Done 2026-09-20: the owner merged PR #557. `main` @ `7be37e3` is fully green
   (CI, Security Audit, SonarCloud, Publish Docker Image). The four install pins
   read 1.2.7. PR #552's "How to test" text now uses `node --input-type=module -e`.
   All six local branches from this work are deleted after a verified check.

This remediation is complete. What remains belongs to the owner:

- Done 2026-09-20: the owner deleted `tasks/implementation-notes.md`. Its content
  lives in `tasks/lessons.md`.
- The pinned `public/index.md` and the MCP server card reach `gsd.vinny.dev` with
  the next production deploy. npm and the GitHub README already show 1.2.7.
- The uncommitted 13.5.0 bump in `package.json` still needs `README.md:7` and
  `public/sw.js:3` to match before `documentation-currentness.test.ts` passes
  locally.

CI miss worth remembering: #554's first run failed `test`. A guard in
`tests/data/e2e-quality-gates.test.ts` pins the literal text of the e2e fixture's
font allowlist, and widening the allowlist broke the pin. Targeted tests passed
locally, and the full suite would have caught it. Fixed in `cb9fc85`.

Root suite on the PRF-1 branch: 3,175 passed, 2 failed. Both failures predate
this work: the uncommitted 13.5.0 bump against `README.md:7`, and the local-only
`service-worker-privacy` test.

Merge notes: the E2E-1 and PRF-1 branches both edit `ci.yml`, `package.json`, and
`CLAUDE.md`, in different places. `tasks/lessons.md` gets an end-of-file section
from E2E-1 and a mid-file addition from PRF-1, so neither should conflict.

Assumptions: the ADR 0016 rationale is reconstructed from project notes, so the
owner should read it before merging #553. `bun.lock` still records the MCP
workspace at 1.2.6, the same as after the 1.2.6 release commit.

Follow-ups found and left out of scope:

- `SyncProvider` polls the sync coordinator every 500 ms with an IndexedDB read,
  signed in or not (`lib/sync/sync-provider.tsx:254-261`).
- `lib/use-shell-command-handlers.ts:150` hardcodes `isSyncEnabled: false`, so the
  palette's sync commands never appear.
- The sync stack split: about 40 KB, four static import paths, one through the
  task write path. Its own PR with `pb-sync-reviewer` if wanted.
- Infra, outside this repo: the one EC2 instance these AWS credentials can see
  (`NewWebServer`, us-east-1) has an unencrypted EBS volume, and EBS encryption by
  default is off. Unconfirmed whether it serves `api.vinny.io` (52.22.29.139).

---

# Session state, 2026-09-19: codebase audit report

Branch: `main`, at `6a71a65`. Report only, no code changes. Left uncommitted at
the owner's request.

- [x] Phase 1: measured evidence, five read-only subagents, findings list approved.
- [x] Phase 2: rendered `docs/codebase-analysis-report.html` and the shipped copy
      at `public/docs/codebase-analysis-report.html`. The two files are identical.
- [x] Verified: tests that read the report pass, the build externalizes its inline
      assets, and it loads under the production CSP with no violations.

## Resuming From Here

The report scores the codebase 7 of 10 with 43 findings: 2 High, 22 Medium, and
19 Low. Both High findings are small fixes.

- `TST-1`: `gsd-mcp-server --setup` crashes. `packages/mcp-server/src/cli/index.ts:99`
  calls a bare `require` inside an ESM package. The bug is in tag `mcp-v1.2.6`.
- `SEC-1`: `SECURITY.md:79-82` says task content is encrypted at rest. Production
  runs the PocketBase CLI on EC2, so the Docker key guard never runs there.

Next: the report's 30-day list. Start with the two High findings, then `STD-1`
(both #549 and #550 merged with `lint` red through the `--admin` bypass).

Blockers: none. Four files are uncommitted on `main`: the two report copies, plus
the owner's own `package.json` bump to 13.5.0 and `bun.lock`. That bump fails
`documentation-currentness.test.ts` until `README.md:7` and `public/sw.js:3` match.

Assumption: `SEC-1` rates High on the owner's statement that production is not
Docker. It drops to Low if the EC2 host loads the encryption hooks with the key.

Nothing regenerates the shipped report on release (finding `DOC-3`).

---

# Session state, 2026-09-19: copy Cloud Sync auth token

Branch: `feat/copy-cloud-sync-token`. Standard tier; approved design and full
verification evidence in `tasks/spec-cloud-sync-auth-token.md`.

- [x] Spec and implementation plan recorded from the approved design.
- [x] Red: focused clipboard/auth lifecycle tests fail before implementation.
- [x] Green: add Settings row and update MCP setup/recovery guidance.
- [x] Verify unit/MCP tests, coverage, typecheck, lint, running browser and independent review.
- [x] Commit the verified implementation on the feature branch.

## Resuming From Here

Implementation complete locally. Copy auth token is under Settings → Cloud Sync,
with fresh-token checks, clipboard feedback and updated MCP instructions.
Chromium and WebKit checks pass with synthetic auth. Firefox could not launch
because its temporary profile was missing. Independent review found no issues.

Full suite: 3,162 passed, 1 skipped, 2 pre-existing failures (README release text,
service-worker capture cache). Existing pwa-register code-shape debt also fails.
All reproduced at unchanged HEAD; the token-copy tests, lint and typecheck pass.
MCP: 319 passed, 4 skipped, build and coverage pass. New UI component: 95.45%
statement coverage.

Follow-up: user authorized bump/commit/push/PR. App, README and tracked SW version
are 13.1.5; 28 focused release checks, lint, typecheck and production static build
pass. The README failure above is now resolved. Baseline service-worker privacy
and pwa-register shape failures remain. Publishing this branch does not deploy it.

---

# Session state, 2026-09-15 (proxy-addr advisory, AIKIDO-2026-101201)

Branch: `fix/proxy-addr-floor`, cut from `main` @ `49b543c`. Standard tier: three
files, no interface change.

Aikido flagged `proxy-addr` 2.0.7 (GHSA-jqcg-44mw-7w3h, CVE-2026-90711), reached
through the `@modelcontextprotocol/sdk` dependency on `express`. The MCP server
runs over stdio and never configures `trust proxy`, so nothing here is reachable.
The fix is lockfile hygiene so Aikido and the Security Audit workflow stay green.

The `public/sw.js` edit in the tree (13.1.1) is the build artifact of deploying
13.1.0 and stays unstaged. The pre-existing `bun update` churn in `bun.lock` was
set aside (copy in the session scratchpad) so this lock diff is proxy-addr only.
`bun update` regenerates that churn on demand.

## Plan

- [x] 1. Red: assert `overrides['proxy-addr'] === '>=2.0.8'` in
      `tests/data/security-hardening-scripts.test.ts`.
- [x] 2. Green: add the floor to root `package.json`, then `bun install`. The lock
      moves proxy-addr from 2.0.7 to 2.0.8 and nothing else.
- [x] 3. Gates: guard test, `bun install --frozen-lockfile`, `bun audit`,
      `bun run test`, `bun typecheck`, `bun lint`, `bun run build`.
- [ ] 4. Commit, push, PR, merge, fast-forward main, delete branch.

## Resuming From Here

- Done: steps 1 to 3. All gates green except the known local-only
  `service-worker-privacy` failure ("deletes legacy capture entries"), which fails
  identically against main's committed `sw.js` while CI on main @ `49b543c` is green.
- Next: push `fix/proxy-addr-floor`, open the PR, watch `gh pr checks`, merge with
  `gh pr merge --squash --admin`, fast-forward main, delete the branch.
- Note: `bun audit` and GitHub's advisory GraphQL had not ingested the CVE on
  2026-09-15; Aikido was first. The upstream HISTORY.md and the repo's
  `security-advisories` endpoint confirmed 2.0.8 as the patched release.
- Assumption: no version trio bump, matching PR #536 (a dependency-only fix that
  changes neither the shipped web bundle nor the MCP package).
