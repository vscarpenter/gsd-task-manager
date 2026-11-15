# Capture focus and 14.9.0 release preparation

After clicking Add, focus could remain on the button. Capture now returns focus
to the task field after a successful save, so the next task can be typed without
another click. It preserves a newer focus choice, an open modal, failed-save
drafts and unmount. The native submitter covers Safari pointer activation, where
a clicked button may not receive focus. Programmatic submissions without a
capture submitter leave outside focus alone.

The owner's existing package/lockfile edits are included: version 14.9.0, Hono
4.13.16 and the accompanying transitive refresh. README and pin expectations now
match. The obsolete config-array/minimatch release-line exception was removed
because the refreshed config-array declares minimatch 11.

The app's notable 14.9.0 What's New entry covers the P1/P2 work merged in PR #743,
its review fixes and capture focus: sync conflicts and recovery, backup/import
safety, editor drafts and subtasks, timers, fresh recurring-task work history,
global search, reminders, reset and app-update reliability, and download size.
It is dated November 14, 2026 in the owner's America/Chicago time zone.

## Verification receipt

Loop: production build plus live Playwright, with fresh browser contexts, service
workers disabled and local IndexedDB fixtures. Functional and runtime-error
checks: PASS. The rendered 14.9.0 notes and post-update cue work; repeated Add
returns focus, including after the field was blurred, and keyboard Enter adds the
next task. All 42 tests in the affected CRUD/What's New suites passed across
Chromium, Firefox and WebKit without retries. Focused Chromium dev checks passed.
A read-only accessibility review found no actionable issues; screen-reader
testing was not performed.

App: 370 files, 4,996 tests passed. Coverage: statements 91.25%, branches 86.10%,
functions 90.93%, lines 92.52%. CaptureBar coverage exceeds 94% in every metric.
MCP: 544 passed, seven separately gated system tests skipped. Production build
stamps 14.9.0. App/test TypeScript, lint, existing shape/bundle checks, knip,
license policy and whitespace passed. Audit reported no vulnerabilities across
783 package entries. No budget or debt baseline was raised.

## Modern Web Guidance

- **`accessibility`**: I scoped restoration to the submitting capture interaction
  and kept modal/newer focus choices intact, applying “Manage focus correctly to
  and from updated content.”
- **`forms`**: I checked repeated capture with keyboard Enter and native submission
  in three browsers, following “test keyboard-only navigation.”

## Rollout

This prepares a PR; it does not deploy or publish 14.9.0. The backend-first
requirement from PR #743 still applies to adopting sync clients. Revert this
commit and rebuild the previous web release if rollback is needed; no data
migration is introduced.
