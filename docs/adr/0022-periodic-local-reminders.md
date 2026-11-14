# ADR 0022: Run the same reminder rules in the page and periodic worker

Status: accepted 2026-11-14. Contract: `tasks/spec-review-p1-p2-2026-11-14.md`.

The registered `check-notifications` periodic event only cleared the badge.
It never queried tasks or displayed a reminder. The worker now reads the
existing `GsdTaskManager` database and notification settings, evaluates due,
all-day, quiet-hour and snooze windows, and calls `showNotification` for eligible
tasks. It marks only accepted deliveries, without changing task edit versions,
and counts eligible tasks for the badge. It makes no network request.

The timing rules remain in `lib/notifications/reminder-window.ts`. A generated
classic worker bundles them with `background.ts`, `background-db.ts` and
`coordination.ts`; `worker-entry.ts` exposes the callable worker entry. Run
`node scripts/generate-sw-notifications.cjs` after changing those sources.
The generated-file test checks byte equality and classic-script loading. Bun
1.3.14 (CI) and 1.4.4 were checked for identical output. Do not edit the copy.

Page checks, worker checks and Reset Everything share the origin-wide
`gsd-notification-check` Web Lock. A content-free marker in `gsd-control-v1`
survives cache rotations and keeps the worker quiet after an unsuccessful
reset. A successful wipe clears it. The worker refuses to create or upgrade
the app database, closes its connection after each pass, and closes a late
connection after abandoning a blocked open.

The worker requires notifications permission, Cache Storage and Web Locks.
Other browsers keep the existing foreground checker. Periodic scheduling is
controlled by the browser; this adds a working handler, not an exact alarm.
The weekly sweep reminder remains a foreground feature because its preferences
are in localStorage, which a worker cannot read.

Unit tests cover eligibility, quiet hours, snooze, delivery failures, dedup,
reset markers, stale marks and unavailable storage. A Chromium browser test
closes the app, invokes the actual worker entry and verifies one accepted
notification request, persisted state and dedup on a second pass. It uses the
full headless channel because the default headless shell refuses notification
permission; it does not assert an OS notification-center UI.
