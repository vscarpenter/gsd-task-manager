# 0005: MCP Server Integration for Claude Desktop

**Date:** 2026-04-14
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

Power users want to query and manage their tasks using natural language from Claude Desktop — e.g., "What urgent tasks are overdue?" or "Create a task to review the Q2 report." The GSD app stores data in IndexedDB (browser-only) and optionally syncs to PocketBase. A bridge is needed so Claude can access task data without requiring browser access.

## Decision

Implement a standalone MCP (Model Context Protocol) server in `packages/mcp-server/` as a separate npm package. The server runs as a Node.js 18+ process and communicates with Claude Desktop via the MCP stdio transport (JSON-RPC 2.0 over stdin/stdout). It connects to the user's PocketBase instance using `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` from environment variables.

The server exposes **20 tools** across four categories:

- **Read (7)**: `list_tasks`, `get_task`, `search_tasks`, `get_sync_status`, `list_devices`, `get_task_stats`, `get_token_status`
- **Write (5)**: `create_task`, `update_task`, `complete_task`, `delete_task`, `bulk_update_tasks`
- **Analytics (5)**: `get_productivity_metrics`, `get_quadrant_analysis`, `get_tag_analytics`, `get_upcoming_deadlines`, `get_task_insights`
- **System (3)**: `validate_config`, `get_help`, `get_cache_stats`

All write tools support a `dryRun` mode that describes the change without applying it. A TTL cache reduces redundant PocketBase API calls. Circular dependency validation runs before any dependency-adding write operation.

## Consequences

### Easier
- Claude Desktop gains structured, schema-validated access to task data without browser automation.
- `dryRun` mode makes destructive operations safe to explore conversationally.
- Standalone package means the MCP server can be versioned, tested, and distributed independently of the Next.js app.
- stdio transport requires no open ports or authentication configuration beyond the PocketBase token.
- The 20-tool taxonomy gives Claude precise, composable primitives rather than one large "do everything" tool.

### Harder
- Requires the user to have cloud sync enabled — local-only IndexedDB data is not accessible to the server process.
- Auth token must be manually provisioned and kept in the Claude Desktop config file.
- MCP is a newer protocol; Claude Desktop client updates can introduce compatibility changes.
- Two separate codebases (`packages/mcp-server/` and the main app) must stay in sync on shared concepts like quadrant IDs and task schema.

## Alternatives Considered

- **REST API wrapper around PocketBase**: PocketBase already exposes a REST API; Claude could call it directly. Rejected — the MCP tool abstraction provides intent-aligned primitives and input validation that raw REST calls lack.
- **Browser extension**: Could bridge IndexedDB directly without requiring cloud sync. Rejected — high implementation complexity, browser-specific, and requires extension store publishing.
- **Direct IndexedDB access via WASM/Node**: Not feasible — IndexedDB is a browser-only API and cannot be accessed from a Node.js process without the browser runtime.
- **WebSocket server on localhost**: Would work for local-only data but requires a running local process and firewall considerations. Rejected in favor of the simpler stdio transport.
