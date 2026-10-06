# Spec: modernization Phase 1, pin the hand-kept copies

Date: 2026-10-05. Tier: non-trivial. The approved design is
`../gsd-modernize/analysis/gsd-taskmanager/MODERNIZATION_BRIEF.md` (full plan,
approved by Vinny on 2026-10-05). This spec is the execution contract for its
Phase 1 and adds no scope. Where they differ, the brief wins.

## Goal

Pin four pairs of hand-kept copies with shared plain-JSON fixtures, so a change
to either copy alone fails a test. Map all 42 P0 rules in brief §5 to tests that
pin them. Production behavior doesn't change, and only test and fixture files
do.

## Inputs and outputs

| Unit | Copies | Fixture | Root test | MCP test |
|---|---|---|---|---|
| Field limits (pilot) | `lib/constants/schema.ts`, `packages/mcp-server/src/constants.ts` | `tests/fixtures/pinned-copies/field-limits.json` | `tests/data/pinned-copies/field-limits.test.ts` | `packages/mcp-server/src/__tests__/pinned-copies/field-limits.test.ts` |
| PocketBase record shape | `lib/sync/task-mapper.ts`, `packages/mcp-server/src/types.ts` | `pb-record-shape.json` | `pb-record-shape.test.ts` | `pb-record-shape.test.ts` |
| Completion metrics and streaks | `lib/analytics/{streaks,metrics}.ts`, `packages/mcp-server/src/analytics/{streaks,metrics}.ts` | `completion-metrics.json` | `completion-metrics.test.ts` | `completion-metrics.test.ts` |
| Service-worker cache rules | `lib/sw-cache-logic.ts`, `public/sw-cache-logic.js` | only if the mutation probe finds gaps | existing `tests/data/sw-cache-logic.test.ts` | none (both copies are web) |

Other outputs: `CONTRACT_MAP.md` and ticked Phase 1 boxes in the gsd-modernize
analysis folder.

## Fixture model

Each fixture records what the copies agree on once, under `expected`, and what
they don't under `divergences`, with a value per copy and a note. A divergence
that matches a brief §7 item names it. Keys that exist in only one copy are
listed per copy, so adding a key to one copy alone fails the key-set check.

Each suite loads the JSON with `readFileSync` and checks its own copy against
it. Editing a shared value means editing both copies, or the other suite goes
red. That is the pin.

## Constraints

- Only test and fixture files change. `tests/fixtures/cross-platform/` isn't
  touched.
- Fixtures are plain JSON. The root suite runs Vitest 5 and the MCP suite runs
  Vitest 4, so neither imports the other's code.
- Pin today's behavior, disagreements included. Flag them and don't fix them.
- Metrics cases that encode the §7 `updatedAt` defect, or the web seven-day
  strip's local-versus-UTC mix, carry an `encodesDefect` note.
- Time-dependent cases set the clock with `vi.setSystemTime` and the zone with
  `process.env.TZ`, then restore both.
- One branch per unit, cut from `main`. The pilot commits first.

## Edge cases

- A key present in one copy only (web `ID_MIN_LENGTH`, MCP `ID_MAX_LENGTH`).
- Absent optional fields map to `null` on the web and `0` in the MCP server.
- One completion day: web longest streak is 1, MCP longest streak is 0.
- A completion just before local midnight in a zone behind UTC.

## Out of scope

- Fixing any divergence. Phase 3 and Phase 4 own that, after the owner ticks §7.
- The estimate limit (1 to 10080), which lives as literals outside both
  constants files. It's reported as a pilot finding.
- MCP-only functions with no web partner, such as `getUpcomingDeadlines`.
- Generating `public/sw-cache-logic.js` from TypeScript (Phase 5).

## Acceptance criteria

1. The field-limits fixture runs in both suites, and a mutation to any value or
   key in either constants file alone fails a test.
2. The same holds for the PocketBase record shape.
3. The same holds for completion metrics and streaks, with defect cases marked.
4. A mutation probe of both service-worker copies runs. Each surviving mutation
   gets a pinning case, and the result is counted and reported.
5. `CONTRACT_MAP.md` maps every P0 rule to at least one test by file and name.
   New tests exist only where no test pins a rule.
6. Both suites, `bun typecheck`, and `bun lint` are green on every branch and on
   all branches combined. `git diff main --stat` shows only test and fixture
   files, and the cross-platform fixtures match gsd-iosapp and gsd-android by
   `shasum`.

## Verification

A mutation probe per unit: apply one mutation at a time to one copy, run that
unit's pinning tests, expect red, and restore the file. Record the count of
mutations killed and survived per copy.

## Test stubs

- `field-limits`: shared values match; copy-only values match; the copy's key set
  is exactly shared plus copy-only.
- `pb-record-shape`: write mapping per case; read mapping per case; web
  rejection cases return `null` on the web only.
- `completion-metrics`: per scenario, streak and metrics equal `expected` with
  this copy's divergences applied; web-only `last7Days` on the web.
