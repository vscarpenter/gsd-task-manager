# Saved tasks — implementation and verification

Implemented October 26, 2026 in `/Users/vinnycarpenter/Projects/GSD/gsd-taskmanager-saved`,
branch `feat/saved-tasks`, based on `1b0a98b`. The original checkout and its
unrelated package/lockfile edits were preserved.

## Result

Move an incomplete task to Saved without changing its identity, links, tags,
subtasks, dependencies, recurrence, or original priority/date. Saved stays outside
the matrix, active analytics, reminders and due badges. Short annotations edit
the existing 600-character description. Saved has search, global-search results,
notes editing, deletion with Undo, and return with quadrant/date review.

Saved prerequisites continue to block dependent work, including Ready to Work.
Running timers must be stopped before saving. Saving never completes a task or
spawns a recurrence. Local migrations preserve existing tasks; JSON backups and
optional PocketBase sync retain the marker. Updated MCP reads/edits honor it.

## Verification

- Unit/UI: 3,601 passed; 1 existing skip. New Saved components and lifecycle logic
  meet the repository's changed-file coverage floor.
- MCP: 353 passed; 6 system tests skipped in the ordinary package run and then
  executed separately against disposable real PocketBase instances.
- Authenticated PocketBase system harness: 6 passed, covering fresh/upgrade
  migrations and real browser save/annotation push plus a remote return to matrix.
- Production browser regression suite: 407 passed; 16 existing platform skips.
  Chromium, Firefox and WebKit include 12 Saved-specific cases: save, faithful
  Undo, notes, search, reload persistence, return, responsive themes and offline.
- Production static build exports `/saved`; CSP browser smoke passed. PWA
  lifecycle passed in Chromium, Firefox and WebKit.
- TypeScript, ESLint, code-shape ratchet, license policy and dependency audit pass.
  No new dependencies. The audit reported no vulnerabilities.
- Red/green evidence: missing Saved operations and UI; reminders incorrectly sent
  for saved rows; saved prerequisites incorrectly treated as ready. Tests failed
  before each corresponding implementation.

The first full unit run also reproduced an existing test failure on the unchanged
base: Request objects were compared by deep equality rather than URL. A separate
`test(pwa)` commit corrects that assertion; runtime cache behavior was unchanged.
Browser fixture fixes wait for notes persistence before reload and enable a real
service worker only in the explicit offline case. Its expected native offline
network errors are narrowly scoped; normal runtime-error checks remain enabled.

## Visual and interaction evidence

### PR #630 regression fixes

Settings now uses the complete stored task set for storage, reset counts and
import impact. Saved has its own breakdown count and stays outside Active.
A Saved-only replacement with sync enabled requires the cloud-deletion
confirmation. Bulk completion rejects a batch containing Saved items before
any write, including in dry-run mode. Bulk previews use fresh, complete records
so Saved-only and mixed delete previews match execution.

Regressions failed before the fixes. Follow-up verification: 3,602 unit/UI tests
passed (1 existing skip), 357 MCP tests passed (6 system tests remain separate),
and the Settings storage/reset/import flow passed in Chromium, Firefox and
WebKit, including a narrow viewport and strict runtime-error checks.
Typecheck, lint, code-shape and Knip pass. Root coverage is 90.09% statements /
91.26% lines; MCP coverage is 89.58% statements / 89.38% lines.

The initial WebKit CI attempt timed out downloading Ubuntu dependencies from
the runner's Azure APT mirror, before app tests ran. The shared browser installer
uses the Ubuntu archive with IPv4 and bounded retries/timeouts. Its action YAML
and shell syntax were checked locally; the hosted CI run validates installation
on Ubuntu. Every browser remains a blocking job with the original timeout.

### Initial feature verification

Verified seeded, running production output with fresh browser contexts and no
stale service-worker assets. Forms use native labeled controls, move keyboard
focus into editing, and restore it on cancel/save. Light/dark narrow layouts and
desktop dark were visually inspected. A coarse-pointer tablet probe found no
footer action overflow. Screen-reader operation was not separately tested.

Review screenshots:

- [Desktop dark](../../docs/reviews/saved-tasks/saved-desktop-dark.png)
- [Mobile light](../../docs/reviews/saved-tasks/saved-mobile-light.png)
- [Mobile dark](../../docs/reviews/saved-tasks/saved-mobile-dark.png)

The user also accepted the local workflow before requesting a pull request.
The new `/saved` route has a measured first-load JavaScript budget, and the
production dependency/file check (`knip`) passes.

### Modern Web Guidance

- **accessibility**: I used persistent labels, native inputs/selects/buttons and a
  semantic list, and restored focus after editing. The guide's rule, "Don't use
  placeholders as primary labels", keeps both the search and notes fields named
  after the user starts typing. Existing project dialog/menu primitives remain.

## Delivery and rollout

Local implementation, checks and user acceptance are complete. The feature is
prepared for pull-request review. Production assets, the production schema and
the published MCP package have not been changed. Before hosted release,
apply `1793030400_saved_tasks.js` to the backend, ship the updated MCP package,
and deploy/verify web assets and `/saved` routing. Build output is not evidence
of deployment.

## iOS fast follow

The current iOS model/wire sources do not contain Saved placement. Older clients
will still display these records as tasks; cross-client parity is pending.

1. Add the optional marker to `GSDKit/Sources/GSDModel/Task.swift` and the store
   migration. Missing marker keeps all existing tasks active.
2. Add `saved_at` to `PocketBaseTaskRecord.swift`, `PocketBaseTaskWrite.swift` and
   `TaskWireMapper.swift`, preserving it on edits and clearing it on return.
3. Filter Saved from matrix, widgets, notifications, badges and active analytics;
   retain the complete graph for dependency validation.
4. Add native Saved, short notes using the same description limit, search, Undo,
   and return with quadrant/date review.
5. Test web ↔ iOS sync and backup round trips, old backup defaults, recurrence,
   dependencies, offline use and reminders before distribution.
