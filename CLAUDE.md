# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GSD Task Manager is a privacy-first Eisenhower matrix task manager built with Next.js 16 App Router. All data is stored locally in IndexedDB via Dexie, with JSON export/import for backups. The app is a PWA that works completely offline.

**Key Features:**
- **Optional Cloud Sync** — End-to-end encrypted multi-device sync via Supabase (Auth + Postgres + Realtime)
- **MCP Server Integration** — AI-powered task management through Claude Desktop with natural language queries
- **Zero-Knowledge Architecture** — Server stores only encrypted blobs; decryption happens locally
- **Realtime Sync** — Instant cross-device updates via Supabase Realtime (WebSocket)
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
- **IndexedDB via Dexie** (`lib/db.ts`): `tasks`, `smartViews`, `notificationSettings`, `appPreferences` tables (v11)
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
- **Backend**: Supabase (Postgres 17 + Auth + Realtime + PostgREST)
- **Authentication**: Supabase Auth with Google and Apple OAuth providers
- **Encryption**: AES-256-GCM with PBKDF2 key derivation (600k iterations)
- **Sync Protocol**: Last-write-wins (LWW) based on server `updated_at` timestamps
- **Realtime**: Supabase Realtime (WebSocket) for instant cross-device sync
- **Zero-Knowledge**: Server stores only encrypted blobs; RLS policies enforce user isolation

**Key Locations**:
- `lib/supabase.ts` - Supabase client singleton
- `lib/sync/supabase-sync-client.ts` - Sync CRUD via Supabase SDK
- `lib/sync/realtime-listener.ts` - Realtime subscription manager
- `lib/sync/engine/` - Frontend sync engine (push, pull, conflict resolution)
- `lib/sync/crypto.ts` - Client-side encryption/decryption
- `components/sync/supabase-auth-dialog.tsx` - Auth UI with Supabase Auth

**Database Tables**: `profiles`, `encrypted_tasks`, `devices`, `sync_metadata`, `conflict_log`

**Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### MCP Server Architecture
- **Purpose**: Enable Claude Desktop to access/analyze tasks via natural language
- **Location**: `packages/mcp-server/` - Standalone npm package
- **Runtime**: Node.js 18+ with TypeScript, stdio transport (JSON-RPC 2.0)

**19 MCP Tools**:
- *Read (6)*: list_tasks, get_task, search_tasks, get_sync_status, list_devices, get_task_stats
- *Write (5)*: create_task, update_task, complete_task, delete_task, bulk_update_tasks (all support dryRun)
- *Analytics (5)*: get_productivity_metrics, get_quadrant_analysis, get_tag_analytics, get_upcoming_deadlines, get_task_insights
- *System (3)*: validate_config, get_help, get_cache_stats

**Key Features**: TTL cache, dry-run mode, circular dependency validation, direct Supabase queries via service role key

**Configuration**: Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json` with `GSD_SUPABASE_URL`, `GSD_SUPABASE_SERVICE_KEY`, `GSD_USER_EMAIL`, `GSD_ENCRYPTION_PASSPHRASE`

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
- Database migrations in `lib/db.ts` - current version is 11
- New task fields (recurrence, tags, subtasks, dependencies) are optional with sensible defaults

### Dependencies System
- Always validate circular dependencies before adding relationships
- Clean up references when deleting tasks (`removeDependencyReferences()`)
- Consider blocking/blocked relationships for dependency-aware features

### Navigation & UI
- Use `useViewTransition()` hook for client-side navigation with View Transitions API
- Button component variants: "primary" | "subtle" | "ghost" (no size prop)
- Smart view shortcuts (1-9, 0) use `useSmartViewShortcuts` with typing detection

### Cloud Sync
- **Auth**: Supabase Auth handles OAuth (Google/Apple) and session management automatically
- **Realtime**: `lib/sync/realtime-listener.ts` subscribes to `encrypted_tasks` changes via WebSocket
- **Conflict Resolution**: Last-write-wins (LWW) based on server `updated_at` timestamps
- Never log encryption salts or passphrases
- Supabase SDK auto-refreshes auth tokens; no manual token management needed

### MCP Server
- Build with `npm run build` in `packages/mcp-server/`
- Add tools: schemas in `tools/schemas/`, handlers in `tools/handlers/`
- Uses `@supabase/supabase-js` with service role key to query Postgres directly
- Use `CryptoManager` singleton for encryption/decryption

### Pre-commit
- Run `bun run test`, `bun typecheck`, and `bun lint` before committing
- Static export mode means no API routes or SSR

## Modular Architecture

The codebase follows coding standards (<350 lines per file, <30 lines per function). Key modular areas:

- **lib/analytics/**: metrics, streaks, tags, trends
- **lib/notifications/**: display, permissions, settings, badge
- **lib/sync/engine/**: sync engine, push-handler, pull-handler, conflict-resolver
- **lib/sync/**: supabase-sync-client, realtime-listener, crypto, queue
- **components/task-form/**: index, use-task-form hook, validation
- **components/settings/**: appearance, notification, sync, archive, data-management sections
- **components/sync/**: supabase-auth-dialog, supabase-oauth-buttons, sync-button, encryption-passphrase-dialog
- **packages/mcp-server/src/tools/**: handlers/, schemas/, individual tool files
- **packages/mcp-server/src/write-ops/**: task-operations, bulk-operations with dry-run support

All modules maintain backward compatibility through re-export layers.

## Git Workflow 

For git operations: when asked to commit and push, write a descriptive conventional commit message, bump the version if appropriate, and create a PR unless told otherwise. Standard workflow: commit → push → create PR.

Always leverage @coding-standards.md for coding standards and guidelines.
