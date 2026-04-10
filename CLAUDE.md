# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GSD Task Manager is a privacy-first Eisenhower matrix task manager built with Next.js 16 App Router. All data is stored locally in IndexedDB via Dexie, with JSON export/import for backups. The app is a PWA that works completely offline.

**Key Features:**
- **Optional Cloud Sync** — Multi-device sync via self-hosted PocketBase at `https://api.vinny.io` (OAuth with Google/GitHub)
- **MCP Server Integration** — AI-powered task management through Claude Desktop with natural language queries
- **Realtime Sync** — PocketBase SSE (Server-Sent Events) for instant cross-device updates
- **Smart Views** — Pin up to 5 smart views to header (keyboard shortcuts 1-9, 0 to clear)
- **Command Palette** — Global ⌘K/Ctrl+K shortcut for quick actions and navigation
- **iOS-style Settings** — Redesigned settings with grouped layout and modular sections

## Core Commands

### Development
- `bun install` - Install dependencies
- `bun dev` - Start development server at http://localhost:3000
- `bun typecheck` - Run TypeScript type checking

### Testing & Quality
- `bun run test` - Run Vitest tests in CI mode (`bun test` invokes bun's built-in runner, not vitest)
- `bun run test:watch` - Run Vitest in watch mode
- `bun run test -- --coverage` - Generate coverage report (target: ≥80%)
- `bun lint` - Run ESLint

### Build & Deployment
- `bun run build` - Build production bundle
- `bun run export` - Generate static export for S3/CloudFront
- `./scripts/deploy-cloudfront-function.sh` - Deploy CloudFront Function for SPA routing

**CloudFront Edge Routing**: Required because S3 doesn't auto-serve `index.html` for directory paths. Run the deploy script after adding new App Router routes.

## Architecture

### Data Layer
- **IndexedDB via Dexie** (`lib/db.ts`): `tasks`, `smartViews`, `notificationSettings`, `appPreferences` tables (v13)
- **CRUD Operations** (`lib/tasks.ts`): Task mutations, subtask/dependency management
- **Bulk Operations** (`lib/bulk-operations.ts`): Batch operations for multi-select
- **Live Queries** (`lib/use-tasks.ts`): `useTasks()` hook with live updates
- **Schema Validation** (`lib/schema.ts`): Zod schemas for all data types
- **Analytics** (`lib/analytics/`): Modular productivity metrics
- **Notifications** (`lib/notifications/`): Modular notification system
- **Dependencies** (`lib/dependencies.ts`): Circular dependency detection, blocking/blocked queries
- **Structured Logging** (`lib/logger.ts`): Environment-aware logger with contexts and secret sanitization

### Quadrant System
Tasks are classified by `urgent` and `important` boolean flags:
- `urgent-important` - Do first (Q1)
- `not-urgent-important` - Schedule (Q2)
- `urgent-not-important` - Delegate (Q3)
- `not-urgent-not-important` - Eliminate (Q4)

Logic in `lib/quadrants.ts` with `resolveQuadrantId()` and `quadrantOrder`.

### Component Structure
- **App Router** (`app/`): Matrix view, dashboard, archive, sync-history, install pages
- **UI Components** (`components/ui/`): shadcn-style primitives
- **Domain Components**:
  - `matrix-board.tsx`, `matrix-column.tsx`, `task-card.tsx` - Matrix view
  - `task-form/` - Modular task form with validation
  - `components/sync/` - Sync button, auth dialog, OAuth buttons
  - `components/settings/` - iOS-style settings with modular sections
  - `components/dashboard/` - Analytics charts and metrics
  - `components/user-guide/` - Modular user guide sections
  - `bulk-actions-bar.tsx`, `bulk-tag-dialog.tsx` - Batch operations
  - `command-palette.tsx` - Global command palette (⌘K/Ctrl+K)
  - `smart-view-pills.tsx`, `smart-view-selector.tsx` - Smart view UI

### Key Patterns
- **Client-side only**: All components use `"use client"` - no server rendering
- **Live reactivity**: `useTasks()` returns live data via `useLiveQuery`
- **Validation**: All task operations validate with Zod schemas before persisting
- **Keyboard shortcuts**: n=new, /=search, ?=help, ⌘K=command palette, 1-9=smart views
- **Recurring tasks**: Completed recurring tasks auto-create next instance
- **Enhanced search**: Includes tags and subtasks

### PWA Configuration
- `public/manifest.json` - App metadata
- `public/sw.js` - Service worker for offline caching
- `components/pwa-register.tsx` - SW registration

### Cloud Sync Architecture
- **Backend**: Self-hosted PocketBase at `https://api.vinny.io` (AWS EC2)
- **Authentication**: PocketBase built-in OAuth2 with Google and GitHub providers (both fully implemented client-side; GitHub requires server-side provider setup in PocketBase admin)
- **Sync Protocol**: Last-write-wins (LWW) with `client_updated_at` timestamps
- **Realtime**: PocketBase SSE subscriptions for instant cross-device updates
- **Storage**: Tasks stored as plaintext in PocketBase (user owns the server)

**Key Locations**:
- `lib/sync/pocketbase-client.ts` - PocketBase SDK singleton wrapper
- `lib/sync/pb-sync-engine.ts` - Push/pull sync engine with LWW resolution
- `lib/sync/pb-realtime.ts` - SSE subscription manager with echo filtering
- `lib/sync/pb-auth.ts` - OAuth login/logout via PocketBase SDK
- `lib/sync/task-mapper.ts` - camelCase ↔ snake_case field mapping

**PocketBase Collections**: `tasks` (with API rules: `@request.auth.id != "" && owner = @request.auth.id`), `devices`

### MCP Server Architecture
- **Purpose**: Enable Claude Desktop to access/analyze tasks via natural language
- **Location**: `packages/mcp-server/` - Standalone npm package
- **Runtime**: Node.js 18+ with TypeScript, stdio transport (JSON-RPC 2.0)

**20 MCP Tools**:
- *Read (7)*: list_tasks, get_task, search_tasks, get_sync_status, list_devices, get_task_stats, get_token_status
- *Write (5)*: create_task, update_task, complete_task, delete_task, bulk_update_tasks (all support dryRun)
- *Analytics (5)*: get_productivity_metrics, get_quadrant_analysis, get_tag_analytics, get_upcoming_deadlines, get_task_insights
- *System (3)*: validate_config, get_help, get_cache_stats

**Key Features**: Retry logic with exponential backoff, TTL cache, dry-run mode, circular dependency validation

**Configuration**: Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json` with `GSD_POCKETBASE_URL`, `GSD_AUTH_TOKEN`

## Testing Guidelines
- UI tests in `tests/ui/`, data logic in `tests/data/`
- Use `@testing-library/react` and `@testing-library/jest-dom`
- Coverage thresholds: 80% statements, 80% lines, 80% functions, 75% branches

## Code Style
- **TypeScript strict mode** with Next.js typed routes
- **Naming**: PascalCase for components/types, camelCase for functions, kebab-case for files
- **Tailwind**: Group classes by layout → spacing → color
- **Imports**: Use `@/` alias for all internal imports

## Development Notes

### Schema & Database
- Task schema changes require updating `lib/schema.ts`, export/import logic, and test fixtures
- Database migrations in `lib/db.ts` - current version is 13
- New task fields (recurrence, tags, subtasks, dependencies) are optional with sensible defaults
- **Import schema** uses `.strip()` (not `.strict()`) to accept legacy exports with extra fields (e.g., `vectorClock` from the old Cloudflare sync system)
- Export schema still uses `.strict()` to ensure clean outgoing data

### Dependencies System
- Always validate circular dependencies before adding relationships
- Clean up references when deleting tasks (`removeDependencyReferences()`)
- Consider blocking/blocked relationships for dependency-aware features

### Navigation & UI
- Use `useViewTransition()` hook for client-side navigation with View Transitions API
- Button component variants: "primary" | "subtle" | "ghost" (no size prop)
- Smart view shortcuts (1-9, 0) use `useSmartViewShortcuts` with typing detection

### Cloud Sync
- **PocketBase Admin**: `https://api.vinny.io/_/` for collection management
- **PocketBase Version**: v0.23+ (uses `_superusers` collection for admin auth, not legacy `/api/admins/`)
- PocketBase SDK (v0.26.8) auto-stores auth tokens in localStorage and auto-refreshes
- LWW conflict resolution uses `client_updated_at` field — remote wins if newer
- SSE subscriptions auto-reconnect; periodic sync runs as safety net
- Echo filtering skips own-device changes via `device_id` comparison
- **Rate Limiting**: Push operations are throttled (100ms between requests) to avoid PocketBase 429 errors
- **Batch Lookups**: `fetchRemoteTaskIndex()` pre-fetches all remote task IDs in one request instead of N individual lookups
- **PocketBase v0.23+ Gotchas**:
  - System fields (`created`, `updated`) **cannot** be used in `sort` or `filter` — use custom fields like `client_updated_at` instead
  - Custom indexes cannot reference system columns (`updated`, `created`)
  - The `_pb_users_auth_` placeholder doesn't work as a `collectionId` for relation fields — use `text` type for owner FK or look up the real collection ID
  - Admin auth endpoint is `/api/collections/_superusers/auth-with-password` (not `/api/admins/auth-with-password`)
- **Collection Setup**: Run `scripts/setup-pocketbase-collections.sh` to create the `tasks` collection with correct schema, indexes, and API rules

### MCP Server
- Build with `npm run build` in `packages/mcp-server/`
- Add tools: schemas in `tools/schemas/`, handlers in `tools/handlers/`
- Uses PocketBase JS SDK to communicate with `GSD_POCKETBASE_URL`
- Use `fetchWithRetry()` for resilient API calls

### OAuth Authentication
- PocketBase SDK handles OAuth popup flow automatically (`authWithOAuth2`)
- Supports Google and GitHub providers (both implemented client-side; Google configured on server, GitHub needs PocketBase admin setup at `https://api.vinny.io/_/` → Settings → Auth providers)
- Auth state persists in PocketBase's built-in `authStore` (localStorage)
- **Local dev**: Set `NEXT_PUBLIC_POCKETBASE_URL=https://api.vinny.io` in `.env.local` to test OAuth against production PocketBase (local PocketBase at 127.0.0.1:8090 requires separate OAuth provider setup)

### Test-Driven Development (TDD)

**TDD is the default workflow for this project.** For any change that adds or modifies behavior:

1. **Red** — Write a failing test first that describes the expected behavior
2. **Green** — Write the minimum implementation to make the test pass
3. **Refactor** — Clean up while keeping tests green

**When to apply TDD:**
- New components or functions → write render/unit tests first
- Bug fixes → write a test that reproduces the bug first
- Refactors that change behavior → write tests for the new behavior before changing code

**When TDD is optional:**
- Pure CSS/styling changes with no behavioral difference
- Renaming/moving files with no logic changes
- Documentation-only changes

**Verification:** Run `bun run test -- --coverage` after implementation. Coverage for changed files must be ≥80% across statements, lines, and functions.

### Pre-commit
- Run `bun run test`, `bun typecheck`, and `bun lint` before committing
- Static export mode means no API routes or SSR

## Modular Architecture

The codebase follows coding standards (<350 lines per file, <30 lines per function). Key modular areas:

- **lib/analytics/**: metrics, streaks, tags, trends
- **lib/notifications/**: display, permissions, settings, badge
- **lib/sync/**: pocketbase-client, pb-sync-engine, pb-realtime, pb-auth, task-mapper, sync-coordinator, health-monitor, queue, config
- **components/task-form/**: index, use-task-form hook, validation
- **components/settings/**: appearance, notification, sync, archive, data-management sections
- **packages/mcp-server/src/tools/**: handlers/, schemas/, individual tool files
- **packages/mcp-server/src/write-ops/**: task-operations, bulk-operations with dry-run support

All modules maintain backward compatibility through re-export layers.

## Git Workflow 

For git operations: when asked to commit and push, write a descriptive conventional commit message, bump the version if appropriate, and create a PR unless told otherwise. Standard workflow: commit → push → create PR.

Always leverage @coding-standards.md for coding standards and guidelines.
