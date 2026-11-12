# Write Operations

## Overview

This directory is the write side of the MCP server. It creates, updates, completes, and deletes single tasks, and it runs bulk operations on many tasks. It creates the next instance when a recurring task is completed. It removes a deleted task's ID from other tasks' dependencies. Every write goes to the PocketBase `tasks` collection.

## Interface

Single-task operations (`task-operations.ts`):

- `createTask(config, input)`: builds a task, moves URLs from the title into the description, validates it, and saves it unless `dryRun` is set. `notifyBefore` defaults to `DEFAULT_NOTIFY_BEFORE_MINUTES` (15). It returns a warning for a past due date and for more than 10 tags.
- `updateTask(config, input)`: applies a partial update after a fresh read and a conflict check.
- `completeTask(config, taskId, completed, options?)`: updates only `completed`. It can create the next recurring instance.
- `deleteTask(config, taskId, options?)`: deletes the task, then removes its ID from dependent tasks.
- `CreateTaskResult`, `UpdateTaskResult`, `DeleteTaskResult`: the result shapes of the three operations.

Bulk operations (`bulk-operations.ts`):

- `bulkUpdateTasks(config, requestedIds, operation, options?)`: applies one `BulkOperation` to deduplicated task IDs.
- `BulkUpdateResult`: `{updated, deleted, errors, conflicts, dryRun}`.
- `BULK_WRITE_CONCURRENCY`: the constant 4, the worker pool size for bulk writes.

Recurrence (`recurrence.ts`):

- `completesRecurringTask(current, completed)`: true when the change completes a recurring task.
- `buildRecurringInstance(completed)`: builds the next instance with a new ID, reset state, and the next due date.
- `createNextInstance(config, instance, ownerId, deviceId)`: saves the instance.

Dependency cleanup (`dependency-cleanup.ts`):

- `snapshotDependents(config, dependents)`: reads each dependent fresh and records its `clientUpdatedAt`.
- `cleanDependents(config, deletedIds, pending, deviceId, limiter)`: removes deleted IDs from each dependent's dependencies.
- `CleanupOutcome`, `PendingCleanup`: the outcome and snapshot types for cleanup.

PocketBase helpers (`helpers.ts`):

- `createTaskInPB`, `updateTaskInPB`, `deleteTaskInPB`: write by task ID and invalidate the task cache.
- `updateTaskInPBById`, `deleteTaskInPBById`, `updateTaskDependenciesInPBById`: write by PocketBase record ID without invalidating the cache.
- `fetchSinglePBTaskFresh(config, taskId)`: reads one record and skips the cache. It returns null on a confirmed 404.
- `fetchPBSnapshotForTasks`, `fetchPBRecordIdsForTasks`: fetch many records in one `getFullList` call.
- `getAuthInfo(config)`: returns the owner ID and the device ID `mcp-server`.
- `generateTaskId()`: returns a `randomUUID` with the dashes removed.
- `deriveQuadrant(urgent, important)`: maps the two flags to a quadrant string.
- `escapeFilterValue(value)`: escapes a value for a PocketBase filter.

Rate limiting (`write-rate-limiter.ts`):

- `WriteRateLimiter`: class with `run(operation)` and `getRateLimitCount()`. It serializes writes, spaces them, and retries a 429.
- `sanitizePocketBaseWriteError(error)`: maps an HTTP status to a safe error code and reads `Retry-After`.
- `SafeWriteError`: `{code, rateLimited, retryAfterMs, status?}`.

Input types (`types.ts`):

- `WriteOptions`, `CreateTaskInput`, `UpdateTaskInput`, `BulkOperation`.

## Invariants

