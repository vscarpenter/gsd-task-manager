# MCP Server Source

## Overview

This directory is the TypeScript source of the `gsd-mcp-server` package. Its direct files hold the stdio entry point, the in-memory task cache, the PocketBase client, the dependency rules, the top-three rules, the task type mappers, the payload limits, and the typed errors. Four direct files (`analytics.ts`, `cli.ts`, `tools.ts`, `write-ops.ts`) only re-export from subdirectories.

## Interface

Entry point (`index.ts`):

- `index.ts` exports nothing. It is the `bin` entry and calls its private `main()` at module load.
- `main()` calls `parseCLIArgs(process.argv)`. Mode `help` calls `showHelp()`, `setup` calls `runSetupWizard()`, and `validate` calls `runValidation()`.
- In any other mode, `main()` calls `startMcpServer()`. On a throw it calls `reportStartupFailure(error)` and exits with code 1.

Cache (`cache.ts`):

- `getTaskCache(config?)`: returns the cache singleton. It uses `config` only on the first call.
- The singleton has `getTaskList`, `setTaskList`, `getTask`, `setTask`, `invalidate`, `invalidateTask`, `getStats`, and `resetStats`.
- `resetTaskCache()`: clears the singleton and its statistics.
- `generateTaskListCacheKey(filters?, namespace?)`: builds a list cache key from the filters.
- `taskCacheNamespace(config)`: returns a SHA-256 hex digest of the PocketBase URL and the auth token.
- `CacheConfig`, `DEFAULT_CACHE_CONFIG`: the config shape and its default, `{ ttlMs: 30000, maxEntries: 1000 }`.

PocketBase client (`pocketbase-client.ts`):

- `getPocketBase(config)`: returns a cached PocketBase SDK instance. It throws `SuperuserPrincipalError` for a superuser token.
- `requireUsersPrincipal(config)`: returns `{ pb, ownerId }`. It refreshes auth only when the store has a token but no record ID.
- `confirmUsersPrincipal(config)`: always refreshes auth, then requires a `users` record.
- `assertNonSuperuserPrincipal(config)`: rejects a superuser token without a network call.
- `getCurrentUserId(config)`: returns the record ID, or throws if the record is not a normal `users` account.
- `clearPocketBase()`: clears the auth store and the cached instance.

Dependencies (`dependencies.ts`):

- `validateDependencies(taskId, dependencies, allTasks)`: returns `{ valid, error? }` after self, missing, completed, and circular checks.
- `getAffectedByDeletion(taskId, allTasks)`: returns the tasks whose dependencies include `taskId`.
- `formatDependencyError(error)`: wraps the error text for display.

Top three (`top-three.ts`):

- `todaysPicks(tasks, now, zone)`: returns today's picked IDs, the overflow IDs, and a `needsTidy` flag.
- `suggestTopThree(tasks, now, windowDays, zone)`: returns ordered suggestions, skipping tasks that are already picked.
- `evaluateEscalation(task, now, windowDays, timeZone)`: returns an `EscalationResult`. A null `windowDays` turns escalation off.
- `daysUntilDue(dueDate, now, timeZone)`, `localDate(now, zone)`: date helpers for a time zone.
- `MAX_PICKS`: the constant 3.
- `TopThreeTask`, `TodaysPicks`, `EscalationResult`: the related types.

Types and mappers (`types.ts`):

- `GsdConfig`: `{ pocketBaseUrl: string; authToken: string }`.
- `Task`, `PBTask`, `TaskFilters`, `SyncStatus`, `TaskStats`, `PBTaskSnapshotFields`: the task and status types.
- `pbTaskToTask(pb)`: maps a PocketBase record to a `Task`.
- `taskToPBFields(task, ownerId, deviceId)`: maps a `Task` to PocketBase fields.
- `taskDependencyPatchToPBFields(dependencies, clientUpdatedAt, deviceId)`: returns the fields for a dependency-only update.
- `pbTaskSnapshotFields(record)`: returns `{ taskId, clientUpdatedAt }`.
- `syncStatusSchema`: a Zod object `{ code, message }`.

Constants, errors, version:

- `SCHEMA_LIMITS` (`constants.ts`): the field limits listed under Invariants.
- `DEFAULT_NOTIFY_BEFORE_MINUTES` (`constants.ts`): 15.
- `ConflictError` (`errors.ts`): has `taskId`, `readClientUpdatedAt`, and `currentClientUpdatedAt`.
- `SuperuserPrincipalError` (`errors.ts`): thrown when the token belongs to a PocketBase superuser.
- `VERSION` (`version.ts`): the `package.json` version string, read at module load.

Re-export files:

