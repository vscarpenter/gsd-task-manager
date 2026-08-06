# Rescan High and Medium Remediation

## Goal

Resolve the current rescan's one High and eight Medium findings with executable
regression gates, while preserving the user's inherited worktree and avoiding
production data or Git-history mutations.

## Approved inputs

- The 2026-08-05 rescan report in `docs/codebase-analysis-report.html`.
- The user's approval to resolve its one High and eight Medium findings.
- The user's live verification that `api.vinny.io` runs PocketBase 0.39.10.

## Outputs

1. **BUILD-01:** a fail-closed static build wrapper whose pipeline preserves the
   `next build` exit status and whose success requires the exported app shell.
2. **SEC-04:** a blocking, pinned Gitleaks CI gate that scans the repository's
   full Git history against a fingerprint-only baseline for already-known
   findings. New secret material must fail the gate.
3. **TEST-03:** a disposable, authenticated PocketBase system test that proves
   two-user owner isolation, MCP write/read and principal switching, realtime
   delivery, encrypted-at-rest task content, and a real 0.26.6-to-0.39.10 data
   upgrade without mutating production.
4. **DEP-02:** local Docker and verification assets aligned to PocketBase
   0.39.10 and its official Linux amd64/arm64 checksums.
5. **HYD-01:** deterministic server/client initial markup for the matrix intro's
   “Show Schedule” control.
6. **E2E-04:** automatic Playwright failure on browser `pageerror` and unexpected
   `console.error`, plus a stable webpack-backed E2E development server.
7. **ARCH-01:** a schema-bound, typed MCP tool registry replacing the monolithic
   switch and removing the dispatcher's `any` cast.
8. **MAINT-01:** a production code-shape baseline and per-file ratchet for
   complexity, function length, file length, and nesting depth.
9. **E2E-03:** no fixed `page.waitForTimeout` sleeps in the Playwright suite;
   waits must observe user-visible or application state.

## Constraints

- Preserve and do not stage inherited changes to `coding-standards.md`,
  `docs/codebase-analysis-report.html`, and `public/sw.js`.
- Preserve all existing stashes.
- Do not connect the system test to `api.vinny.io`; it must own a disposable
  local PocketBase process and temporary data directory.
- Do not print or commit secret values. The Gitleaks baseline may contain only
  finding fingerprints, not matched content.
- Do not rewrite or force-push Git history without separate explicit approval.
- Preserve archived-task tombstone behavior, sync owner scoping, and existing
  MCP response contracts.
- Do not redesign the matrix intro; the UI change is hydration behavior only.
- Use TDD, explicit-path staging, logical commits, and checkpoint updates.

## Edge cases

- A failing `next build` can still produce output consumed by `grep`; the
  wrapper must return the build's non-zero status.
- A successful build command without `out/index.html` is not a successful
  static export.
- The historical secret baseline must not hide a new occurrence of the same
  rule or reveal the matched secret.
- PocketBase may start slowly or choose a dynamic port; the harness must poll
  readiness with a deadline and always terminate the child process.
- The migration sequence must be safe on a fresh database and preserve task
  IDs, owners, created/client timestamps, structured fields, and encrypted
  content when an existing 0.26.6 data directory is opened by 0.39.10. The
  forward remediation must not further mutate the server `updated` timestamp
  established by the already-shipped legacy migration.
- Owner isolation must be proved in both collection reads and realtime events;
  a second authenticated user cannot observe the first user's task.
- MCP client and cache state must not survive a backend or auth-token switch;
  one principal cannot receive another principal's cached list response.
- The intro server snapshot must not derive browser-only mounted state or local
  IndexedDB task counts.
- Expected test diagnostics must remain distinguishable from unexpected
  browser runtime failures.
- MCP schema and handler keys must be exhaustive so adding a tool cannot update
  only one side silently.
- The maintainability ratchet must permit improvement while rejecting any new
  or increased per-file violation.

## Acceptance criteria

- Controlled shell tests prove build-command failure propagation and missing-
  artifact failure; the real production build succeeds.
- Gitleaks scans the full repository history with no unbaselined findings, and
  workflow YAML/config tests prove the gate is pinned and blocking.
- Docker metadata, documentation, and verification scripts agree on
  PocketBase 0.39.10; both architecture checksums match the official release.
- A server-render regression test proves “Show Schedule” is disabled before
  mount, and normal UI tests prove it becomes usable after client data loads.
- Playwright's shared fixture reports browser page errors and unexpected error
  console messages; repository quality tests reject fixed sleeps.
- MCP unit tests pass with the typed registry, invalid tool names still return
  the established error, and the dispatcher no longer contains `as any` or a
  tool-name switch.
- The code-shape check passes against a committed baseline and its unit tests
  prove per-file regressions fail while improvements pass.
- The disposable PocketBase system tests prove authenticated MCP creation,
  owner isolation, realtime delivery, cache isolation across auth switches,
  a preserved 0.26.6-to-0.39.10 upgrade, and absence of plaintext task content
  in the database files after migration cleanup.
- Root and MCP tests/coverage, typecheck, lint, code-shape, MCP build,
  production build, secret scan, and three-browser Playwright verification pass.

## Out of scope

- Rewriting or force-pushing shared Git history to erase the expired historical
  JWT. That destructive cleanup requires separate approval and coordination.
- Production writes, production schema changes, or live OAuth-provider tests.
- Refactoring every legacy long or complex function in one pass; the approved
  closure is an enforced baseline/ratchet plus the dispatcher refactor.
- Deployment, push, pull request, merge, or rescan publication.

## Test stubs

- `tests/data/build-config.test.ts`: failing build, missing artifact, and package
  delegation contracts.
- `tests/data/security-hardening-scripts.test.ts`: Gitleaks gate and PocketBase
  release/checksum alignment.
- `tests/ui/matrix-simplified.test.tsx`: server snapshot disables the Q2 action
  until mounted task data is available.
- `tests/data/e2e-quality-gates.test.ts`: automatic runtime error fixture,
  webpack E2E server, and zero fixed sleeps.
- MCP dispatcher tests: exhaustive registry, validation, handler routing, and
  unknown-tool behavior.
- Code-shape checker tests: new per-file violation fails; reduced count passes.
- PocketBase system test: two users, MCP create, isolated list/realtime, and
  encrypted SQLite evidence.
