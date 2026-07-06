# Domain Model & Data Layer

This page describes the core entities, the Eisenhower quadrant system, and the rules that
govern tasks. Types live in `/lib/types.ts`, validation in `/lib/schema.ts`, and persistence
in `/lib/db.ts`.

---

## TaskRecord — the central entity

`TaskRecord` (`/lib/types.ts`) is the primary record. Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Primary key (generated id) |
| `title`, `description` | `string` | |
| `urgent`, `important` | `boolean` | The raw Eisenhower axes |
| `quadrant` | `QuadrantId` | **Derived** from `urgent`/`important` (see below) |
| `dueDate?` | ISO string | Optional |
| `completed`, `completedAt?` | `boolean` / ISO | `completedAt` set on completion |
| `createdAt`, `updatedAt` | ISO strings | `updatedAt` is the sync conflict authority |
| `recurrence` | `RecurrenceType` | `none` / `daily` / `weekly` / `monthly` |
| `tags` | `string[]` | Multi-entry indexed |
| `subtasks` | `Subtask[]` | Inline `{id,title,completed}` |
| `parentTaskId?` | `string` | Links recurring instances to their origin |
| `dependencies` | `string[]` | IDs of tasks that must complete first |
| `notifyBefore?`, `notificationEnabled`, `notificationSent`, `lastNotificationAt?`, `snoozedUntil?` | | Notification state |
| `archivedAt?` | ISO | Only set in the `archivedTasks` table |
| `estimatedMinutes?`, `timeSpent?`, `timeEntries?` | | Time tracking; `timeSpent` is a cached rollup of `timeEntries` |

Related types: `TaskDraft` (creation input — no derived/system fields), `Subtask`,
`TimeEntry`, `NotificationSettings`, `ArchiveSettings`, `SyncHistoryRecord`,
`AppPreferences`.

### Validation (`/lib/schema.ts`)

Zod schemas driven by `SCHEMA_LIMITS` constants:

- `taskDraftSchema` — validates creation input.
- `taskRecordSchema` (`.strict()`) — full record validation, used on export.
- `storedTaskRecordSchema` (`.strip()`) — lenient variant that strips unknown/legacy fields
  (e.g. old `vectorClock`) rather than rejecting; used for import and reads from IndexedDB.

---

## The Eisenhower quadrant system (`/lib/quadrants.ts`)

Four quadrants (`QuadrantId`):

| QuadrantId | Display | Meaning |
| --- | --- | --- |
| `urgent-important` | Do First | Urgent + Important |
| `not-urgent-important` | Schedule | Not urgent + Important |
| `urgent-not-important` | Delegate | Urgent + Not important |
| `not-urgent-not-important` | Eliminate | Not urgent + Not important |

- **Quadrant is derived, not independently authored.** `resolveQuadrantId(urgent, important)`
  maps the two booleans to a `QuadrantId`; `parseQuadrantFlags(quadrantId)` is the inverse.
  Quadrant is computed at write time (see `/lib/tasks/crud/create.ts`), and
  `moveTaskToQuadrant` (`/lib/tasks/crud/move.ts`) is the inverse path used when dragging a
  task between quadrants.
- **Display metadata** (`quadrants: QuadrantMeta[]`) holds titles, short labels, colors, and
  empty-state copy. Redesign accent tokens map to CSS variables `--q1`–`--q4`.

---

## Task dependencies & cycle detection (`/lib/dependencies.ts`)

Dependencies form a directed graph (`dependencies` = IDs that must complete first). Adding a
dependency must not create a cycle.

- **`wouldCreateCircularDependency(taskId, dependencyId, allTasks)`** uses **iterative BFS**
  (explicit queue + visited set) starting from the proposed dependency; if it can reach
  `taskId`, a cycle would form. Self-dependency short-circuits to `true`.
- **Why BFS** (ADR-0008): avoids call-stack overflow on deep chains, allows early
  termination, and is easy to audit. Recursive DFS and "trust the user" were rejected.
- Query helpers: `getBlockingTasks`, `getBlockedTasks`, `getUncompletedBlockingTasks`,
  `isTaskBlocked`, `isTaskBlocking`, `getReadyTasks`.
- `validateDependencies(...)` gates mutations (self-reference, existence, cycle checks).
- Mutations live in `/lib/tasks/dependencies.ts`
  (`addDependency`, `removeDependency`, `removeDependencyReferences`). Deleting a task purges
  inbound dependency edges first.
