---
name: mcp-server
description: MCP server package conventions and build rules. Loads when editing packages/mcp-server/.
paths:
  - packages/mcp-server/**
---

## MCP Server Package

- **Location**: `packages/mcp-server/` — standalone npm package in the Bun workspace.
- **Runtime**: Node.js 22+ with TypeScript, stdio transport (JSON-RPC 2.0), on the TypeScript SDK v2 (`@modelcontextprotocol/server`).
- **Protocol**: `serveStdio` in `src/server/startup.ts` serves MCP 2026-07-28 and, to a client that opens with a 2025 `initialize`, 2025-11-25, from one factory (`createGsdServer` in `src/server/setup.ts`). Never connect a server straight to `StdioServerTransport`: it speaks only the 2025 protocol. See ADR 0024.
- **Build**: `npm run build` in `packages/mcp-server/` (uses tsc).

## Tool Layout

- **Schemas**: `src/tools/schemas/` — MCP `Tool` definitions (JSON Schema) advertised to clients; Zod input validation lives in `src/tools/handlers/input-schemas.ts`
- **Handlers**: `src/tools/handlers/` — implementation
- **Tool files**: `src/tools/*.ts` — the read functions (list, get, search, sync status) and the prompt templates; the dispatcher in `src/tools/handlers/` routes each tool call
- **Write ops**: `src/write-ops/` — task-operations + bulk-operations with dryRun support

## 20 Tools Currently Exposed

- *Read (7)*: list_tasks, get_task, search_tasks, get_sync_status, get_task_stats, get_token_status, get_top_three
- *Write (5)*: create_task, update_task, complete_task, delete_task, bulk_update_tasks (all support dryRun)
- *Analytics (5)*: get_productivity_metrics, get_quadrant_analysis, get_tag_analytics, get_upcoming_deadlines, get_task_insights
- *System (3)*: validate_config, get_help, get_cache_stats

## Conventions

- PocketBase calls go through the SDK client in `src/pocketbase-client.ts`.
- PocketBase reads a refused token as a guest: an empty `tasks` listing and a 404 for every record. Call `confirmUsersPrincipal` before an empty listing or a 404 counts, so a revoked token gets the sign-in error instead of `[]` or "Task not found".
- Validate circular dependencies before adding task relationships.
- TTL cache for read tools; dry-run mode for all writes.
- Test both protocol revisions through `connectClient()` in `src/__tests__/helpers/protocol-clients.ts`. `src/__tests__/server/wire-contract.test.ts` pins the v1.5.0 tool and prompt lists, less the `title` and `annotations` fields added since, so a deliberate change to them updates its fixture in the same PR. `src/__tests__/server/metadata.test.ts` checks those fields, the server instructions, and the cache hints.
- Field changes that touch the synced schema follow the `pb-collection` skill. It sets `disable-model-invocation: true`, so ask the user to run `/pb-collection`.

## Configuration

Claude Desktop config: `~/Library/Application Support/Claude/claude_desktop_config.json` with `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` env vars.
