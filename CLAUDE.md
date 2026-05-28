# CLAUDE.md

Guidance for Claude Code working in this repository. Coding standards live in @coding-standards.md (imported). Path-scoped rules live in `.claude/rules/*.md` and auto-load when their globs match.

## Project Overview

GSD Task Manager is a privacy-first Eisenhower matrix task manager built with Next.js 16 App Router. All data is stored locally in IndexedDB via Dexie, with JSON export/import for backups. The app is a PWA that works completely offline.

**Key Features:**
- **Single-Matrix UI (v9)** — Simplified single-matrix layout with capture-bar; see `docs/adr/0011-v9-single-matrix-refactor.md`
- **Optional Cloud Sync** — Multi-device sync via self-hosted PocketBase at `https://api.vinny.io` (OAuth with Google/GitHub)
- **MCP Server Integration** — AI-powered task management through Claude Desktop with natural language queries
- **Realtime Sync** — PocketBase SSE (Server-Sent Events) for instant cross-device updates
- **iOS-style Settings** — Full-page settings with grouped layout and modular sections (`components/settings-page/`)
- **Command Palette (planned)** — Global ⌘K/Ctrl+K palette source exists at `components/command-palette/` but is **not wired into the v9 app shell**; resurrection tracked in `tasks/todo.md`

**Path-scoped rules** (auto-loaded by glob — open these only when working in the matching subtree):
- `.claude/rules/pocketbase-sync.md` — PocketBase v0.23+ gotchas, sync architecture, OAuth callback debugging
- `.claude/rules/testing.md` — Test runner, TDD workflow, jsdom/bun gotchas
- `.claude/rules/sw-cache.md` — Service worker multi-cache strategy (ADR 0012)
- `.claude/rules/mcp-server.md` — MCP server package conventions and tool layout

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
- `bun run test:e2e` - Run Playwright end-to-end tests
- `bun run test:e2e:ui` - Run Playwright tests with UI mode
- `bun run test:e2e:debug` - Run Playwright tests in debug mode

### Build & Deployment
- `bun run build` - Build production bundle
- `bun run export` - Generate static export for S3/CloudFront
- `./scripts/deploy-cloudfront-function.sh` - Deploy CloudFront Function for SPA routing

**CloudFront Edge Routing**: Required because S3 doesn't auto-serve `index.html` for directory paths. Run the deploy script after adding new App Router routes.

## Architecture

### Data Layer
- **IndexedDB via Dexie** (`lib/db.ts`): `tasks`, `archivedTasks`, `smartViews`, `notificationSettings`, `appPreferences` (plus sync-internal tables) at schema v14
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
  - `components/matrix-simplified/` - v9 single-matrix shell (app-shell, capture-bar, edit-drawer, help-drawer, matrix-grid, topbar, icon-rail)
  - `components/task-card/` - Task card with header/metadata/actions sub-components
  - `components/sync/` - Sync button, auth dialog, OAuth buttons
  - `components/settings/` - Settings sections (appearance, notifications, sync, archive, data-management, about)
  - `components/settings-page/` - Full-page settings shell (used by `app/settings/`)
  - `components/dashboard/` - Analytics charts and metrics
  - `components/about/` - About page sections
  - `components/command-palette/` - ⌘K palette implementation (currently not wired into v9 shell — resurrection planned)

### Key Patterns
- **Client-side only**: All components use `"use client"` - no server rendering
- **Live reactivity**: `useTasks()` returns live data via `useLiveQuery`
- **Validation**: All task operations validate with Zod schemas before persisting
- **Keyboard shortcuts (v9)**: n=new task, /=search; help-drawer documents others
- **Recurring tasks**: Completed recurring tasks auto-create next instance
- **Enhanced search**: Includes tags and subtasks

### PWA, Cloud Sync, MCP Server
Architecture details for these subsystems live in path-scoped rules:
- PWA / service-worker cache strategy → `.claude/rules/sw-cache.md` (auto-loads on `public/sw*.js`, `lib/sw-cache-logic.ts`)
- PocketBase sync + OAuth → `.claude/rules/pocketbase-sync.md` (auto-loads on `lib/sync/**`)
- MCP server package → `.claude/rules/mcp-server.md` (auto-loads on `packages/mcp-server/**`)

**Quick refs that survive without opening a rule file**:
- Backend: self-hosted PocketBase at `https://api.vinny.io`; admin UI at `/_/`.
- MCP server: `packages/mcp-server/` workspace; build with `npm run build`; 20 tools exposed.
- Cache layers: `gsd-immutable-v1` (hashed, cache-first), `gsd-pages-v{v}` (network-first), `gsd-runtime-v{v}` (cache-first).

