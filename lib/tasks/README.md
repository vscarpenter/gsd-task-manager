# Tasks

## Overview

This package holds task operations beyond basic CRUD: dependencies, subtasks, Saved placement, top three picks, and JSON backup export and import. The CRUD write paths live in the `crud` subdirectory.

Mutations here reuse `runTaskSyncTransaction` from `crud/helpers.ts`, so a task change and its sync queue entry commit together.

## Interface

- `crud.ts`. Compatibility barrel. Re-exports the 19 task operations from `./crud/index`.
- `dependencies.ts:addDependency(taskId, dependencyId): Promise<TaskRecord>`. Appends a dependency id. Returns the stored task unchanged when the id is already present.
- `dependencies.ts:removeDependency(taskId, dependencyId): Promise<TaskRecord>`. Removes a dependency id.
- `dependencies.ts:removeDependencyReferences(taskId): Promise<void>`. Removes a task id from every other task's dependencies.
- `dependencies.ts:removeDependencyReferencesInTransaction(taskId, enqueue, syncEnabled): Promise<void>`. The same cleanup, for a caller that already holds the transaction.
- `subtasks.ts:toggleSubtask(taskId, subtaskId, completed): Promise<TaskRecord>`. Sets one subtask's completion.
- `subtasks.ts:addSubtask(taskId, title): Promise<TaskRecord>`. Validates and appends a subtask.
- `subtasks.ts:deleteSubtask(taskId, subtaskId): Promise<TaskRecord>`. Removes a subtask.
- `saved.ts:saveTaskForLater(id): Promise<TaskRecord>`. Sets `savedAt` on a task.
- `saved.ts:returnSavedTask(id, quadrant, dueDate): Promise<TaskRecord>`. Clears `savedAt` and places the task in a quadrant with a due date.
- `saved-placement.ts:savedPlacementBlocker(task): string | null`. Returns why a task cannot be in Saved, or `null`.
- `top-three-actions.ts:addToToday(id, tasks, now, zone): Promise<"added" | "full">`. Picks a task for today at the next free rank.
- `top-three-actions.ts:removeFromToday(id): Promise<void>`. Clears a task's pick.
- `top-three-actions.ts:movePick(id, direction, tasks, now, zone): Promise<void>`. Swaps ranks with the neighbor in that direction.
- `top-three-actions.ts:tidyPicks(tasks, now, zone): Promise<void>`. Applies the writes that `tidy` from `lib/top-three.ts` returns.
- `top-three-actions.ts:reorderPicks(orderedIds, tasks, now, zone): Promise<void>`. Sets ranks 1 to 3 to follow a new order.
- `import-export.ts:exportTasks(): Promise<ImportPayload>`. Returns every user-owned store as a backup payload (envelope `2.2.0`).
- `import-export.ts:exportToJson(): Promise<string>`. Returns the backup as a JSON string.
- `import-export.ts:exportToJsonWithReport(): Promise<ExportReport>`. Returns the JSON plus a count of skipped records.
- `import-export.ts:ExportReport`. Interface with `json` and `skippedCount`.
- `import-export.ts:importTasks(payload, mode = "replace"): Promise<void>`. Validates and restores a payload in `"replace"` or `"merge"` mode.
- `import-export.ts:importFromJson(raw, mode = "replace"): Promise<void>`. Parses a JSON string and calls `importTasks`.
- `import-export.ts:assertWithinImportCap(parsed): void`. Throws when the payload holds more than 10,000 task records.
- `import-export.ts:assertWithinImportSize(raw): void`. Throws when the raw string is larger than 10 MB.
- `import-check.ts:checkImportFile(raw): ImportCheck`. Checks a chosen file before the dialog offers Merge or Replace.
- `import-check.ts:ImportCheck`. `{ ok: true }` or `{ ok: false; message: string }`.
- `import-id-remap.ts:regenerateConflictingIds(tasks, existingIds)`. Gives new ids to imported tasks that collide. Returns the tasks and an id map.
- `import-id-remap.ts:remapTaskReferences(tasks, idMap): TaskRecord[]`. Rewrites `dependencies` and `parentTaskId` through the id map.
- `smart-view-import-bounds.ts:assertRawSmartViewBounds(payload): void`. Bounds the memory cost of raw smart view input.
- Subdirectory: [Task CRUD](./crud/README.md).

## Invariants

