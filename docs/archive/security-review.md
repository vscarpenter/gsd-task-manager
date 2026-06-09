# Security Review

Date: 2026-04-18

This document captures the highest-priority issues found during a manual code review and baseline validation run. Items are ordered by remediation priority, with security and data-integrity impact weighted most heavily.

## 1. Fix sync backend routing for self-hosted deployments

Severity: High

Files:
- [lib/env-config.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/env-config.ts:44)
- [lib/env-config.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/env-config.ts:62)
- [docker/docker-compose.yml](/Users/vinnycarpenter/Projects/gsd-taskmanager/docker/docker-compose.yml:16)
- [docker/README.md](/Users/vinnycarpenter/Projects/gsd-taskmanager/docker/README.md:75)

Issue:
- Any non-local, non-whitelisted hostname is treated as `production`.
- The production fallback PocketBase URL is hard-coded to `https://api.vinny.io`.
- The self-hosted Docker path does not set `NEXT_PUBLIC_POCKETBASE_URL`.

Risk:
- A fork or self-hosted deployment on a custom domain can silently send OAuth and sync traffic to the wrong PocketBase server.
- That is both a privacy leak and a functional break.

Recommended fix:
- Remove the hard-coded third-party production fallback.
- Require `NEXT_PUBLIC_POCKETBASE_URL` for any non-local deployment, or default to same-origin `/api` when running in the documented single-origin Docker setup.
- Fail closed when the sync backend is not explicitly configured.

## 2. Fix merge-import sync queue corruption on ID collisions

Severity: High

Files:
- [lib/tasks/import-export.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/tasks/import-export.ts:108)
- [lib/tasks/import-export.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/tasks/import-export.ts:122)

Issue:
- Merge imports correctly regenerate conflicting local IDs and remap references before writing to IndexedDB.
- After that, the sync queue still enqueues the original `parsed.tasks` instead of the remapped imported tasks.

Risk:
- When sync is enabled, imported tasks with colliding IDs can be pushed with stale IDs.
- This can hit the PocketBase `(task_id, owner)` uniqueness constraint or cause local and remote data to diverge.

Recommended fix:
- In merge mode, enqueue the post-remap `tasksToImport`, not the original parsed payload.
- Add a regression test for imports where one or more task IDs already exist locally.

## 3. Preserve notification and snooze state across sync

Severity: Medium

Files:
- [lib/sync/task-mapper.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/sync/task-mapper.ts:17)
- [lib/sync/task-mapper.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/sync/task-mapper.ts:140)
- [lib/notification-checker.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/notification-checker.ts:107)
- [lib/tasks/crud/snooze.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/tasks/crud/snooze.ts:42)

Issue:
- Reminder behavior depends on `notificationSent`, `lastNotificationAt`, and `snoozedUntil`.
- Those fields are not part of the sync schema, and pull mapping resets `notificationSent` to `false`.

Risk:
- Sync pulls can unsnooze tasks or re-arm notifications that were already handled on another device.
- Users may receive duplicate reminders or lose snooze state.

Recommended fix:
- Decide whether these fields are device-local or shared state.
- If shared, include them in the PocketBase schema and sync mappers.
- If device-local, move them out of the synced task record entirely so the current partial-sync behavior cannot corrupt state.

## 4. Stop queueing duplicate-task sync operations when sync is disabled

Severity: Medium

Files:
- [lib/tasks/crud/duplicate.ts](/Users/vinnycarpenter/Projects/gsd-taskmanager/lib/tasks/crud/duplicate.ts:27)

Issue:
- `duplicateTask()` passes `syncConfig?.enabled ?? true` to `enqueueSyncOperation`.
- Other CRUD flows default to `false` when sync config is absent or disabled.

Risk:
- Local-only users can accumulate `create` entries in `syncQueue` without intending to use cloud sync.
- If they later enable sync, previously duplicated local tasks may upload unexpectedly.

Recommended fix:
- Match the behavior used elsewhere: default to `false`.
- Add a test covering duplicate behavior with sync disabled and with sync not yet initialized.

## 5. Repair and harden the self-hosted Docker path

Severity: Medium

Files:
- [docker/Dockerfile](/Users/vinnycarpenter/Projects/gsd-taskmanager/docker/Dockerfile:26)
- [docker/Caddyfile](/Users/vinnycarpenter/Projects/gsd-taskmanager/docker/Caddyfile:23)
- [SECURITY.md](/Users/vinnycarpenter/Projects/gsd-taskmanager/SECURITY.md:122)

Issue:
- The Docker build references `scripts/generate-build-info.js`, but the repo contains `scripts/generate-build-info.cjs`.
- The Caddy config sets only a subset of the headers documented as required in `SECURITY.md`.

Risk:
- The documented self-hosted path appears broken at build time.
- The runtime security posture is weaker than the project documentation claims, especially given that PocketBase auth lives in `localStorage`.

Recommended fix:
- Correct the build script path in the Dockerfile.
- Add the missing headers or update the security documentation to reflect the actual self-hosted configuration.
- In particular, align CSP, HSTS, and Permissions-Policy with the documented minimum.

## Validation summary

Baseline checks run during review:
- `bun run typecheck`: passed
- `bun run lint`: passed with 5 warnings
- `bun run test`: failed with 16 UI test failures

Notes:
- The failing UI tests are not themselves the top security findings, but they reduce confidence in the current regression net.
- Several failures appear to be test drift against the current UI rather than direct runtime defects, so the manual review findings above should be prioritized independently of the current test failures.
