# GSD Task Manager — OpenWiki Quickstart

**GSD Task Manager** ("Get Stuff Done") is a privacy-first task manager built around the
**Eisenhower Matrix** (urgent × important → four quadrants). It runs entirely in the
browser as a static PWA, storing all data locally in IndexedDB. Cloud sync, realtime
updates, and an MCP server are **optional** layers that only activate when a self-hosted
PocketBase backend is reachable.

- Live app: `gsd.vinny.dev`
- Package: `gsd-taskmanager` (see `/package.json`), version **10.1.0**
- License: MIT (`/LICENSE`)

This quickstart is the entry point to the OpenWiki. Start here, then follow links into the
sections below.

---

## What this project is

- A **100% client-side** Next.js 16 / React 19 app. Every component is `"use client"`;
  there is no SSR and no API routes. The app is shipped as a **static export**
  (`output: "export"` in `/next.config.ts`).
- Data lives in the browser's **IndexedDB** via **Dexie** (`/lib/db.ts`). A fresh browser
  profile starts empty — there is no backend to seed for basic task CRUD.
- The four Eisenhower quadrants (Do First / Schedule / Delegate / Eliminate) are the core
  organizing model. See [Domain model](architecture/domain-model.md).
- Optional **PocketBase** sync gives multi-device sync, realtime SSE updates, and OAuth.
  See [Sync & offline](workflows/sync-and-offline.md).
- An optional **MCP server** (`/packages/mcp-server`) exposes task management to Claude
  Desktop and other MCP clients. See [MCP server](workflows/mcp-server.md).

For product framing and feature rationale, read the root docs: `/README.md`, `/PRODUCT.md`,
`/DESIGN.md`, and the ADRs in `/docs/adr/`.

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, static export), React 19, React Compiler |
| Language | TypeScript |
| Local storage | Dexie 4 over IndexedDB (`/lib/db.ts`) |
| Validation | Zod 4 (`/lib/schema.ts`) |
| State/data hooks | `dexie-react-hooks`, `@tanstack/react-query` |
| UI | Radix UI primitives, Tailwind CSS 4, `lucide-react`, `recharts`, `@dnd-kit` |
| Optional backend | PocketBase (self-hosted), OAuth (Google/GitHub) |
| Observability | Sentry (opt-in), SonarCloud |
| Package manager | **Bun** (`bun.lock`, workspaces in `packages/*`) |
| Testing | Vitest + React Testing Library, Playwright (e2e) |

---

## Repository map

| Path | What lives there |
| --- | --- |
| `/app/` | Next.js App Router routes (route groups: `(matrix)`, `(dashboard)`, `(archive)`, `(sync)`, `(pwa)`, plus `settings/`, `about/`). `layout.tsx` is the root shell. |
| `/components/` | React components. Notable: `task-card/`, `matrix-simplified/`, `dashboard/`, `sync/`, `settings/`, `onboarding/`, `command-palette/`, `webmcp-register.tsx`. |
| `/lib/` | Core logic: data layer, domain rules, sync engine, hooks, analytics, notifications. This is where most non-UI behavior lives. |
| `/lib/db.ts` | Dexie database definition + all IndexedDB schema versions/migrations. |
| `/lib/types.ts`, `/lib/schema.ts` | Domain types and Zod validation. |
| `/lib/sync/` | PocketBase cloud sync engine (push/pull/realtime/health/retry/queue). |
| `/lib/tasks/` | Task CRUD, subtasks, dependencies, recurrence, time tracking. |
| `/packages/mcp-server/` | Standalone `gsd-mcp-server` npm package (MCP integration). |
| `/docker/` | Self-hosting stack (Caddy + PocketBase + static PWA in one container). |
| `/scripts/` | Build, deploy (S3/CloudFront), PocketBase ops, smoke tests, and the agent-pipeline scripts/launchd plists. |
| `/.github/workflows/` | CI, dev/prod deploy, CloudFront infra, Docker/MCP publish, and pipeline workflows (risk labeling, release-ready, telemetry). |
| `/.claude/commands/` | Executable summaries for the autonomous builder/triage routines (`build-next.md`, `triage-prs.md`). |
| `/tests/` | Vitest (`ui/`, `data/`, `sync/`, `pb/`) + Playwright (`e2e/`). |
| `/docs/` | ADRs (`docs/adr/`), agent operating specs (`docs/agents/`), pipeline runbooks (`docs/ops/`), HTML explainers, UML diagrams. |
| Root docs | `README.md`, `ARCHITECTURE.md`, `PRODUCT.md`, `DESIGN.md`, `SECURITY.md`, `coding-standards.md`, `CLAUDE.md`, `AGENTS.md`. |