- `analytics.ts`: re-exports the types and functions of [analytics](./analytics/README.md). The file is marked `@deprecated`.
- `cli.ts`: re-exports `parseCLIArgs`, `showHelp`, `getClaudeConfigPath`, `prompt`, `promptPassword`, `runSetupWizard`, `runValidation`, `CLIOptions`, and `ValidationCheck`.
- `tools.ts`: re-exports `listTasks`, `getTask`, `searchTasks`, `getSyncStatus`, and `getTaskStats`. From `types.ts` it re-exports only `GsdConfig`, `SyncStatus`, `TaskStats`, `Task`, `TaskFilters`, `PBTask`, `syncStatusSchema`, `pbTaskToTask`, and `taskToPBFields`.
- `write-ops.ts`: re-exports `createTask`, `updateTask`, `completeTask`, `deleteTask`, `bulkUpdateTasks`, their result and input types, and six helpers.

Subdirectories:

- [analytics](./analytics/README.md): productivity metrics, streaks, deadline groups, and the insights summary.
- [api](./api/README.md): host redaction, and a GET and retry helper that no tool uses.
- [auth](./auth/README.md): offline grading of the auth token's expiry.
- [cli](./cli/README.md): flag parsing, the setup wizard, and the configuration validator.
- [server](./server/README.md): configuration loading, MCP request handlers, and stdio startup.
- [text](./text/README.md): URL extraction from titles and tag normalization.
- [tools](./tools/README.md): read functions, prompts, tool definitions, and tool call handlers.
- [utils](./utils/README.md): the stderr logger.
- [write-ops](./write-ops/README.md): single and bulk task writes, recurrence, and dependency cleanup.

## Invariants

- `constants.ts:SCHEMA_LIMITS`: ID 4 to 255 characters, title 80, description 600, tag 30, subtask title 100.
- `constants.ts:SCHEMA_LIMITS`: at most 20 tags, 50 subtasks, 50 dependencies, and 50 tasks per bulk call.
- `constants.ts:SCHEMA_LIMITS` comment: the limits mirror the web app's task schema.
- `cache.ts:DEFAULT_CACHE_CONFIG`: the TTL is 30 seconds and each cache holds at most 1000 entries.
- `cache.ts:TTLCache.get`: an expired entry is deleted on read. There is no timer.
- `cache.ts:TTLCache.set`: at `maxEntries`, the first inserted key is deleted.
- `cache.ts:TaskCacheManager.singleTaskKey`: throws when the namespace is empty.
- `cache.ts:TaskCacheManager.invalidateTask`: it also clears the whole task list cache.
- `cache.ts:taskCacheNamespace` comment: a bearer token is never placed in a cache key or a diagnostic surface.
- `dependencies.ts:validateDependencies`: a task cannot depend on itself, on an unknown task, or on a completed task.
- `dependencies.ts:wouldCreateCircularDependency`: a breadth-first search from the dependency must not reach the task.
- `pocketbase-client.ts:PRINCIPAL_REJECTION_STATUSES`: in `refreshPrincipal`, only 401 and 403 retire a token. Statuses 0, 404, 429, and 5xx do not. `usersOwnerId` and `getPocketBase` also clear the token for a refused principal, with no status involved.
- `pocketbase-client.ts:usersOwnerId`: the principal must be a record in `users` that is not a superuser.
- `pocketbase-client.ts:unreachableError` comment: the message does not advise rotating credentials, and the host is redacted.
- `top-three.ts:MAX_PICKS`: at most 3 picks. A valid `focusRank` is an integer from 1 to 3.
- `top-three.ts:isEligible`: completed tasks and Saved tasks are not picked or suggested.
- `top-three.ts:evaluateEscalation`: escalation needs a due date, a `windowDays` value, and a task that is not completed, Saved, or urgent.
- `types.ts:pbTaskToTask`: an unknown recurrence becomes `none`.
- `types.ts:focusPick`: `focusDate` and `focusRank` are kept only as a valid pair.
- `types.ts:focusToWire`: an unset pair is written as `focus_date` `''` and `focus_rank` 0.
- `version.ts:readVersion`: returns `0.0.0` if `package.json` cannot be read.
- `index.ts:main` comment: startup touches only local state, so a PocketBase outage does not stop the server from starting.

## Side Effects

- `index.ts:main`: reads `process.argv` and runs at module load. It calls `process.exit` after help, setup, validate, or a startup failure.
- `index.ts`: writes a fatal error to stderr with `console.error`.
- `cache.ts:cacheInstance`: a module-level singleton with two TTL caches and hit and miss counters.
- `pocketbase-client.ts:pbInstance`: a module-level PocketBase singleton with its cached URL and token.
- `pocketbase-client.ts:refreshPrincipal`: calls `authRefresh` on the `users` collection over the network.
- `pocketbase-client.ts:getPocketBase`: saves and clears the auth store token, and adds an `afterSend` hook for 429 responses.
- `version.ts:readVersion`: reads `../package.json` from disk at module load.
- No direct file in this directory reads `process.env` or sets a timer.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
