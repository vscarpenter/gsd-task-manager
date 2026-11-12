# Task CRUD

## Overview

This package holds the write paths for live tasks: create, update, complete, move, duplicate, snooze, time tracking, delete, and undo delete. Each mutation commits the task change and its sync queue entry in one Dexie transaction.

`index.ts` is the barrel. `helpers.ts` holds the shared transaction wrapper. `validation-error.ts` holds the typed validation error and its user-facing copy.

## Interface

- `list.ts:listTasks(): Promise<TaskRecord[]>`. Returns all rows of `tasks`, newest `createdAt` first.
- `list.ts:clearTasks(): Promise<void>`. Clears the `tasks` table.
- `create.ts:createTask(input: TaskDraft): Promise<TaskRecord>`. Validates a draft, builds a record, and adds it to `tasks`.
- `update.ts:updateTask(id: string, updates: Partial<TaskDraft>): Promise<TaskRecord>`. Merges partial updates over a stored task and writes it.
- `toggle.ts:toggleCompleted(id: string, completed: boolean): Promise<ToggleCompletedResult>`. Sets completion. Completing a recurring task also adds its next instance.
- `toggle.ts:ToggleCompletedResult`. Interface with `task` and `recurringInstance` (the spawned task, or `null`).
- `delete.ts:deleteTask(id: string): Promise<void>`. Moves a task from `tasks` to `deletedTasks`.
- `restore.ts:restoreTask(task: TaskRecord): Promise<void>`. Puts the exact record back in `tasks`. This is the undo path for delete.
- `move.ts:moveTaskToQuadrant(id: string, targetQuadrant: QuadrantId): Promise<TaskRecord>`. Sets `urgent`, `important`, and `quadrant` for a drag and drop move.
- `duplicate.ts:duplicateTask(id: string): Promise<TaskRecord>`. Adds a copy with a new id and a `" (Copy)"` title suffix.
- `snooze.ts:snoozeTask(id: string, minutes: number): Promise<TaskRecord>`. Sets `snoozedUntil`. Zero minutes clears it.
- `snooze.ts:clearSnooze(id: string): Promise<TaskRecord>`. Calls `snoozeTask(id, 0)`.
- `snooze.ts:isTaskSnoozed(task: TaskRecord): boolean`. True when `snoozedUntil` is in the future.
- `snooze.ts:getRemainingSnoozeMinutes(task: TaskRecord): number`. Minutes left, rounded up, never below zero.
- `snooze.ts:formatSnoozeRemaining(minutes: number): string`. Short form such as `45m`, `2h`, or `3d`.
- `time-tracking.ts:startTimeTracking(taskId: string): Promise<TaskRecord>`. Appends an open time entry.
- `time-tracking.ts:stopTimeTracking(taskId: string, notes?: string): Promise<TaskRecord>`. Closes the open entry and recomputes `timeSpent`.
- `time-tracking.ts:hasRunningTimer(task: TaskRecord): boolean`. True when an entry has no `endedAt`.
- `time-tracking.ts:getRunningEntry(task: TaskRecord): TimeEntry | undefined`. Returns the open entry.
- `time-tracking.ts:formatTimeSpent(minutes: number): string`. Formats minutes as `< 1m`, `Nm`, `Nh`, or `Nh Nm`.
- `helpers.ts:runTaskSyncTransaction<T>(mutation): Promise<T>`. Runs a mutation in the shared task and sync transaction.
- `helpers.ts:scheduleSyncAfterChange(): void`. Schedules a debounced background sync when the manager is running.
- `helpers.ts:getSyncContext()`. Returns `syncConfig` and `deviceId` (`"local"` when unset).
- `helpers.ts:enqueueSyncOperation(operation, taskId, data, syncEnabled): Promise<void>`. Enqueues one sync operation outside the transaction wrapper. It does nothing when `syncEnabled` is false. It calls `scheduleSyncAfterChange()` right after the enqueue.
- `helpers.ts:SyncOperation`, `helpers.ts:TransactionalSyncEnqueue`, `helpers.ts:TaskSyncTransactionContext`. Types for the wrapper. `SyncOperation` is `"create" | "update" | "delete"`.
- `validation-error.ts:TaskValidationError`. Error class with `issues` and a static `fromZod(error, summary)`.
- `validation-error.ts:TaskValidationIssue`. Interface with `path`, `code`, and optional `origin` and `maximum`.
- `validation-error.ts:LimitedField`. Type `"title" | "description" | "tags" | "subtasks"`.
- `validation-error.ts:stringLimitMessage(field, maximum): string`. The sentence for a field at its length limit.
- `validation-error.ts:taskValidationMessage(error: unknown): string | null`. A sentence the user can act on, or `null`.
- `index.ts`. Re-exports the task operations from `list`, `create`, `update`, `toggle`, `delete`, `restore`, `move`, `duplicate`, `snooze`, and `time-tracking`. It does not re-export `helpers.ts` or `validation-error.ts`.

## Invariants