---

## Getting started (local dev)

This project uses **Bun**. Core commands (see `/package.json` and `/CLAUDE.md`):

```bash
bun install            # install deps (CI uses --frozen-lockfile)
bun dev                # dev server at http://localhost:3000
bun run test           # Vitest (NOT `bun test` — that runs Bun's own runner)
bun typecheck          # tsc --noEmit
bun lint               # eslint .
bun run build          # static export into out/
bun run test:e2e       # Playwright e2e
```

On first load the root URL redirects to `/about` (onboarding); enter the matrix via the
onboarding "Open App" CTA. No backend is required for basic task CRUD. See
[Build, deploy & ops](operations/build-deploy-and-ops.md) and
[Testing guide](testing/testing-guide.md) for details.

---

## Where to go next

- **[Architecture overview](architecture/overview.md)** — how the static PWA, local data
  layer, optional PocketBase backend, and MCP server fit together; data flow and key
  directories.
- **[Domain model](architecture/domain-model.md)** — TaskRecord shape, the Eisenhower
  quadrant system, dependencies + cycle detection, recurrence, subtasks, tags, time
  tracking, archive, smart views, and the Dexie schema/migrations.
- **[Sync & offline](workflows/sync-and-offline.md)** — the PocketBase sync engine
  (push/pull, last-write-wins, realtime, health, retry, offline queue) and the PWA service
  worker cache strategy.
- **[MCP server](workflows/mcp-server.md)** — the `gsd-mcp-server` package: tool catalog,
  dry-run writes, caching, auth.
- **[Build, deploy & ops](operations/build-deploy-and-ops.md)** — dev/build/test commands,
  Docker self-hosting, AWS S3/CloudFront deploy, CI workflows, security posture.
- **[Agent pipeline](operations/agent-pipeline.md)** — the autonomous AI-agent delivery
  pipeline (Contract → Builder + Gate 1 → Review + Gate 2 → Night Shift → Telemetry), driven
  by GitHub labels as durable state.
- **[Testing guide](testing/testing-guide.md)** — Vitest/RTL unit tests, Playwright e2e,
  TDD workflow, coverage thresholds, and gotchas.
- **[Glossary](reference/glossary.md)** — shared vocabulary (BFS, LWW, quadrants, smart
  views, MCP, …).
- **[Tech debt & roadmap](reference/tech-debt-and-roadmap.md)** — known debt, planned
  migrations, and potential roadmap items (human-maintained).

Deeper background lives in the **Architecture Decision Records** at `/docs/adr/0001`–`0012`.

---

## Important gotchas (read before changing code)

These are grounded in current source; some root docs lag behind.

- **Version drift in prose docs.** The `/README.md` header lags `/package.json`; treat
  `package.json` + `CLAUDE.md` + the ADRs as the source of truth for current state. (The old
  long-form `/ARCHITECTURE.md` has been replaced by a pointer into this wiki.)
- **`bun run test`, not `bun test`.** `bun test` invokes Bun's built-in runner; only
  `bun run test` delegates to Vitest.
- **v9 single-matrix refactor** (ADR-0011) removed several older UI surfaces. The
  `components/command-palette/` code exists but is not wired into the current v9 shell —
  don't assume it's live without checking. Similarly, the smart-view pin shortcuts
  described in ADR-0009 were removed; `AppPreferences.smartViewsEnabled` defaults to
  `false` (schema v11).
- **No SSR / no API routes.** Everything is client-side and statically exported. Security
  headers are set at CloudFront (the CDN), not in Next config — see
  [Build, deploy & ops](operations/build-deploy-and-ops.md).
- **PocketBase is optional.** Sync, realtime, OAuth, and the MCP package only matter when a
  PocketBase instance is reachable. Core CRUD works fully offline/local-only.
- **Two `restoreTask` functions** exist with different meaning: undo-delete
  (`/lib/tasks/crud/restore.ts`) vs. un-archive (`/lib/archive.ts`). Don't confuse them.
