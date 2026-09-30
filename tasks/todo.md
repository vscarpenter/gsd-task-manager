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
