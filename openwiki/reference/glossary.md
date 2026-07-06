# Glossary

Shared vocabulary used across GSD Task Manager's code, docs, and ADRs. Terms link out to
the pages that explain them in depth.

| Term | Definition |
| --- | --- |
| **BFS** | Breadth-First Search — the iterative algorithm used for circular-dependency detection in task relationships (ADR-0008). See [Domain model](../architecture/domain-model.md). |
| **Dexie** | Minimalistic IndexedDB wrapper providing reactive live queries (`dexie-react-hooks`) and versioned schema migrations (`/lib/db.ts`). |
| **Eisenhower Matrix** | Prioritization framework classifying tasks by *urgent* × *important* into four quadrants (Do First / Schedule / Delegate / Eliminate). The app's core organizing model. |
| **GSD** | "Get Stuff Done" — the project's namesake. |
| **IndexedDB** | Browser-native database for structured client-side storage; the app's only required persistence layer. |
| **LWW** | Last-Write-Wins — the sync conflict-resolution strategy where the record with the most recent `client_updated_at` timestamp wins. See [Sync & offline](../workflows/sync-and-offline.md). |
| **MCP** | Model Context Protocol — the protocol connecting AI clients (e.g. Claude Desktop) to external tools. Exposed by `/packages/mcp-server`. See [MCP server](../workflows/mcp-server.md). |
| **PocketBase** | Open-source Go backend (REST API, realtime SSE, OAuth, SQLite) used for **optional** self-hosted cloud sync at `https://api.vinny.io`. |
| **PWA** | Progressive Web App — installable, offline-capable web app backed by a service worker (`/public/sw.js`). |
| **Q1–Q4** | Quadrant 1 through 4 of the Eisenhower matrix: Q1 Do First, Q2 Schedule, Q3 Delegate, Q4 Eliminate. |
| **SSE** | Server-Sent Events — HTTP-based server→client push, used by PocketBase for realtime cross-device sync. |
| **Smart View** | A saved `FilterCriteria` set (quadrants, status, tags, due-date, recurrence, search). The `smartViews` table is retained for data continuity, but the v9 single-matrix shell has **no** pinning/keyboard-shortcut UI — `AppPreferences.smartViewsEnabled` defaults to `false` (ADR-0011). |
| **stdio transport** | The MCP transport where the server exchanges JSON-RPC messages over standard input/output. Any stray stdout write corrupts the stream. |
| **TaskRecord** | The primary task entity (`/lib/types.ts`); `quadrant` is derived from the `urgent`/`important` booleans. See [Domain model](../architecture/domain-model.md). |
| **View Transitions API** | Browser API for animated DOM-state transitions during client-side navigation (`useViewTransition`). |
