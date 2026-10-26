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

Verified seeded, running production output with fresh browser contexts and no
stale service-worker assets. Forms use native labeled controls, move keyboard
focus into editing, and restore it on cancel/save. Light/dark narrow layouts and
desktop dark were visually inspected. A coarse-pointer tablet probe found no
footer action overflow. Screen-reader operation was not separately tested.

Screenshots are saved outside the checkout:

- `/Users/vinnycarpenter/.codex/visualizations/2026/10/26/01a1791b-06d2-7bd3-ac77-39ec872c5957/saved-tasks/saved-mobile-light.png`
- `/Users/vinnycarpenter/.codex/visualizations/2026/10/26/01a1791b-06d2-7bd3-ac77-39ec872c5957/saved-tasks/saved-mobile-dark.png`
- `/Users/vinnycarpenter/.codex/visualizations/2026/10/26/01a1791b-06d2-7bd3-ac77-39ec872c5957/saved-tasks/saved-desktop-dark.png`

### Modern Web Guidance

- **accessibility**: I used persistent labels, native inputs/selects/buttons and a
  semantic list, and restored focus after editing. The guide's rule, "Don't use
  placeholders as primary labels", keeps both the search and notes fields named
  after the user starts typing. Existing project dialog/menu primitives remain.

## Delivery and rollout

Local implementation and checks are complete. Nothing was merged, deployed or
published, and the production schema was not changed. Before hosted release,
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