## Testing Guidelines
- UI tests in `tests/ui/`, data logic in `tests/data/`
- E2E tests in `tests/e2e/` using Playwright
- Use `@testing-library/react` and `@testing-library/jest-dom` for unit tests
- Coverage thresholds: 80% statements, 80% lines, 80% functions, 75% branches

### E2E Testing
- Playwright tests in `tests/e2e/` with auto-starting dev server (`playwright.config.ts`)
- Tests run against Chromium, Firefox, WebKit
- IndexedDB is cleared between tests automatically; root URL redirects to the about page on first load
- Use `data-testid` attributes on components for stable selectors
- Page Object Model for maintainable test fixtures

## Code Style
- **TypeScript strict mode** with Next.js typed routes
- **Naming**: PascalCase for components/types, camelCase for functions, kebab-case for files
- **Tailwind**: Group classes by layout → spacing → color
- **Imports**: Use `@/` alias for all internal imports

## Development Notes

### Non-Obvious Dependencies

These packages are not self-explanatory from their names alone:

- **`@tanstack/react-virtual`** — Virtual scrolling for large task lists; only renders visible DOM rows, preventing performance degradation when lists grow into hundreds of tasks.
- **`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`** — Accessible, headless drag-and-drop primitives. Supports screen readers and full keyboard navigation, unlike most DnD libraries.
- **`recharts`** — Lightweight, composable chart library used for dashboard analytics (completion trends, quadrant distribution). Chosen for small bundle size and React-native API.
- **`sonner`** — Accessible toast notifications (ARIA live regions, focus management). The app uses `toast.error()` for user-facing errors instead of `window.alert()`.
- **`babel-plugin-react-compiler`** — Enables the React compiler for automatic memoization optimization, reducing manual `useMemo`/`useCallback` boilerplate.
- **`canvas-confetti`** — Task completion celebration animation. Pinned to exact version `1.9.4` for reproducible builds (the API changed in v2).
- **`nanoid`** — Cryptographically-secure unique ID generation for tasks and smart views. Produces URL-safe IDs smaller than UUIDs.

### Schema & Database
- Task schema changes require updating `lib/schema.ts`, export/import logic, and test fixtures
- Database migrations in `lib/db.ts` - current version is 14
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
- Smart view shortcuts and pinning UI were removed in v9 (see ADR 0011). The `smartViews` Dexie table is retained for data continuity but has no UI surface in the v9 shell.

### Cloud Sync, MCP Server, OAuth
Detail moved to path-scoped rules — see `.claude/rules/pocketbase-sync.md` and `.claude/rules/mcp-server.md`. Those auto-load when you edit the relevant subtrees.

### Sentry verification (recurring debugging task)
When testing Sentry capture after a DSN change or deploy:
1. Confirm DSN is loaded: `console.log` in `lib/sentry/init.ts` (or wherever Sentry.init runs) and grep dev console for "Sentry initialized".
2. Trigger a test error: `Sentry.captureException(new Error("manual-test-from-claude"))` in a dev-only handler, OR throw from a component error boundary.
3. Verify in Sentry dashboard within ~30s.
4. Remove the test trigger before commit (it's not a regression — leave it out of source).

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

### Testing
Detail moved to `.claude/rules/testing.md` — auto-loads when editing `tests/**` or test setup. TL;DR: use `bun run test` (not `bun test`), `fake-indexeddb` is auto-imported, `localStorage.clear()` doesn't work in jsdom-under-Bun.

## Modular Architecture

The codebase follows coding standards (<350 lines per file, <30 lines per function). Key modular areas:

- **lib/analytics/**: metrics, streaks, tags, trends
- **lib/notifications/**: display, permissions, settings, badge
- **lib/sync/**: pocketbase-client, pb-sync-engine, pb-realtime, pb-auth, task-mapper, sync-coordinator, health-monitor, queue, config
- **components/matrix-simplified/**: v9 single-matrix shell, capture-bar, edit-drawer, help-drawer
- **components/settings/**: appearance, notification, sync, archive, data-management sections
- **components/settings-page/**: full-page settings shell + sidebar
- **packages/mcp-server/src/tools/**: handlers/, schemas/, individual tool files
- **packages/mcp-server/src/write-ops/**: task-operations, bulk-operations with dry-run support

All modules maintain backward compatibility through re-export layers.

## Git Workflow

**Default commit flow**: when the user says "commit and push", "commit, push, create a PR", or any close variant, invoke the `commit-commands:commit-push-pr` skill — don't manually compose the steps. Write a descriptive conventional commit message, bump the version if appropriate, create a PR unless told otherwise.

**Branch rule**: never commit on `main`. Create a feature branch (`<type>/<short-desc>`) first. A `PreToolUse` hook (`.claude/hooks/no-main-commits.sh`) enforces this.

Coding standards: see @coding-standards.md (imported).

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `vscarpenter/gsd-task-manager`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
