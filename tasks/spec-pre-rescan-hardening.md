# Pre-rescan Hardening

> **Status, 2026-11-12.** Shipped in PR #469 (`0040ba71`, 2026-08-07). The results live in `packages/mcp-server/src/tools/handlers/system-handlers.ts` (redacted diagnostics), `components/matrix-simplified/task-actions.ts` (mutation error reporting), and `components/matrix-simplified/edit-drawer-fields.tsx` (named groups). `tests/data/security-hardening-scripts.test.ts` guards the Bun pin and the doc references. Two things have changed since. The Violet Frost theme is retired, and tokens now live in `app/css/inkwell-tokens.css`. The trust-boundary document is `docs/security-trust-boundaries.md`.

## Goal

Resolve the five approved follow-up issues before establishing a new audit
baseline: create an immutable scan target, redact MCP diagnostics, preserve task
mutation errors, correct composite form semantics, and remove deterministic
tooling/lint/documentation findings.

## Inputs and outputs

- Input: the completed top-five audit remediation plus the 2026-08-05
  pre-rescan review.
- Output: one explicitly scoped commit on
  `codex/resolve-pre-rescan-issues` that can be checked out into a clean
  worktree and rescanned reproducibly.

## Constraints

- Preserve inherited changes to `coding-standards.md`,
  `docs/codebase-analysis-report.html`, and `public/sw.js`; do not stage them.
- Keep MCP diagnostic output useful without exposing configured hosts,
  credentials, paths, query strings, or raw backend error messages.
- Keep the existing generic mutation-failure toasts while routing every caught
  error through structured logging with action and non-content task IDs only.
- Preserve the edit drawer's visual hierarchy and Violet Frost tokens; change
  only invalid label/group semantics and behavior required for accessibility.
- Pin the repository and GitHub workflows to Bun 1.3.14, matching the verified
  local runtime.
- Use explicit staging paths and do not push.

## Edge cases

- A PocketBase URL may contain credentials, a port, a path, query parameters,
  and a fragment; none may enter an MCP response.
- Backend exceptions may themselves repeat the private URL; validation output
  must not echo raw exception messages.
- Initial load or remote sync may render a completed task without triggering a
  local completion animation.
- Quadrant, due-date, tag, and dependency composites contain multiple
  interactive descendants and must not render as HTML labels.
- Generated coverage exists at both root and nested workspace paths and must be
  excluded from lint.

## Out of scope

- PocketBase version migration, live-backend contract testing, CSP redesign,
  broad action/container digest pinning, architecture refactors, and replacing
  all Playwright fixed waits.
- Push, pull request, deployment, or the actual rescan.

## Acceptance criteria

- A clean worktree can be created from the remediation commit without ignored
  local secrets, coverage, build, or scan artifacts.
- `validate_config` identifies connectivity without returning the configured
  PocketBase host or raw backend exception text.
- Capture, toggle, delete, and create/edit mutation failures are structured-log
  events and retain generic user-facing error toasts.
- Composite edit-drawer fields expose named group semantics; simple controls
  retain native label association.
- Completion animation runs after a successful local completion and not on
  initial/external completion state.
- All workflow Bun setup steps and `packageManager` use Bun 1.3.14; the package
  audit command uses Bun directly.
- Lint reports zero warnings, including when nested coverage artifacts exist.
- Documentation no longer references the absent `.blume` trust-boundary file.

## Test stubs

- MCP system handler: success and failure diagnostics with a credentialed
  private endpoint.
- Edit drawer fields: accessible named groups and absence of interactive
  descendants inside labels.
- Matrix: each mutation error reaches structured logging with the right action.
- Task card header: no animation for initial/external completion; animation
  after successful local completion.
- Repository hardening: Bun pin, direct audit command, nested coverage ignore,
  zero-warning lint command, and valid security documentation references.
