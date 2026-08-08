# Top Five Audit Risks Remediation

## Goal

Resolve the five risks ranked highest in `docs/codebase-analysis-report.html`:
SEC-01, TEST-01, TEST-02, DEP-01, and CFG-01.

## Inputs and outputs

- Input: the 2026-08-05 audit evidence and the current repository state.
- Output: truthful security and coverage gates, a stable blocking Chromium E2E
  gate, an audit-clean installed dependency graph, and strict validation of
  remote client timestamps.

## Constraints

- Preserve the local-first product behavior and PocketBase LWW/tombstone rules.
- Use behavior-first tests for logic changes and current executable evidence for
  workflow and dependency changes.
- Do not modify or revert the inherited `coding-standards.md`,
  `docs/codebase-analysis-report.html`, or `public/sw.js` edits.
- Do not weaken coverage thresholds or exclude production code to make a gate
  pass.
- Keep Firefox and WebKit visible locally, but make Chromium the initial
  blocking CI browser as recommended by the audit.

## Edge cases

- Missing, empty, malformed, or structurally invalid Bun audit JSON must fail
  closed rather than be treated as a clean result.
- A clean audit document and one containing only below-threshold advisories must
  pass the High/Critical gate.
- E2E cleanup must fail if IndexedDB deletion is blocked or errors.
- Remote timestamps must include a timezone offset and represent real dates;
  future-skew clamping still applies after validation.

## Out of scope

- Live PocketBase integration coverage, Firefox/WebKit as blocking CI gates,
  broad dependency modernization, and unrelated audit findings.

## Acceptance criteria

- The security workflow parses one captured JSON result and fails for any High
  or Critical advisory or invalid audit evidence.
- The Chromium E2E suite passes and runs in PR/main CI with failure artifacts.
- MCP coverage meets its existing 80/75/80/80 thresholds and blocks CI.
- `bun audit` reports no installed advisories.
- Invalid remote client creation/update timestamps are skipped and logged.

## Test stubs

- Audit-result checker: clean, lower severity, High/Critical, malformed,
  structurally invalid, and missing file.
- Playwright: existing recurring, settings, sync, data-management, navigation,
  drag, and dependency behaviors.
- MCP: target uncovered retry/client/CLI/cache/read/dependency paths until the
  existing global threshold passes.
- Sync mapper/pull: invalid timestamp rejection plus valid offset timestamps.
