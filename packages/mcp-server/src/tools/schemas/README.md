# Tool Schemas

## Overview

This directory declares the MCP `Tool` definitions that the server advertises to clients. Each definition has a name, a description, and a JSON Schema `inputSchema`. The directory holds no handlers and no runtime logic. `index.ts` combines four groups into `allTools`, which lists 20 tools.

## Interface

Read tools (`read-tools.ts`, grouped in `readTools`, 7 tools):

- `getSyncStatusTool`: tool `get_sync_status`. It takes no input.
- `getTaskStatsTool`: tool `get_task_stats`. It takes no input.
- `listTasksTool`: tool `list_tasks`. Optional `quadrant`, `completed`, and `tags`.
- `getTaskTool`: tool `get_task`. Requires `taskId`.
- `searchTasksTool`: tool `search_tasks`. Requires `query`.
- `getTokenStatusTool`: tool `get_token_status`. It takes no input.
- `getTopThreeTool`: tool `get_top_three`. Optional `timeZone`.

Analytics tools (`analytics-tools.ts`, grouped in `analyticsTools`, 5 tools):

- `getProductivityMetricsTool`: tool `get_productivity_metrics`. It takes no input.
- `get_quadrant_analysis`: defined in a module-private constant. It takes no input.
- `getTagAnalyticsTool`: tool `get_tag_analytics`. Optional `limit`.
- `get_upcoming_deadlines`: defined in a module-private constant. It takes no input.
- `get_task_insights`: defined in a module-private constant. It takes no input.

Write tools (`write-tools.ts`, grouped in `writeTools`, 5 tools):

- `createTaskTool`: tool `create_task`. Requires `title`, `urgent`, and `important`.
- `updateTaskTool`: tool `update_task`. Requires `id`.
- `completeTaskTool`: tool `complete_task`. Requires `id` and `completed`.
- `deleteTaskTool`: tool `delete_task`. Requires `id`.
- `bulkUpdateTasksTool`: tool `bulk_update_tasks`. Requires `taskIds` and `operation`, and `operation` requires `type`.

System tools (`system-tools.ts`, grouped in `systemTools`, 3 tools):

- `validateConfigTool`: tool `validate_config`. It takes no input.
- `getHelpTool`: tool `get_help`. Optional `topic`.
- `getCacheStatsTool`: tool `get_cache_stats`. Optional `reset`.

Aggregate (`index.ts`):

- `allTools`: spreads `readTools`, `analyticsTools`, `writeTools`, and `systemTools` in that order.
- `index.ts` re-exports every exported symbol of the four tool files with `export *`.

## Invariants

- `index.ts:allTools` holds 20 tools: 7 read, 5 analytics, 5 write, 3 system. Its comment states the same total.
- No tool definition in this directory has an `annotations` field.
- `read-tools.ts:listTasksTool` limits `quadrant` to `urgent-important`, `not-urgent-important`, `urgent-not-important`, and `not-urgent-not-important`.
- `read-tools.ts:getTopThreeTool` caps `timeZone` at 64 characters.
- `analytics-tools.ts:getTagAnalyticsTool` requires `limit` to be an integer of at least 1.
- `system-tools.ts:getHelpTool` limits `topic` to `tools`, `analytics`, `setup`, `examples`, and `troubleshooting`.
- `write-tools.ts` takes its maximum lengths and item counts from `SCHEMA_LIMITS` in `../../constants.ts`. The `estimatedMinutes` bounds and the `notifyBefore` minimum are literals.
- `write-tools.ts:createTaskTool` and `updateTaskTool` cap `title` at 80 characters and `description` at 600. `title` has `minLength: 1`.
- `write-tools.ts:updateTaskTool`, `completeTaskTool`, and `deleteTaskTool` require `id` to be 1 to 255 characters.
- `write-tools.ts:createTaskTool` and `updateTaskTool` allow at most 20 tags of 1 to 30 characters each.
- `write-tools.ts:createTaskTool` allows at most 50 subtasks. Each needs `title` (1 to 100 characters) and `completed`.
- `write-tools.ts:updateTaskTool` allows at most 50 subtasks. Subtasks need `id`, `title`, and `completed`. The `id` is 4 to 255 characters.
- `write-tools.ts:createTaskTool` and `updateTaskTool` limit `recurrence` to `none`, `daily`, `weekly`, and `monthly`.
- `write-tools.ts:createTaskTool` and `updateTaskTool` allow at most 50 dependencies of 1 to 255 characters each.
- `write-tools.ts:createTaskTool` and `updateTaskTool` require `notifyBefore` to be an integer of at least 0.
- `write-tools.ts:createTaskTool` and `updateTaskTool` require `estimatedMinutes` to be an integer from 1 to 10080.
- `write-tools.ts:bulkUpdateTasksTool` accepts 1 to 50 `taskIds` of 1 to 255 characters each. `operation.tags` takes 1 to 20 tags of 1 to 30 characters each. The schema does not encode the 10-task delete limit that its description states.
- `write-tools.ts:bulkUpdateTasksTool` limits `operation.type` to `complete`, `move_quadrant`, `add_tags`, `remove_tags`, `set_due_date`, and `delete`.
- `write-tools.ts:deleteTaskTool` describes `dryRun` as defaulting to true. The schema itself sets no default. `bulkUpdateTasksTool` does the same for delete operations.

## Side Effects

- None

## Verification

- Run: `bun run --cwd packages/mcp-server test`
