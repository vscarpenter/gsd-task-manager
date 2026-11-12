# Tool Handlers

## Overview

This directory is the server's tool call layer. A dispatcher checks each call's arguments with Zod, then routes 20 tool names to handler functions. Each handler calls functions from sibling modules and wraps the result in an MCP text response.

## Interface

Dispatcher (`index.ts`):

- `handleToolCall(name, args, config)`: checks the tool name, runs the registered handler, and returns a thrown error as a text response with `isError: true`.
- `REGISTERED_TOOL_NAMES`: frozen array of the keys of the module-private `toolRegistry`.
- `toolRegistry` handles exactly these tool names: `get_sync_status`, `get_task_stats`, `list_tasks`, `get_task`, `search_tasks`, `get_token_status`, `get_top_three`, `get_productivity_metrics`, `get_quadrant_analysis`, `get_tag_analytics`, `get_upcoming_deadlines`, `get_task_insights`, `create_task`, `update_task`, `complete_task`, `delete_task`, `bulk_update_tasks`, `validate_config`, `get_help`, `get_cache_stats`.
- `index.ts` re-exports every handler file with `export *`, and the `McpToolResponse` type.

Input validation (`input-schemas.ts`):

- `validateToolArgs(toolName, args)`: parses `args` with the tool's Zod schema and returns the parsed data. For a tool name with no schema, it returns `args` unchanged and unvalidated.
- `toolArgSchemas`: constant map from the 20 tool names to their Zod schemas.
- `ToolName`, `ToolArgs<Name>`: the key type of `toolArgSchemas` and the parsed output type for one tool.
- Per-tool schemas: `listTasksArgsSchema`, `getTaskArgsSchema`, `searchTasksArgsSchema`, `getTagAnalyticsArgsSchema`, `getHelpArgsSchema`, `getCacheStatsArgsSchema`, `getTopThreeArgsSchema`, `emptyArgsSchema`.
- Write schemas: `createTaskArgsSchema`, `updateTaskArgsSchema`, `completeTaskArgsSchema`, `deleteTaskArgsSchema`, `bulkUpdateTasksArgsSchema`.

Read handlers (`read-handlers.ts`):

- `handleGetSyncStatus(config)`: returns the sync status with `authenticated` and a redacted `pocketBaseUrl`.
- `handleGetTokenStatus(config)`: returns `getTokenStatus(config.authToken)` as JSON.
- `handleGetTaskStats(config)`, `handleListTasks(config, args)`, `handleGetTask(config, args)`, `handleSearchTasks(config, args)`: return the matching read function's result as JSON.

Top three (`top-three-handler.ts`):

- `handleGetTopThree(config, {timeZone?})`: returns `date`, `timeZone`, today's `picks`, `needsTidy`, and up to `MAX_PICKS` `suggestions`.

Analytics handlers (`analytics-handlers.ts`):

- `handleGetProductivityMetrics(config)`: returns `calculateMetrics(tasks)` as JSON.
- `handleGetQuadrantAnalysis(config)`: returns `getQuadrantPerformance(tasks)` as JSON.
- `handleGetTagAnalytics(config, {limit?})`: returns `tagStats`, cut to `limit` entries when a limit is given.
- `handleGetUpcomingDeadlines(config)`: returns `getUpcomingDeadlines(tasks)` as JSON.
- `handleGetTaskInsights(config)`: returns `generateInsightsSummary(tasks)` as plain text.

Write handlers (`write-handlers.ts`):

- `handleCreateTask(config, args)`: calls `createTask` and returns a dry-run preview or the created task with warnings.
- `handleUpdateTask(config, args)`: calls `updateTask` and reports the changes and the resulting task. It never reports `recurringInstance`, though `updateTask` creates one when an update completes a recurring task. Only its dry-run branch reports `validation.warnings`.
- `handleCompleteTask(config, {id, completed, dryRun?})`: calls `completeTask` and reports the task and any `recurringInstance`.
- `handleDeleteTask(config, {id, dryRun?})`: calls `deleteTask` and reports affected dependents, conflicts, and cleanup errors.
- `handleBulkUpdateTasks(config, {taskIds, operation, dryRun?})`: calls `bulkUpdateTasks` and reports counts, errors, and conflicts.

System handlers (`system-handlers.ts`):

- `handleValidateConfig(config)`: runs three checks (PocketBase Connectivity, Authentication, Task Access) and returns `{checks}`.
- `handleGetHelp({topic?})`: returns one help section for a known topic, or every section as markdown. With no topic, it appends an "Additional Resources" section that no topic returns.
- `handleGetCacheStats({reset?})`: returns hit rate, hits, misses, and the size, `maxEntries`, and TTL of both caches. It also returns a fixed `notes` array, and `statsReset: true` after a reset.

Types (`types.ts`):