- `bulk-operations.ts:BULK_MAX_TASKS`: a bulk call accepts at most 50 task IDs.
- `bulk-operations.ts:validateBulkRequest`: a bulk delete accepts at most 10 task IDs (`BULK_MAX_DELETES`).
- `bulk-operations.ts:bulkUpdateTasks`: IDs are deduplicated before the limits are checked.
- `bulk-operations.ts:bulkUpdateTasks`: a bulk delete is a dry run unless the caller passes `dryRun: false`. Other bulk operations write by default.
- `task-operations.ts:deleteTask`: a delete is a dry run unless the caller passes `dryRun: false`.
- `bulk-operations.ts:assertTagCapHolds`: `add_tags` rejects the whole batch before any write if a task would exceed `SCHEMA_LIMITS.MAX_TAGS`.
- `bulk-operations.ts:assertBulkOperationAllowed`: a bulk complete with `completed: true` throws if any task has `savedAt`. A bulk un-complete does not.
- `task-operations.ts:applyUpdate`: completing a task with `savedAt` throws.
- `bulk-operations.ts:processBulkTask`: a bulk item is skipped as a conflict if its fresh record is missing or its `clientUpdatedAt` changed.
- `task-operations.ts:assertFreshUpdatePreflight`: an update re-reads the task before writing. It throws `ConflictError` if `clientUpdatedAt` changed. It throws a plain `Error` ("was deleted between read and write") if the record is gone.
- `task-operations.ts:deletePrimaryTask`: a delete throws `ConflictError` if the record changed since the read. It compares the fresh `clientUpdatedAt` (or the record's `updated`) with `task.updatedAt` from the list read. A null fresh read throws a plain `Task not found` error.
- `task-operations.ts:deleteTask`: the order is list tasks, snapshot dependents, delete the task, clean dependents. A cleanup failure does not roll back the delete.
- `bulk-operations.ts:removeDeletedReferences`: cleanup problems after a bulk delete return as errors, never as conflicts.
- `task-operations.ts:createTask` and `validateUpdateDependencies`: dependencies pass `validateDependencies` before a write, or the call throws.
- `task-operations.ts:mergeDescriptionWithinLimit`: throws if the description exceeds `SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH` after title URLs are appended.
- `bulk-operations.ts:applyCompletion`: `completedAt` is set only on a change from incomplete to complete, and removed on `completed=false`.
- `recurrence.ts:completesRecurringTask`: true only when `completed` is true, the task was incomplete, and `recurrence` is not `none`.
- `recurrence.ts:calculateNextDueDate`: the next due date adds 1 day, 7 days, or 1 month in local time.
- `recurrence.ts:buildRecurringInstance`: the new instance has unchecked subtasks and `notificationSent=false`. It drops `completedAt`, `lastNotificationAt`, `snoozedUntil`, `focusDate`, and `focusRank`.
- `helpers.ts:isConfirmedNotFound`: a 404 counts as not found only after `confirmUsersPrincipal` succeeds.
- `helpers.ts:fetchSinglePBTaskFresh`: only a confirmed 404 returns null. Other errors propagate.
- `helpers.ts:updateTaskInPBById`: it does not invalidate the cache. Its caller `applyUpdate` calls `getTaskCache().invalidate()` after the write.
- `helpers.ts:escapeFilterValue`: throws for values over 500 characters (`MAX_FILTER_VALUE_LENGTH`). It escapes the backslash first, then the double quote.
- `helpers.ts:getAuthInfo`: `deviceId` is always `mcp-server`. `ownerId` comes from `requireUsersPrincipal`.
- `write-rate-limiter.ts:WriteRateLimiter`: writes are 100 ms apart (`WRITE_INTERVAL_MS`). Only a 429 is retried, once (`MAX_RATE_LIMIT_RETRIES`). `deleteTask` and `executeBulkWrite` each build a new limiter per call, so the spacing does not carry across tool calls. `createTask` and `applyUpdate` (which serves `updateTask` and `completeTask`) write without a limiter.
- `write-rate-limiter.ts:WriteRateLimiter.run`: operations through one limiter run one at a time.
- `dependency-cleanup.ts:cleanDependents`: cleanup logs record IDs and status codes only, never task content.

## Side Effects

- `helpers.ts:createTaskInPB`, `updateTaskInPB`, `deleteTaskInPB`: create, update, or delete a record in the PocketBase `tasks` collection, then invalidate the task cache.
- `helpers.ts:updateTaskInPBById`, `deleteTaskInPBById`, `updateTaskDependenciesInPBById`: update or delete a `tasks` record by record ID. In `deleteTask`, nothing invalidates the cache after the dependency cleanup writes.
- `helpers.ts:fetchSinglePBTaskFresh`, `fetchPBSnapshotForTasks`, `fetchPBRecordIdsForTasks`: read the `tasks` collection over the network. `fetchPBSnapshotForTasks` calls `confirmUsersPrincipal` when zero records return. `fetchPBRecordIdsForTasks` does not.
- `helpers.ts:getAuthInfo`: calls `requireUsersPrincipal` to resolve the owner.
- `bulk-operations.ts:executeBulkWrite`: reads snapshots, writes each item through a `WriteRateLimiter`, and invalidates the cache at the end. Each recurring instance it spawns also invalidates the cache through `createTaskInPB`. A bulk delete also calls `listTasksFresh` before any write. An empty snapshot returns `errors: ['No matching tasks found']` with no write. Each requested ID missing from the snapshot adds `Task <id>: not found in PocketBase` to `errors`.
- `bulk-operations.ts:previewBulkUpdate`: a dry run only calls `listTasksFresh`.
- `bulk-operations.ts:spawnNextInstance` and `recurrence.ts:createNextInstance`: create the next recurring instance in PocketBase.
- `task-operations.ts:applyUpdate`: does two fresh reads, one update, and one cache invalidation. A `dependencies` input adds a `listTasksFresh` read. A dry run returns after the first read, with no write and no invalidation. It can also create a recurring instance, which invalidates the cache a second time.
- `task-operations.ts:deletePrimaryTask`: does a fresh read and a delete inside the limiter, then invalidates the cache.
- `task-operations.ts:deleteTask`: with no dependents, it skips `getAuthInfo`, the snapshot, and the cleanup. `snapshotDependents` reads outside the limiter. Only the primary delete and the cleanup writes go through it.
- `dependency-cleanup.ts:cleanDependencySnapshot`: does a fresh read and an update of `dependencies` with a new timestamp.
- `write-rate-limiter.ts:wait`: waits with `setTimeout` between writes and after a 429 (the `Retry-After` value, or 200 ms).
- `bulk-operations.ts:executeBulkWrite` and `dependency-cleanup.ts:cleanDependents`: log through `createMcpLogger`. `bulk-operations.ts:spawnNextInstance` logs a warning when a spawn fails. The failure returns as an `errors` string, and the task still counts as `updated`.
- `write-rate-limiter.ts:WriteRateLimiter`: keeps state per instance. The directory has no module-level mutable state.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