- **Editing surface:** the v9 edit drawer's "Depends on" field
  (`/components/matrix-simplified/edit-drawer-dependencies.tsx`) is the in-app way to link
  dependencies. It reuses `wouldCreateCircularDependency` via a save-time guard
  (`findDependencyCycleError`) that blocks saves creating a cycle but **preserves ghost IDs**
  (dependencies referencing tasks not yet synced to this device) instead of dropping them.
  This field was restored in v10.2.0 after the v8 task-form removal left the system
  write-only via MCP/import (ADR-0011 addendum).

---

## Other task features

- **Recurrence** — `/lib/tasks/crud/toggle.ts`. Completing a task whose `recurrence !== "none"`
  clones a fresh instance (new id, `completed:false`, reset subtasks/notifications,
  `parentTaskId` linking back to origin) and advances the due date via
  `calculateNextDueDate`.
- **Subtasks** — `/lib/tasks/subtasks.ts` (`addSubtask`/`toggleSubtask`/`deleteSubtask`).
  Stored inline on the record; capped by `SCHEMA_LIMITS.MAX_SUBTASKS`.
- **Tags** — `string[]`, indexed as a Dexie multi-entry index (`*tags`). Filtering by
  multiple tags requires ALL to match (`filterByTags` in `/lib/filters.ts`).
- **Time tracking** — `/lib/tasks/crud/time-tracking.ts`
  (`startTimeTracking`/`stopTimeTracking`, `hasRunningTimer`, `formatTimeSpent`). `timeSpent`
  is the derived sum of completed `timeEntries`.
- **Archive** — `/lib/archive.ts` + a separate `archivedTasks` table. `archiveOldTasks(daysOld)`
  moves completed tasks older than the cutoff into `archivedTasks` (auto-run via
  `/lib/use-auto-archive.ts`); `restoreTask` (here = un-archive) moves them back.
- **Smart views** — `SmartView` = a named `FilterCriteria` (quadrants, status, tags,
  due-date, recurrence, `readyToWork`, search). Built-ins in `/lib/smart-views/built-in.ts`;
  CRUD/pinning in `/lib/smart-views.ts`. Note `AppPreferences.smartViewsEnabled` defaults to
  `false` (schema v11).

---

## IndexedDB / Dexie schema (`/lib/db.ts`)

- Database name: **`GsdTaskManager`**, class `GsdDatabase`, singleton via `getDb()` (throws
  if `indexedDB` is undefined — i.e. non-browser context).
- Tables: `tasks`, `archivedTasks`, `smartViews`, `notificationSettings`, `syncQueue`,
  `syncMetadata`, `deviceInfo`, `archiveSettings`, `syncHistory`, `appPreferences`.
- **14 schema versions** with migrations. Highlights:
  - v2 added recurrence + `*tags`; v3 added timestamps + `[quadrant+completed]` compound
    index; v4 added `smartViews`; v5 notifications; v6 `*dependencies`; v7 sync tables; v8
    `completedAt` backfill; v9 `archivedTasks` + `archiveSettings`; v10 `syncHistory`; v11
    `appPreferences`; v12 time-tracking fields (corruption-hardened); **v13 PocketBase
    migration** (clears `syncQueue`, resets sync metadata → re-auth required, strips legacy
    `vectorClock`); v14 added `status` index to `syncQueue`.

**When adding a task field:** add the type (`/lib/types.ts`), the Zod validation
(`/lib/schema.ts`), a **new Dexie version + migration** in `/lib/db.ts`, and (if it must
sync) the PocketBase field mapping in `/lib/sync/`. Then add/adjust tests under
`/tests/data/`.

---

## Relevant tests

- `/tests/data/` — schema/mappers/domain logic (dependencies, quadrants, recurrence, etc.).
- `/tests/data/tasks/` — task CRUD operations.
- See the [Testing guide](../testing/testing-guide.md) for how to run them.

## Related ADRs

`docs/adr/0006-analytics-modular-design.md`, `0007-notification-system-design.md`,
`0008-bfs-circular-dependency-detection.md`, `0009-smart-views-system.md`,
`0011-v9-single-matrix-refactor.md`. Note ADR-0009 describes some pin shortcuts and a schema
version that no longer match current source — prefer `/lib/db.ts` and `/lib/smart-views.ts`.
