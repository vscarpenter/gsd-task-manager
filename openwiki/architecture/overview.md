# Architecture Overview

GSD Task Manager is a **local-first, static PWA**. The default architecture has no server:
the app is a static bundle served from a CDN, and all data is stored in the browser's
IndexedDB. Optional layers (PocketBase sync, MCP server) attach on top without changing the
local-first core.

See also: the [Glossary](../reference/glossary.md),
[Tech debt & roadmap](../reference/tech-debt-and-roadmap.md), and ADRs
`/docs/adr/0001`–`0012`. (The root `/ARCHITECTURE.md` is now just a pointer into this wiki.)

---

## The three layers

1. **Core app (always present, offline-capable).**
   Next.js 16 static export + React 19. Every component is `"use client"`. UI reads/writes
   IndexedDB through Dexie. This layer is fully functional with no network.

2. **Optional cloud sync (PocketBase).**
   When a PocketBase URL is reachable, the sync engine in `/lib/sync/` pushes/pulls task
   changes, subscribes to realtime updates, and supports OAuth login. Conflict resolution
   is last-write-wins. See [Sync & offline](../workflows/sync-and-offline.md).

3. **Optional MCP server (`/packages/mcp-server`).**
   A standalone npm package that talks to the same PocketBase backend and exposes task
   tools to Claude Desktop / MCP clients. See [MCP server](../workflows/mcp-server.md).

Relevant ADRs: `0001-client-side-only-indexeddb.md`, `0002-pocketbase-cloud-sync.md`,
`0004-pwa-architecture.md`, `0005-mcp-server-integration.md`.

---

## Rendering & routing

- **Static export.** `/next.config.ts` sets `output: "export"`, `trailingSlash: true`,
  `images.unoptimized: true`, `typedRoutes: true`, `reactCompiler: true`. There is no SSR
  and no server runtime in production; the output is plain files in `out/`.
- **App Router route groups** under `/app/`:
  - `(matrix)/` — the main Eisenhower matrix view (primary UI, see
    `/components/matrix-simplified/`).
  - `(dashboard)/` — analytics/insights (`/components/dashboard/`).
  - `(archive)/` — archived tasks.
  - `(sync)/` — sync status/settings UI (`/components/sync/`).
  - `(pwa)/` — PWA-related routes.
  - `settings/`, `about/` (onboarding), plus `not-found.tsx` and `global-error.tsx`.
- **First-load redirect.** The root URL redirects to `/about` (onboarding) on first visit;
  see `/components/first-time-redirect.tsx`. Enter the matrix from the onboarding CTA.
- **Providers.** `/app/layout.tsx` wires the root shell; `/components/theme-provider.tsx`
  (next-themes), `/components/query-provider.tsx` (React Query), and PWA/error listeners
  are mounted here.

---

## Data flow

The canonical data path is **UI → domain functions in `/lib` → Dexie → IndexedDB**, with
Dexie live-queries pushing reactive updates back to the UI.

```
React components (use client)
   │  call
   ▼
lib/tasks/*  +  lib/*.ts (domain logic, validation via lib/schema.ts)
   │  read/write
   ▼
lib/db.ts (Dexie)  ──►  IndexedDB (GsdTaskManager)
   ▲                         │
   │  useLiveQuery           │  (if sync enabled) enqueue op
   └── dexie-react-hooks     ▼
                        lib/sync/*  ──►  PocketBase (optional)
```

- Reads use `dexie-react-hooks` (`useLiveQuery`) so the UI updates automatically when
  IndexedDB changes. See hooks like `/lib/use-tasks.ts`, `/lib/use-all-tags.ts`.
- Writes go through domain functions (`/lib/tasks/*`) that validate with Zod
  (`/lib/schema.ts`) and, when sync is enabled, enqueue a sync operation into the
  `syncQueue` table.
- `@tanstack/react-query` is used where request/caching semantics help (notably around
  sync and remote data).

For the full data shape and rules, see [Domain model](domain-model.md).

---

## Key directories to know

| Directory | Role | Start file |
| --- | --- | --- |
| `/lib/` | All non-UI logic | `db.ts`, `types.ts`, `schema.ts` |
| `/lib/tasks/` | Task CRUD + operations | `crud/create.ts`, `crud/toggle.ts` |
| `/lib/sync/` | PocketBase sync engine | `pb-sync-engine.ts` |
| `/lib/analytics/` | Dashboard metrics | (analytics modules) |
| `/lib/notifications/` | Due-date reminders | `notification-checker.ts` |
| `/lib/smart-views/` | Built-in smart views | `built-in.ts` |
| `/app/` | Routes / shell | `layout.tsx` |
| `/components/` | UI | `task-card/`, `matrix-simplified/` |

---

## Where to start when changing this area

- **Adding/altering a task field:** update `/lib/types.ts`, `/lib/schema.ts`, and add a new
  Dexie version in `/lib/db.ts` with a migration. Confirm sync mapping in `/lib/sync/`
  (PocketBase field mapping) if the field must sync. See [Domain model](domain-model.md).
- **New route/view:** add under `/app/<group>/` and matching components in `/components/`.
  Keep components `"use client"`; avoid any server-only APIs (they break static export).
- **Anything network-related:** it must remain optional. The app must still work with no
  PocketBase backend reachable.

**Watch out for:** static-export constraints (no SSR, no API routes, no runtime image
optimization), and the v9 refactor (ADR-0011) having removed some older UI surfaces that
older docs still describe.