- `import-export.ts:assertWithinImportCap` counts `tasks + archivedTasks + deletedTasks`. The limit is 10,000 (`MAX_IMPORT_TASKS`).
- `import-export.ts:assertWithinImportSize` measures UTF-8 bytes against 10 MB (`MAX_IMPORT_SIZE_BYTES`) before the file is parsed.
- `import-export.ts:importTasks` runs one `rw` transaction over `tasks`, `archivedTasks`, `deletedTasks`, `smartViews`, `notificationSettings`, `archiveSettings`, `appPreferences`, and `syncQueue`. A narrower scope would let a partial restore commit (`importTransactionTables`).
- `import-export.ts:resolveSyncDeps` resolves the sync modules and config before the transaction opens, to avoid detaching the Dexie context.
- `import-export.ts:applyArchivedTasks` checks a payload archived row against `tasks`, and in merge mode against `archivedTasks`. It does not check `deletedTasks`. `import-export.ts:applyTasks` checks ids against `tasks` only. When a payload lists an id as live and archived, the live copy wins (ADR 0013 rule 1).
- `import-export.ts:applyArchivedTasks` writes with `put`, never `add`, so a second import cannot raise a `ConstraintError` (ADR 0013 rule 3).
- `import-export.ts:applyArchivedTasks` and `import-export.ts:applyTrashedTasks` treat an absent key as silence, not as an instruction to delete. A `1.0.0` backup leaves the archive alone on replace.
- `import-export.ts:applyTrashedTasks` skips an id that is already live or archived (ADR 0013, extended by ADR 0015). In merge mode a local Trash row keeps its edits and retention clock.
- `import-export.ts:applyTasks` in replace mode clears `tasks` and reports removed ids for sync deletes. In merge mode it regenerates colliding ids and remaps references.
- `import-export.ts:importTasks` applies settings in replace mode only. A merge combines task lists and does not adopt another device's configuration.
- `import-export.ts:importTasks` never enqueues archived rows. The remote copy is deleted when a task is archived (ADR 0013).
- `import-export.ts:importTasks` gives every imported live task a numeric `notifyBefore` (D-10). It writes archived and trashed rows as they arrive. Replace uses the backup's default when the payload carries one, else this device's. Merge keeps this device's.
- `import-export.ts:applySmartViews` validates per row and skips rows it cannot represent. Only new ids count against `SCHEMA_LIMITS.MAX_SMART_VIEWS`.
- `import-export.ts:collectExportableArchive` validates with `archivedTaskRecordSchema`, not `taskRecordSchema`. The strict task schema declares no `archivedAt` and would reject every archived row (ADR 0014).
- `import-export.ts:collectExportableTasks` skips a corrupt record instead of throwing, and returns the count.
- `import-export.ts:withoutUndefinedKeys` strips undefined-valued keys before validation, because a strict schema rejects a key it does not declare.
- `import-export.ts:collectUserOwnedStores` leaves `syncMetadata` out of the backup. That table carries email, user id, and device id (ADR 0014).
- `import-export.ts:buildBackup` is the single source for `exportTasks` and `exportToJsonWithReport`.
- `import-check.ts:checkImportFile` runs the same schema and cap that `importTasks` runs. A file that passes here cannot fail them later.
- `smart-view-import-bounds.ts:assertRawSmartViewBounds` checks memory bounds only: depth 6, 10,000 nodes, and 256 KiB of string bytes. One bad view must never abort a payload that carries the user's tasks.
- `saved.ts:saveTaskForLater` changes placement, never identity or completion. It returns early when `savedAt` is already set.
- `saved-placement.ts:savedPlacementBlocker` blocks a completed task and a task with a running timer. It imports no Dexie or sync code, so the sync layer can use it without an import cycle.
- `saved.ts:returnSavedTask` validates `quadrant` and `dueDate` before the transaction and resets `notificationSent`, `lastNotificationAt`, and `snoozedUntil`.
- `subtasks.ts:addSubtask` throws when the task already has `SCHEMA_LIMITS.MAX_SUBTASKS` subtasks.
- `top-three-actions.ts` states these are the only writes top three makes. Each goes through `updateTask` and touches no other field.
- `top-three-actions.ts:movePick` writes nothing at either end of the list. `top-three-actions.ts:reorderPicks` skips rows whose rank is already right.

## Side Effects

- `dependencies.ts`, `subtasks.ts`, and `saved.ts` read and write the Dexie `tasks` table and add `syncQueue` entries through `runTaskSyncTransaction`.
- `top-three-actions.ts` writes through `updateTask` from `lib/tasks.ts`, one call per changed row.
- `import-export.ts:buildBackup` reads `tasks`, `archivedTasks`, `deletedTasks`, `smartViews`, `notificationSettings`, `archiveSettings`, and `appPreferences`.
- `import-export.ts:importTasks` writes `tasks`, `archivedTasks`, `deletedTasks`, `smartViews`, and the three settings tables. In replace mode it clears `tasks`, and clears `archivedTasks`, `deletedTasks`, and `smartViews` when the payload carries those keys.
- `import-export.ts:importTasks` enqueues `delete` and `create` sync operations when sync is on, then calls `scheduleSyncAfterChange` after the commit.
- `import-export.ts` logs through the `IMPORT` logger and reads the default reminder through `readDefaultReminder`.
- `import-check.ts`, `import-id-remap.ts`, `saved-placement.ts`, and `smart-view-import-bounds.ts`: None.

## Verification

- Run: `bun run test`
