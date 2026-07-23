# Architecture

GSD Task Manager is a client-side Next.js PWA. IndexedDB is the local source of
truth; PocketBase cloud sync and the MCP server are optional integrations.

This page is a durable map to the maintained architecture sources. Prefer the
linked source and decision records over duplicating implementation detail here.

| Topic | Where |
| --- | --- |
| Project overview, commands, and component/data patterns | [`CLAUDE.md`](CLAUDE.md) |
| Product model and feature intent | [`PRODUCT.md`](PRODUCT.md) |
| App routes and UI composition | [`app/`](app/) and [`components/`](components/) |
| Domain types, validation, and IndexedDB schemas | [`lib/types.ts`](lib/types.ts), [`lib/schema.ts`](lib/schema.ts), and [`lib/db.ts`](lib/db.ts) |
| Task domain operations | [`lib/tasks/`](lib/tasks/) |
| PocketBase sync, realtime, and conflict handling | [`lib/sync/`](lib/sync/), [ADR 0002](docs/adr/0002-pocketbase-cloud-sync.md), and [ADR 0003](docs/adr/0003-last-write-wins-conflict-resolution.md) |
| PWA and service-worker caching | [`lib/sw-cache-logic.ts`](lib/sw-cache-logic.ts), [ADR 0004](docs/adr/0004-pwa-architecture.md), and [ADR 0012](docs/adr/0012-sw-multi-cache-strategy.md) |
| MCP server | [`packages/mcp-server/README.md`](packages/mcp-server/README.md) and [ADR 0005](docs/adr/0005-mcp-server-integration.md) |
| Self-hosting and deployment | [`docker/README.md`](docker/README.md), [`docs/ops/`](docs/ops/), and [`README.md`](README.md) |
| Testing and definition of done | [`coding-standards.md`](coding-standards.md), [`CLAUDE.md`](CLAUDE.md#testing-guidelines), and [`tests/e2e/README.md`](tests/e2e/README.md) |
| Security posture and trust boundaries | [`SECURITY.md`](SECURITY.md) and [`.blume/insights/security-trust-boundaries.md`](.blume/insights/security-trust-boundaries.md) |
| Architecture decision history | [`docs/adr/`](docs/adr/) |