- `McpToolResponse`: `{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }`.

## Invariants

- `index.ts:handleToolCall`: a name that is not a key of `toolArgSchemas` produces an `Unknown tool` error response.
- `index.ts:createToolRunner`: a handler receives its arguments only after `validateToolArgs` succeeds.
- `index.ts:toolRegistry`: it satisfies `Record<ToolName, ToolRunner>`, so a tool needs both a schema and a handler.
- `index.ts:WRITE_TOOL_NAMES`: for the five write tools, an error with a numeric `status` is reduced to a safe code by `sanitizePocketBaseWriteError`.
- `input-schemas.ts:toolArgSchemas`: every top-level argument schema is a `z.strictObject`. The bulk `operation` variants and the subtask items are plain `z.object`, so unknown keys inside them are stripped, not rejected.
- `input-schemas.ts` header comment: these schemas mirror the JSON Schemas in [`../schemas`](../schemas/README.md) and must stay in sync.
- `input-schemas.ts:validateToolArgs`: a failed parse throws `Invalid arguments for <tool>:` with one line per issue.
- `input-schemas.ts:idSchema`: an ID is 1 to 255 characters. `subtaskIdSchema` requires at least 4.
- `input-schemas.ts:taskTitleSchema` and `taskDescriptionSchema`: a title is 1 to 80 characters. A description is at most 600.
- `input-schemas.ts:tagsSchema`: tags are normalized first, then validated. Each tag is 1 to 30 characters, with at most 20 tags.
- `input-schemas.ts:nonEmptyTagsSchema`: `add_tags` and `remove_tags` need at least one tag after normalization.
- `input-schemas.ts:subtaskTitleSchema`: a subtask title is 1 to 100 characters, with at most 50 subtasks per task.
- `input-schemas.ts:dependenciesSchema`: at most 50 dependency IDs.
- `input-schemas.ts:bulkUpdateTasksArgsSchema`: `taskIds` holds 1 to 50 IDs.
- `input-schemas.ts:estimatedMinutesSchema` and `notifyBeforeSchema`: `estimatedMinutes` is an integer from 1 to 10080. `notifyBefore` is an integer of at least 0.
- `input-schemas.ts:timeZoneSchema`, `searchTasksArgsSchema`, and `getTagAnalyticsArgsSchema`: `timeZone` is 1 to 64 characters. `query` is at least 1 character. `limit` is a positive integer.
- `input-schemas.ts:optionalIsoDatetime`: `dueDate` is an ISO 8601 datetime with an offset. `update_task` and `set_due_date` also accept an empty string, which clears it.
- `top-three-handler.ts:resolveTimeZone`: an invalid zone throws `Unknown time zone`.
- `top-three-handler.ts:DEFAULT_ESCALATION_WINDOW_DAYS`: the escalation window is fixed at 2 days.
- `write-handlers.ts:handleBulkUpdateTasks`: the response sets `isError: true` when `errors` or `conflicts` is not empty. This includes a dry run whose result carries an error such as `No matching tasks found`.
- `write-handlers.ts:handleDeleteTask`: the response never sets `isError`, even when `result.partial` is true.
- `system-handlers.ts:handleValidateConfig`: each check catches its own error and records status `error`.
- `read-handlers.ts:handleGetSyncStatus` and `system-handlers.ts:handleValidateConfig`: the PocketBase URL appears only through `redactPocketBaseHost`.

## Side Effects

- `read-handlers.ts`: the handlers call `getSyncStatus`, `getTaskStats`, `listTasks`, `getTask`, and `searchTasks` from `../../tools.ts`.
- `read-handlers.ts:handleGetSyncStatus`: calls `getPocketBase` from `../../pocketbase-client.ts` to read `authStore.isValid`.
- `read-handlers.ts:handleGetTokenStatus`: calls `getTokenStatus` from `../../auth/token-status.ts`.
- `analytics-handlers.ts`: all five handlers call `listTasks`, then a function from `../../analytics.ts`.
- `top-three-handler.ts:handleGetTopThree`: calls `listTasks` and `../../top-three.ts`, and reads the clock with `new Date()`.
- `top-three-handler.ts:resolveTimeZone`: reads the host time zone from `Intl.DateTimeFormat` when no zone is given.
- `write-handlers.ts`: the handlers call `createTask`, `updateTask`, `completeTask`, `deleteTask`, and `bulkUpdateTasks` from `../../write-ops.ts`.
- `system-handlers.ts:handleValidateConfig`: calls `getPocketBase(config).health.check()`, `getSyncStatus`, and `listTasks`.
- `system-handlers.ts:handleGetCacheStats`: reads `getTaskCache().getStats()` and calls `resetStats()` when `reset` is true.
- No file in this directory reads `process.env`, writes to the console, or touches the filesystem directly.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