- `helpers.ts:runTaskSyncTransaction` opens one `"rw!"` transaction over `tasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`. A narrower scope would make delete and restore non-atomic (ADR 0015).
- `helpers.ts:runTaskSyncTransaction` requires an async function as the transaction scope. With a plain arrow, Dexie rejects the commit as premature (WEB-UNDO-SIGNED-IN).
- `helpers.ts:runTaskSyncTransaction` reads the sync config before it opens the transaction. It schedules background sync only after the commit, and only when it enqueued something.
- `delete.ts:deleteTask` moves the row between `tasks` and `deletedTasks` in one transaction. An id lives in exactly one lifecycle table (ADR 0013).
- `delete.ts:deleteTask` writes `deletedTasks` with `put`, never `add`. Deleting a restored task again must not raise a `ConstraintError`.
- `delete.ts:deleteTask` enqueues a `delete` when sync is on. When sync is off it calls `rememberForResurrect([id])` in the same transaction.
- `delete.ts:deleteTask` is idempotent. A missing id succeeds without an error.
- `restore.ts:restoreTask` uses `put`, deletes the `deletedTasks` row for the same id, and calls `forgetForResurrect`. Leaving the trash row would put one id in two lifecycle tables (ADR 0013).
- `restore.ts:restoreTask` does not restore inbound dependency edges that the delete removed.
- `create.ts:createTask` extracts URLs from the title on every call, so every creation path gets the same link handling. The step is idempotent.
- `create.ts:createTask` and `update.ts:mergeTaskUpdates` always store a numeric `notifyBefore` (D-10). A missing value resolves to the device default. Off is `notificationEnabled`.
- `create.ts:createTask` never logs the raw input. Validation failures log field paths and Zod codes only.
- `update.ts:updateTask` passes the raw `updates` object to `logger.error` on any failure. `lib/logger.ts:sanitizeMetadata` recurses into it and masks the keys `title`, `description`, `tags`, `subtasks`, and `notes` before output.
- `update.ts:keepUnlessGiven` clears `dueDate`, `estimatedMinutes`, `focusDate`, and `focusRank` when the key is present with `undefined`. An absent key keeps the stored value. For `notifyBefore`, `update.ts:mergeTaskUpdates` resolves an explicit `undefined` to the device default.
- `update.ts:assertWholeFocusPair` requires `focusDate` and `focusRank` to be set together or not at all.
- `update.ts:validateUpdatedDraft` moves links to the description only when `updates.title` is given.
- `update.ts:buildUpdatedRecord` resets `notificationSent`, `lastNotificationAt`, and `snoozedUntil` when the due date or reminder offset changes.
- `update.ts:updateTask` rethrows `TaskValidationError` with its type intact.
- `toggle.ts:withCompletionLock` serializes toggles per task id through an in-memory promise chain.
- `toggle.ts:getCompletableTask` throws when the task has `savedAt`. A saved item returns to the matrix before it completes.
- `toggle.ts:toggleCompletedTransaction` spawns a recurring instance only when `completed` is true, the task was not complete, and `recurrence` is not `"none"`.
- `toggle.ts:buildRecurringInstance` sets `parentTaskId` to the chain's first id, resets subtask completion, and clears `focusDate` and `focusRank`.
- `duplicate.ts:copyTitle` shortens the original title so the suffixed title stays within `SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH`.
- `duplicate.ts:buildDuplicateRecord` deletes the `archivedAt` key instead of setting it to `undefined`. The strict export schema would otherwise drop the copy from backups.
- `snooze.ts:snoozeTask` throws for negative minutes and for minutes above `TIME_TRACKING.MAX_SNOOZE_MINUTES`. A new snooze sets `notificationSent` to `false`.
- `time-tracking.ts:startTimeTracking` throws when the task already has a running timer. `time-tracking.ts:stopTimeTracking` throws when none is running.
- `time-tracking.ts:stopTimeTracking` validates `notes` against `timeEntrySchema.shape.notes` before it opens the transaction.
- `validation-error.ts:TaskValidationIssue` carries names, codes, and limits only, never the user's text.

## Side Effects

- Every mutation reads and writes the Dexie `tasks` table and, when sync is on, adds a `syncQueue` entry through `getSyncQueue().enqueue`.
- `delete.ts:deleteTask` writes `deletedTasks`, rewrites tasks that depended on the deleted id (`removeDependencyReferencesInTransaction`), and may write the remembered-ids row in `syncMetadata`.
- `restore.ts:restoreTask` deletes from `deletedTasks` and updates the remembered-ids row in `syncMetadata`.
- `list.ts:clearTasks` clears `tasks` with no sync queue entry and no transaction wrapper.
- `helpers.ts:runTaskSyncTransaction` reads `syncMetadata` through `getSyncConfig`.
- `helpers.ts:scheduleSyncAfterChange` calls `getBackgroundSyncManager().scheduleDebouncedSync()`, which starts a debounce timer.
- `create.ts:createTask`, `update.ts:updateTask`, and `duplicate.ts:duplicateTask` call `readDefaultReminder()` from `lib/notifications/default-reminder.ts`.
- `toggle.ts` keeps a module-level `completionLocks` map in memory.
- The operation files log through `createLogger` (`TASK_CRUD` or `TIME_TRACKING`). `helpers.ts`, `validation-error.ts`, and `index.ts` log nothing.

## Verification

- Run: `bun run test`
