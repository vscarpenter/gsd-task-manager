# Spec: react-doctor score 100 (drive diagnostics to zero)

## Goal
Run `npx react-doctor@latest` and fix issues until the score is 100. A score of
100 corresponds to zero counted diagnostics. The score API host (www.react.doctor)
is blocked by this environment's egress policy, so success is verified locally:
the default scan reports `TOTAL: 0`.

## Inputs / Outputs
- Input: current repo (baseline 374 diagnostics: 42 errors, 332 warnings, 117 files).
- Output: repo where `react-doctor --json` reports 0 diagnostics; tests, typecheck,
  and lint stay green; app behavior unchanged.

## Constraints
- Fix the underlying code. No inline rule suppressions to mask real issues.
- TDD for any behavior change (red/green/refactor).
- React Compiler is ON (next.config `reactCompiler: true`) — manual memoization
  removals are safe.
- Preserve all existing behavior; keep tests/typecheck/lint green between batches.

## Out of scope
- Changing react-doctor rule severities to hide real findings.

## Confirmed false positives → doctor.config ignore (evidence-based)
Files that are genuine non-importable runtime entry points or intentional published
artifacts, where unused-file / public-debug-artifact / no-dynamic-import-path do not apply:
- public/sw.js, public/sw-cache-logic.js — service worker (registered, not imported;
  sw.js is generated/version-stamped). Real cache logic graded via lib/sw-cache-logic.ts.
- cloudfront-function-*.cjs — CloudFront edge functions (deployed via script, not imported).
- docker/** — PocketBase server hooks/migrations (separate JS runtime; `require(${__hooks}/..)`
  is PB's required idiom inside isolated VM contexts).
- public/docs/** — HTML report intentionally linked from the About page.

## Acceptance criteria
- [ ] `react-doctor --json` => totalDiagnosticCount 0
- [ ] `bun run test` passes
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes
