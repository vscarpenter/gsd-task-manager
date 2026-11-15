# P1/P2 review resolution — 2026-11-14

All five P1 and nine P2 findings are implemented on `fix/review-p1-p2`.
Local verification is complete. The owner installed the backend hooks on
`api.vinny.io`, and the live checks below passed. Web and MCP releases remain
pending.
Contract: `tasks/spec-review-p1-p2-2026-11-14.md`.

## Resolution list

| Item | Priority | Resolution | Main source / regression evidence |
| --- | --- | --- | --- |
| 1. Concurrent remote overwrite/delete | P1 | Compare the expected version and mutate in one owner-checked server transaction; web/MCP fail closed without the route | `docker/pb_hooks/task-write-contract.js`, ADR 0021, PocketBase system concurrency test |
| 2. Import lifecycle collisions | P1 | Merge remaps collisions against live, archive and Trash; replace clears contradictory tombstones transactionally | `lib/tasks/import-export.ts`, `tests/data/review-data-integrity.test.ts` |
| 3. Replacement replays old queue snapshots | P1 | Replace supersedes queue intents in the import transaction; push rechecks captured queue IDs before sending | `lib/tasks/import-export.ts`, `lib/sync/pb-push.ts`, data-integrity/push regressions |
| 4. Mutable files cached as immutable | P1 | Only hashed Next static assets get immutable caching; stable files revalidate and unchanged bodies have metadata refreshed | `scripts/deploy-app.sh`, `tests/deploy-app.test.ts` |
| 5. Deployment deletes active-session assets | P1 | Upload hashes first, retain previous hashes and publish HTML after mutable uploads | Same deployment script and command-level tests |
| 6. Palette bypasses editor modality | P2 | Every palette open path checks the existing modal; keyboard and programmatic opens preserve the draft | `lib/use-command-palette.ts`, hook tests, `review-remediation.spec.ts` |
| 7. Pending subtask lost on Save | P2 | Pending entry belongs to the draft, saves without Enter and participates in discard protection | `use-edit-draft-state.ts`, drawer tests and browser regression |
| 8. Failed sync cannot recover | P2 | Settings lists failed operations; owner-fenced Retry uses current task state and a new queue ID; Dismiss preserves unsynced content in Trash | `lib/sync/failed-recovery.ts`, `components/settings/failed-sync-operations.tsx`, unit/browser tests |
| 9. New instances inherit work history | P2 | Web recurrence, duplicate and MCP recurrence reset tracked minutes and entries | `lib/tasks/crud/{toggle,duplicate}.ts`, MCP recurrence, data/MCP regressions |
| 10. Invalid remote data reaches storage | P2 | Mapped records pass the same stored-record schema before persistence | `lib/sync/task-mapper.ts`, data-integrity tests |
| 11. Missing matrix timer controls | P2 | Matrix passes start/stop actions through panes and cards, with user-facing failure handling | Matrix grid/pane/action modules, matrix integration and browser tests |
| 12. Smart View hides global result | P2 | Highlighting clears both search and Smart View filters before revealing/focusing the task | `components/matrix-simplified/index.tsx`, matrix/browser regressions |
| 13. Periodic reminder is a no-op | P2 | Worker evaluates local settings/tasks using canonical timing rules, coordinates with page/reset, marks accepted notifications and updates the badge | ADR 0022, `lib/notifications/background.ts`, worker unit and real-worker browser tests |
| 14. Bundle budgets fail | P2 | Help and onboarding code load when opened; existing budgets and allowance are unchanged | AppShell/OnboardingGate, production bundle check |

Manual retry also extends the far-future remote hold-off to failed rows, so
recoverable local content is retained. Recovery controls name the affected task
for assistive technology. The existing P3 capture-focus follow-up remains outside
this request.

## Verification

- App: 368 files, 4,973 tests passed. Coverage: statements 91.20%, branches
  86.09%, functions 90.87%, lines 92.49%.
- MCP: 544 tests passed; seven gated system tests skipped in the unit run.
  MCP coverage: statements 90.00%, branches 85.91%, functions 89.63%, lines 89.97%.
- Disposable PocketBase: seven system tests passed against pinned 0.40.4 and
  upgrade fixtures, including simultaneous conditional PATCH, stale DELETE,
  owner/identity constraints and encrypted storage. These system tests used
  disposable backends.
- Full production Playwright suite: 540 passed, 24 declared skips across Chromium,
  Firefox and WebKit. After the reset-ordering adjustment, the rebuilt affected
  suites passed again: 25 passed, two non-Chromium periodic-worker skips.
- Production build, every unchanged bundle budget, strict CSP and PWA lifecycle
  checks passed. PWA checks covered all three browsers.
- App/test TypeScript, MCP build/test TypeScript, ESLint, code-shape ratchet,
  knip and whitespace checks passed. No shape or bundle baseline was raised.
- Dependency license check approved 720 installed versions. Audit reported no
  high/critical vulnerabilities; five advisories were below that threshold.
- Worker generation matched byte for byte under Bun 1.3.14 (CI) and 1.4.4.

Browser fixtures use fresh contexts, clear worker/cache state and seed IndexedDB.
The full Chromium headless channel verifies an accepted real worker notification
request with the app page closed, persisted delivery state and dedup. It cannot
verify an OS notification-center UI. Periodic scheduling remains browser-controlled.

The first broad run found two test-harness failures. Keyboard drag now waits for
font metrics and tries available neighboring directions; the Today test uses
the automatic runtime-error guard, which already recognizes canceled local-font
requests. Subsequent full-suite verification passed with no retries enabled.

## Live backend verification

On 2026-11-14, 5:12:40–5:12:42 PM CST, authenticated checks against
`https://api.vinny.io` passed using one temporary task:

- Creation returned 200; a guarded update returned 204 and matched on read-back.
- In each of three concurrent PATCH races, one request returned 204 and the
  other returned 412. Read-back preserved the winning title and version.
- A stale-version DELETE returned 412 and preserved the task.
- Guarded cleanup returned 204. An authenticated lookup returned 404, and an
  owner-scoped query for the exact task ID returned no matches.

The normal-user session was attested before writes. The temporary credential
file was removed after reading; no credentials are included in this report.

## Rollout

1. Backend prerequisite completed: the owner installed both atomic-write hook
   files and restarted PocketBase. Live guarded writes, conflict rejection and
   cleanup passed as recorded above. Keep both files installed. See ADR 0021.
2. Release the clients and use the updated deployment script so mutable metadata
   is replaced and previous hashed assets remain available. Old hashes are
   deliberately retained; cleanup requires a separate retention process after
   active sessions have aged out.
3. Existing native clients retain their collection API behavior. Atomic protection
   applies to clients using the new route. Roll back adopting clients before
   removing the backend hooks.

## Frontend verification receipt

Checked: editor draft preservation and discard handling, modal keyboard paths,
timer persistence, global result visibility/focus, failed-sync recovery,
on-demand guides, production CSP, offline worker lifecycle and runtime errors.
Loop: served production artifact + Playwright; fresh contexts and seeded data.
Verdict: PASS for the requested implementation. The backend prerequisite is
verified; adopting web/MCP clients still require release.

## Modern Web Guidance

- **`dialog`**: I kept the project's existing modal primitive and extended its
  dirty-state protection, following "explicit confirmation step for dirty forms."
- **`accessibility`**: I gave each recovery action the affected task's name,
  applying "include the visible text as well as important contextual information".
- **`forms`**: I kept secondary recovery/checklist actions from submitting the
  editor, following "explicitly set `type="button"` on secondary or helper buttons".

## Review questions before merge

1. Where are the expected version and task mutation checked together, and what
   should an adopting client do if the guarded route is unavailable?
2. How does replace import prevent an already captured queue snapshot from
   replaying obsolete work, and how are live/archive/Trash collisions handled?
3. Which deployment files can be cached as immutable, and why must older hashed
   assets survive a deployment?
4. What prevents page and worker reminders from racing with each other or with
   reset, and which browsers control periodic scheduling?
5. What must happen before removing the backend hooks during a rollback, and
   which clients gain atomic conflict protection?

## PR #743 review follow-up

The initial CI run passed every job. Review then identified three reproducible
correctness bugs, now covered by regression tests:

- [Equal-version queued edits](https://github.com/vscarpenter/gsd-task-manager/pull/743#discussion_r4576764791):
  prepare the owner-fenced queue in one transaction, coalescing consecutive
  upserts at the same version before CAS tie-breaking. The current same-version
  task supplies the final content when enqueue timestamps tie. A delete separates
  groups, failed rows stay outside the pending set, and a failed push preserves
  the remaining latest intent for retry. Real push/pull regressions cover absent
  and existing remote records, equal enqueue timestamps, retry and a newer remote.
- [Worker activation blocks reset](https://github.com/vscarpenter/gsd-task-manager/pull/743#discussion_r4576764794):
  cap the worker-ready wait at two seconds, clear the timer, and check reset state
  before display or fallback. Tests cover fallback, ignored late activation, and
  reset deleting real IndexedDB rows while a due reminder waits for a worker.
- [Cache Storage failure blocks reset](https://github.com/vscarpenter/gsd-task-manager/pull/743#discussion_r4576770160):
  treat the background marker as best effort and log only the error name. Cache
  open, put or delete failures no longer prevent sign-out, local deletion or
  unlocking after a successful wipe. A failed local wipe still keeps the lock.

Sonar follow-up gives aborted IndexedDB transactions an Error fallback, marks
component props read-only, simplifies the recovery message and optional check,
and documents three intentional constructs at their exact locations: serial
notification display/marking, ordered archive writes and the Chromium-only
periodic-worker test. No thresholds, budgets or blanket exclusions changed.

Verification after these changes:

- App: 370 files, 4,983 tests passed. Coverage: statements 91.23%, branches
  86.09%, functions 90.89%, lines 92.52%. The queue preparation module has 100%
  statement, line and function coverage, and 90% branch coverage.
- Production browser regressions: 25 passed, two declared non-Chromium skips,
  no retries, across Chromium, Firefox and WebKit. The served artifact covers
  editor subtasks, failed-sync controls, reset, timers, global results and the
  real background worker with fresh contexts and seeded IndexedDB. Verdict: PASS
  for functionality and runtime-error checks.
- App and test TypeScript, lint, shape, knip, production build, unchanged bundle
  checks, generated-worker drift and whitespace checks passed.

I checked worker activation/registration in Modern Web Guidance; the catalog had
no applicable guide for activation deadlines or sync queue ordering. The worker
ready behavior was checked against MDN before changing the wait.

All CI jobs and the SonarCloud quality gate passed at `08954231`, and all three
review threads were resolved. A final static follow-up uses `.at(-1)` in queue
preparation and documents the required serial tombstone deletion before an archive
write. The final pushed head is monitored separately.
