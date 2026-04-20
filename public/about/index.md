# About GSD Task Manager

GSD Task Manager is an open-source, privacy-first task manager built around
the Eisenhower Matrix. It runs entirely in the browser as a Progressive Web
App. Optional multi-device sync is available through a self-hosted PocketBase
backend.

This file is the markdown rendition of <https://gsd.vinny.dev/about>, served
when a client sends `Accept: text/markdown`.

## What it does

- Classifies every task by **urgency** and **importance** (the four Eisenhower
  quadrants).
- Runs offline by default — IndexedDB via Dexie is the source of truth.
- Ships as an installable PWA with a service worker, push notifications, and
  badge updates.
- Adds optional cloud sync (PocketBase + OAuth via Google or GitHub) for
  users who want their tasks on multiple devices.
- Exposes an MCP server (`gsd-mcp-server` on npm) so MCP-aware assistants can
  read and mutate tasks with the user's permission.

## Architecture at a glance

| Layer | Tech | Notes |
| --- | --- | --- |
| UI | Next.js 16 App Router, React 19 | Static export — no SSR, no API routes |
| Storage | IndexedDB via Dexie v13 | Local first; export to JSON for backup |
| Sync | PocketBase 0.23+ | Last-write-wins; SSE realtime; opt-in |
| Auth | PocketBase OAuth2 (Google, GitHub) | Tokens persisted in `localStorage` |
| MCP | `gsd-mcp-server` (stdio) | 20 tools across read, write, analytics |
| Hosting | S3 + CloudFront | Edge function rewrites paths and adds Link headers |

## Programmatic interfaces for agents

| Resource | URL |
| --- | --- |
| API catalog | <https://gsd.vinny.dev/.well-known/api-catalog> |
| OpenAPI 3.1 (sync backend) | <https://gsd.vinny.dev/.well-known/openapi/pocketbase.json> |
| OAuth Protected Resource | <https://gsd.vinny.dev/.well-known/oauth-protected-resource> |
| MCP Server Card | <https://gsd.vinny.dev/.well-known/mcp/server-card.json> |
| Agent Skills index | <https://gsd.vinny.dev/.well-known/agent-skills/index.json> |
| WebMCP | Loaded at runtime via `navigator.modelContext.provideContext()` |

## Project links

- **Source:** <https://github.com/vscarpenter/gsd-taskmanager>
- **MCP package:** <https://www.npmjs.com/package/gsd-mcp-server>
- **License:** MIT
- **Maintainer:** Vinny Carpenter
