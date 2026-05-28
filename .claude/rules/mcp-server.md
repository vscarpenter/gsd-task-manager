---
name: mcp-server
description: MCP server package conventions and build rules. Loads when editing packages/mcp-server/.
paths:
  - packages/mcp-server/**
---

## MCP Server Package

- **Location**: `packages/mcp-server/` — standalone npm package, npm workspace.
- **Runtime**: Node.js 18+ with TypeScript, stdio transport (JSON-RPC 2.0).
- **Build**: `npm run build` in `packages/mcp-server/` (uses tsc).

## Tool Layout

- **Schemas**: `src/tools/schemas/` — Zod schemas for tool inputs
- **Handlers**: `src/tools/handlers/` — implementation
- **Tool files**: `src/tools/<name>.ts` — wires schema + handler
- **Write ops**: `src/write-ops/` — task-operations + bulk-operations with dryRun support

## 20 Tools Currently Exposed

- *Read (7)*: list_tasks, get_task, search_tasks, get_sync_status, list_devices, get_task_stats, get_token_status
- *Write (5)*: create_task, update_task, complete_task, delete_task, bulk_update_tasks (all support dryRun)
- *Analytics (5)*: get_productivity_metrics, get_quadrant_analysis, get_tag_analytics, get_upcoming_deadlines, get_task_insights
- *System (3)*: validate_config, get_help, get_cache_stats

## Conventions

- Use `fetchWithRetry()` for resilient PocketBase API calls.
- Validate circular dependencies before adding task relationships.
- TTL cache for read tools; dry-run mode for all writes.
- Field changes that touch the synced schema must invoke the `pb-collection` skill (auto-fires on `lib/sync/**`).

## Configuration

Claude Desktop config: `~/Library/Application Support/Claude/claude_desktop_config.json` with `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` env vars.
