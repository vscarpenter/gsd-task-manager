# Tools

## Overview

The direct files in this directory hold the read functions and the MCP prompt templates. They list and filter tasks from PocketBase through a cache, look up one task, search text, and report sync health and task statistics. Two subdirectories hold the tool definitions and the tool call handlers.

## Interface

Read functions:

- `listTasks(config, filters?)` (`list-tasks.ts`): returns tasks that are not Saved, from the cache or PocketBase, filtered by quadrant, completion, and tags.
- `listTasksFresh(config)` (`list-tasks.ts`): fetches tasks straight from PocketBase and skips the cache. It does not drop Saved tasks.
- `getTask(config, taskId)` (`get-task.ts`): calls `listTasks` and returns the task with the matching `id`.
- `searchTasks(config, query)` (`search-tasks.ts`): returns tasks whose title, description, tags, or subtask titles contain the query, ignoring case.
- `getSyncStatus(config)` (`sync-status.ts`): returns `{ healthy, taskCount, lastSyncAt }` from a health check and a task count.
- `getTaskStats(config)` (`sync-status.ts`): returns total, active, and completed counts, with `lastUpdated`, `oldestTask`, and `newestTask`.

Prompts (`prompts.ts`):

- `allPrompts`: six prompts named `daily-standup`, `weekly-review`, `focus-mode`, `upcoming-deadlines`, `productivity-report`, and `tag-analysis`.
- `getPromptMessage(name)`: returns a user message with the fixed template text for that prompt.

Subdirectories:

- [handlers](./handlers/README.md): the tool call dispatcher, Zod input validation, and one handler per tool.
- [schemas](./schemas/README.md): the 20 MCP `Tool` definitions that the server advertises.

## Invariants

- `list-tasks.ts:applyTaskFilters`: tasks with `savedAt` are always dropped, even when no filter is passed.
- `list-tasks.ts:listTasks`: only the unfiltered list is cached. A filtered request filters the cached full list locally.
- `list-tasks.ts:fetchTaskRecords`: it reads the `tasks` collection sorted by `-client_updated_at`, with no filter expression.
- `list-tasks.ts:fetchTasks`: it calls `confirmUsersPrincipal` when zero records return, because a refused token reads as a guest.
- `list-tasks.ts:fetchTasks`: a record that fails to map is logged and dropped. It does not fail the call.
- `list-tasks.ts:matchesAnyTag`: stored tags are normalized before the comparison.
- `get-task.ts:getTask`: throws `Task not found` when no listed task matches. A Saved task is therefore not found.
- `prompts.ts:getPromptMessage`: throws `Unknown prompt` for a name that has no template.
- `sync-status.ts:getSyncStatus`: it requires a users principal before the health check.
- `sync-status.ts:getSyncStatus`: `taskCount` comes from an unfiltered count, so it includes Saved tasks.
- `sync-status.ts:getSyncStatus`: `lastSyncAt` is always null.
- `sync-status.ts:getSyncStatus`: it does not throw. Any error returns `{ healthy: false, taskCount: 0, lastSyncAt: null }`.
- `sync-status.ts:getTaskStats`: it leaves out records with `saved_at`.
- `sync-status.ts:getTaskStats`: an error inside its `try` returns stats with every field null. It throws when `getPocketBase` refuses a superuser token.

## Side Effects

- `list-tasks.ts:fetchTaskRecords`: calls `getFullList` on the PocketBase `tasks` collection over the network.
- `list-tasks.ts:listTasks`: reads the task cache, and writes it after an unfiltered fetch.
- `list-tasks.ts:listTasksFresh`: always fetches from PocketBase. It does not read or write the cache.
- `list-tasks.ts:fetchTasks`: can call `confirmUsersPrincipal`, and logs mapping failures to stderr.
- `get-task.ts:getTask` and `search-tasks.ts:searchTasks`: reach the cache and PocketBase through `listTasks`.
- `sync-status.ts:getSyncStatus`: calls `requireUsersPrincipal`, `pb.health.check()`, and `getList(1, 1)` on `tasks`.
- `sync-status.ts:getTaskStats`: calls `getFullList` on `tasks` with a limited field list. It does not use the cache.
- `sync-status.ts:getSyncStatus` and `getTaskStats`: log errors to stderr.
- `prompts.ts`: None.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
