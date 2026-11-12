# tools/stagehand/page-scripts

## Overview

This directory holds three scripts that the harness evaluates inside the app's page. They collect page errors, reset the service worker and caches, and seed tasks into IndexedDB.

## Interface

- `console-collector.js`: an immediately invoked function with no arguments. It defines `window.__gsdEvidence` with four arrays: `consoleErrors`, `consoleWarnings`, `pageErrors`, and `failedRequests`.
- `reset-app-state.js`: an async immediately invoked function with no arguments. It returns a promise of a status string.
- `seed-tasks.js`: an immediately invoked function. It defines `window.gsdSeed` and returns a status string.
  - `gsdSeed.makeRecord(spec)`: returns a full task record. Spec fields are `title`, `description`, `urgent`, `important`, `completed`, `daysAgo`, `dueInDays`, `tags`, `estimatedMinutes`, `timeSpent`, and `running`.
  - `gsdSeed.seed(specs)`, `gsdSeed.archived(specs)`, `gsdSeed.trashed(specs)`: each writes records and returns a promise of a status string. `archived` also reads the spec field `archivedDaysAgo` (default 30) and adds `archivedAt`. `trashed` reads `deletedDaysAgo` (default 2) and adds `deletedAt`.
  - `gsdSeed.clear()`: removes seeded rows.
  - Scenarios: `gsdSeed.dashboard()` (8 tasks), `gsdSeed.matrix()` (one task per quadrant), `gsdSeed.trash()` (2 trashed tasks), `gsdSeed.storage()` (the matrix set plus 3 archived tasks).

## Invariants

- `console-collector.js` returns early when `window.__gsdEvidence` already exists. Its header says to evaluate it again after every navigation.
- `console-collector.js` records a failed request only when a response is not ok. It does not record a `fetch` call that rejects, such as a network error.
- `seed-tasks.js:withStore` rejects when the object store does not exist. The app must load once first so Dexie creates the schema.
- `seed-tasks.js:makeRecord` writes every required task record field. It sets `completedAt`, `dueDate`, `estimatedMinutes`, and `timeSpent` only when the spec calls for them. It never writes `notifyBefore`, `parentTaskId`, `lastNotificationAt`, or `snoozedUntil`. Its header says `put()` bypasses the Zod schema.
- `seed-tasks.js:resolveQuadrant` keeps `quadrant` consistent with `urgent` and `important`.
- `seed-tasks.js:SEED_PREFIX` gives every seeded id the prefix `seed-`. `clear()` deletes only rows with that prefix.
- `reset-app-state.js` does not touch IndexedDB. Its header says a reload must follow.

## Side Effects

- `console-collector.js` replaces `console.error`, `console.warn`, and `window.fetch` with wrappers. It adds `error` and `unhandledrejection` listeners on `window`.
- `reset-app-state.js` unregisters every service worker registration and deletes every Cache Storage key.
- `seed-tasks.js:seed`, `archived`, and `trashed` write to the IndexedDB database `GsdTaskManager`, in the stores `tasks`, `archivedTasks`, and `deletedTasks`.
- `seed-tasks.js:clear` deletes rows with `seed-` ids from those three stores.
- `seed-tasks.js` sets the global `window.gsdSeed`.

## Verification

- Run: `bun run test` (Vitest; `tests/tools/console-collector.test.ts` covers `console-collector.js`)
- No automated check found for `reset-app-state.js` and `seed-tasks.js`.
