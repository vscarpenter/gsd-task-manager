# Audit Findings Remediation — 2026-08-10

## Goal

Resolve the four Medium and fourteen Low findings from the 2026-08-06
codebase analysis, prove each closure against the current `main` tree, and
refresh the canonical report from fresh verification evidence.

## Approved inputs

- The user's request to resolve all four Medium and fourteen Low findings.
- The accepted 2026-08-06 audit report and its evidence-backed recommendations.
- Current `main` at `0040ba7` as the implementation baseline.

## Outputs

1. A deterministic Playwright navigation signal for the Chromium sync-state
   failures, with a regression loop that passes under the configuration that
   previously exposed the race.
2. A disposable live browser-to-PocketBase system path covering authentication,
   push/pull, realtime owner isolation, token renewal, and archive/tombstone
   behavior without contacting production.
3. A code-shape gate whose remaining exception state no longer qualifies as
   Medium unmanaged debt, backed by focused refactors and an explicit burn-down
   contract.
4. Blocking root coverage, scheduled/release Firefox and WebKit coverage, and
   path-specific MCP write-operation coverage.
5. Stronger CSP delivery, immutable CI/container selectors, automated license
   policy/SBOM evidence, refreshed dependencies/browser data, and an audit-clean
   installed graph.
6. Typed interop boundaries, broken type-only cycles, measured faster safe MCP
   bulk writes, current README/security/trust-boundary/contribution docs, and a
   quiet Next.js smooth-scroll runtime.
7. An explicit, evidence-backed resolution of the historical expired token
   within the authority boundary below.
8. A fresh rescan and updated `docs/codebase-analysis-report.html`.

## Finding ledger

### Medium

- E2E-06 — Chromium full-suite navigation nondeterminism.
- TEST-06 — no live browser sync/realtime/token-lifecycle system path.
- SEC-04 — expired credential and identity claims remain in Git history.
- MAINT-01 — large code-shape exception baseline.

### Low

- TEST-04 — root coverage is not fail-closed in CI.
- TEST-05 — blocking CI covers Chromium only.
- TEST-07 — MCP write-operation coverage is below the project floor.
- SEC-03 — production CSP permits inline scripts and styles.
- DEP-04 — no automated license-policy gate or SBOM evidence.
- CFG-02 — mutable action, runner, and container selectors.
- TYPE-01 — three unjustified `any` occurrences.
- ARCH-02 — three type-level dependency cycles.
- PERF-01 — linear/throttled MCP bulk-write latency.
- DEP-05 — actionable direct dependencies are behind current releases.
- DEP-06 — stale browser compatibility data.
- DOC-01 — README version and feature claims are stale.
- DOC-02 — security/trust-boundary/contribution guidance has drifted.
- OBS-01 — smooth-scroll diagnostics pollute E2E output.

## Constraints

- Preserve the three existing stashes.
- Preserve the inherited `bun.lock` Vite 8.2.1 resolution change; dependency
  remediation may build on it but must not silently discard it.
- Never connect tests to `api.vinny.io` or mutate production data/configuration.
- Preserve PocketBase owner scoping, encryption, MCP response contracts, and
  the `archivedTasks` conditional tombstone invariant.
- Use TDD for behavior changes and keep each diagnostic hypothesis falsifiable.
- Pin only verified official action commits and container digests.
- Do not weaken `coding-standards.md`, coverage thresholds, security headers,
  or scanning policy to make a finding disappear.
- Do not rewrite shared Git history, force-push, or delete branches without a
  separate explicit confirmation naming that destructive action.
- Do not deploy, push, merge, or mutate external systems unless separately
  requested.

## Edge cases

- A focused E2E pass must not be used to relabel a failed canonical run green.
- Local and CI worker/server-reuse differences must be tested independently.
- Browser system tests must prove two-principal isolation for collection reads
  and realtime events, not merely successful authentication.
- Token refresh must exercise the browser PocketBase SDK state rather than a
  raw REST-only substitute.
- An archive tombstone must suppress stale remote resurrection while allowing a
  newer remote edit to win.
- CSP changes must preserve Next static-export hydration and PWA boot in every
  supported browser.
- License findings are policy/inventory engineering, not legal conclusions;
  reviewed exceptions must be explicit and minimal.
- Dependency updates must preserve the intentional root TypeScript 6 compiler-
  API / native TypeScript 7 CLI split.
- Bulk optimization must retain fresh conflict preflights, deterministic result
  ordering, bounded load, retry behavior, and partial-failure reporting.
- Historical-secret cleanup is not complete merely because the token is expired
  or allowlisted; any retained-risk resolution must be explicit in the report.

## Acceptance criteria

- Every ledger item has a source/config/test change or a clearly documented
  external/manual gate, plus fresh verification evidence.
- Root and MCP coverage commands pass their configured thresholds; MCP write
  operations meet the new targeted floor.
- Root CI coverage is blocking and Firefox/WebKit run in a defined blocking or
  scheduled/release lane with retained artifacts.
- The disposable PocketBase browser system test passes without production
  credentials and proves the required auth/sync/realtime/tombstone paths.
- Code-shape analysis reports a materially reduced baseline and enforces an
  approved zero-regression/burn-down deadline; targeted highest-risk functions
  meet the 40-line/complexity constraints after refactor.
- CSP smoke tests prove the static export boots with the tightened policy.
- License, action-pin, container-digest, dependency, and browser-data checks are
  reproducible and pass in CI.
- README, SECURITY, trust-boundary, and CONTRIBUTING guidance match the shipped
  v11.2.1 product and current commands.
- Typecheck, lint, root/MCP tests, PocketBase system tests, MCP build, production
  build, Bun audit, Gitleaks, shell/YAML checks, and three-browser Playwright pass.
- Required accessibility and PocketBase/sync specialist reviews report no
  unresolved blocking findings.
- The canonical report is refreshed with only verified residual findings.

## Test stubs

- Stress/repeat Playwright loop for `sync-states.spec.ts` under clean and reused
  server modes and multiple workers.
- Browser PocketBase system project with two users and live SSE.
- CI/config tests for blocking coverage, browser matrix, action pins, digests,
  license policy, CSP generation, and browser-data freshness.
- MCP write-operation conflict, partial-failure, cache invalidation, retry, and
  bounded-concurrency tests.
- Unit/config tests for shared type leaf modules, Navigator standalone typing,
  documentation/version contracts, and code-shape baseline reduction.

## Out of scope

- New product features or UI redesign.
- Production deployment or production OAuth-provider testing.
- A shared-history rewrite or force-push until separately confirmed.
