# Copilot Instructions for GSD Task Manager

This guide enables AI coding agents to work productively in the GSD Task Manager codebase. Follow these project-specific conventions and workflows for best results.

## Architecture Overview

### Core Stack
- **Next.js 16 App Router**: All routes in `app/`. Matrix view: `app/(matrix)/page.tsx`. Dashboard: `app/(dashboard)/dashboard/page.tsx`. PWA install: `app/(pwa)/install/page.tsx`.
- **Client-side only**: No server rendering. All components use `"use client"`.
- **Data Layer**: IndexedDB via Dexie v4 (`lib/db.ts`, current schema v12). CRUD in `lib/tasks.ts`. Live queries via `useTasks()` hook (`lib/use-tasks.ts`).
- **Quadrant System**: Tasks classified by `urgent`/`important` booleans → 4 quadrants. Logic in `lib/quadrants.ts`.
- **Schema Validation**: Zod schemas in `lib/schema.ts` for all data types.

### Database Schema (v12)
- **Tables**: `tasks`, `archivedTasks`, `smartViews`, `notificationSettings`, `syncQueue`, `syncMetadata`, `deviceInfo`, `archiveSettings`, `syncHistory`, `appPreferences`
- **Task Fields**: Core (id, title, description, urgent, important, quadrant, completed, completedAt, dueDate, createdAt, updatedAt) + Advanced (recurrence, tags, subtasks, dependencies, notifyBefore, snoozedUntil, vectorClock, estimatedMinutes, timeSpent, timeEntries)
- **Indexes**: Performance-critical indexes on `quadrant`, `completed`, `dueDate`, `completedAt`, `createdAt`, `updatedAt`, `*tags`, `*dependencies`, `notificationSent`
- **Migrations**: Schema changes always require migration in `lib/db.ts`. See `DATABASE_ARCHITECTURE.md` for full ERD.

### Key Architectural Decisions
1. **Zero-knowledge sync**: Optional cloud sync encrypts locally with AES-256-GCM before upload. Worker stores only encrypted blobs. Encryption passphrase never leaves client.
2. **Vector clocks**: Conflict detection via per-device version numbers. BFS algorithm prevents circular dependencies in task graph.
3. **Modular components**: Large files split into <300 line modules. Example: `lib/sync/` has 20+ focused modules vs monolithic sync engine.
4. **Pure analytics functions**: All metric calculations in `lib/analytics/` are side-effect-free for testability and composability.
5. **Transaction-based batch operations**: `lib/bulk-operations.ts` ensures atomicity (all-or-nothing) for multi-task updates.

## Component Patterns

### UI Components
- **Primitives** (`components/ui/`): shadcn-style components (button, dialog, input, etc.). No size prop on buttons—use variant: "primary" | "subtle" | "ghost".
- **Domain Components**: `matrix-board/` (modular orchestration), `matrix-column.tsx`, `task-card.tsx`, `task-form/` (modular form with validation hook).
- **Dialogs**: All use Radix UI Dialog primitive. Example: `import-dialog.tsx`, `bulk-tag-dialog.tsx`.
- **Hooks**: Custom hooks like `useTasks()`, `useViewTransition()`, `useSmartViewShortcuts()` encapsulate complex logic.

### Smart Views & Command Palette
- **Smart Views**: Saved filter configurations (`smartViews` table). Pin up to 5 in header with keyboard shortcuts (1-9, 0=clear).
- **Command Palette**: Global ⌘K/Ctrl+K shortcut (`command-palette.tsx`). Includes quick actions, navigation, and search.
- **Quick Settings**: Slide-out panel (`quick-settings-panel.tsx`) for frequently-adjusted preferences (theme, notifications, sync interval).

### Sync Architecture
- **Frontend**: `lib/sync/` with 20+ modules: `sync-coordinator.ts` (orchestrator), `engine.ts` (push/pull/resolve), `crypto.ts` (AES-256-GCM), `token-manager.ts` (OAuth + refresh), `queue-optimizer.ts` (batch operations).
- **Backend**: Cloudflare Worker (`worker/src/`) with Hono router, D1 (SQLite), KV (OAuth state), R2 (encrypted blobs). OAuth with Google/Apple (OIDC-compliant).
- **Endpoints**: `/api/auth/oauth/:provider/start`, `/api/auth/oauth/callback`, `/api/sync/push`, `/api/sync/pull`, `/api/sync/status`, `/api/devices`.
- **State Machine**: Sync engine has 6 phases: Validating → Preparing → Pushing → Pulling → Resolving → Finalizing. See `SYNC_ARCHITECTURE.md` for Mermaid diagrams.

### MCP Server Integration
- **Purpose**: Enable Claude Desktop to access/analyze tasks via natural language.
- **Location**: `packages/mcp-server/` (standalone npm package, Node.js 18+).
- **20 Tools**: Read (7), Write (5), Analytics (5), System (3). All write operations support `dryRun` mode.
- **Config**: `~/Library/Application Support/Claude/claude_desktop_config.json` with `GSD_API_BASE_URL`, `GSD_AUTH_TOKEN`, `GSD_ENCRYPTION_PASSPHRASE`.

## Developer Workflows

### Essential Commands
- `bun install` — Install deps (generates `bun.lock`)
- `bun dev` — Dev server at http://localhost:3000
- `bun typecheck` — TypeScript type checking (no emit)
- `bun lint` — ESLint with Next.js config
- `bun test` — Vitest CI mode
- `bun test:watch` — Vitest watch mode
- `bun test -- --coverage` — Coverage report (target: ≥80% statements/lines/functions, ≥75% branches)
- `bun run build` — Production build (includes typecheck)
- `bun run export` — Static export for S3/CloudFront

### CloudFront Deployment
- **Why**: S3 doesn't auto-serve `index.html` for directory paths. Need CloudFront Function for SPA routing.
- **Deploy**: `./scripts/deploy-cloudfront-function.sh` after adding new App Router routes.
- **Full Deploy**: `bun run deploy` (builds, syncs to S3, invalidates CloudFront)

### Worker Development
- **Deploy**: `npm run deploy:all` in `worker/`
- **Migrations**: `npm run migrations:dev` or `npm run migrations:prod`
- **Setup**: `./worker/scripts/setup-{env}.sh` for environment config

### MCP Server Development
- **Build**: `npm run build` in `packages/mcp-server/`
- **Test**: `npm test` (unit tests with dry-run validation)
- **CLI**: `gsd-mcp setup` (interactive config), `gsd-mcp validate` (config validation)

## Coding Conventions

### TypeScript & Naming
- **Strict mode**: Always. Next.js typed routes enabled.
- **Naming**: PascalCase for components/types, camelCase for functions/variables, kebab-case for files/folders.
- **Imports**: Use `@/` alias for all internal imports (configured in `tsconfig.json`).

### Styling
- **Tailwind**: Group classes by layout → spacing → color. Shared utilities in `app/globals.css`.
- **Dark Mode**: Use `next-themes`. Classes: `dark:bg-gray-900` etc.

### Patterns to Follow
1. **Live reactivity**: Use `useLiveQuery()` from `dexie-react-hooks` for real-time updates.
2. **Validation**: Always validate with Zod schemas before persisting to IndexedDB.
3. **Error handling**: Use `try/catch` with structured logging (`lib/logger.ts`). Sanitize secrets in logs.
4. **Keyboard shortcuts**: Global shortcuts in `lib/shortcuts.ts`. Component-level shortcuts use `useEffect` with event listeners.
5. **Recurring tasks**: Auto-create next instance on completion via `handleRecurrence()` in `lib/tasks.ts`.
6. **Circular dependencies**: Always validate with `wouldCreateCircularDependency()` (BFS algorithm in `lib/dependencies.ts`) before adding dependencies.
7. **Transaction-based bulk ops**: Use `db.transaction('rw', [...tables], async () => { ... })` for atomicity.

## Coding Standards & Philosophy

### Core Principles
- **Favor simplicity over cleverness**: Clear, readable code > complex solutions. Optimize only when needed.
- **Start minimal and iterate**: Build smallest working solution first, then enhance.
- **Optimize for the next developer**: Write code easy to maintain and understand.
- **Descriptive naming**: Clear names that express intent (no abbreviations unless standard).
- **Small, focused functions**: Each function does one thing well. Max 20-30 lines. Early returns + guard clauses.
- **Comment "why" not "what"**: Code should be self-documenting. Comments explain reasoning or non-obvious logic.
- **DRY, but not prematurely**: Extract after seeing repetition 3+ times. Avoid over-abstraction.
- **YAGNI**: Don't build for hypothetical future needs.
- **Composition over inheritance**: Build functionality by combining simple pieces.

### Quality Checklist
- Can a new team member understand this code in 5 minutes?
- Are names self-explanatory?
- Is the happy path clear and error handling robust?
- Is there unnecessary complexity or cleverness?
- Does it solve the actual problem without extra features?

## Testing

### Test Structure
- **UI tests**: `tests/ui/` with `@testing-library/react` and `@testing-library/jest-dom`
- **Data tests**: `tests/data/` for persistence logic
- **Coverage targets**: 80% statements/lines/functions, 75% branches
- **Key patterns**: Mock IndexedDB with `fake-indexeddb`. Test keyboard shortcuts. Cover offline scenarios.

## Commit & PRs

- **Conventional Commits**: Use `feat:`, `fix:`, `docs:`, `test:`, etc. Reference issues (e.g., `Fixes #123`).
- **PRs**: Explain motivation, solution, and tests. Include screenshots for UI changes. Link to spec docs (`CLAUDE.md`, `TECHNICAL.md`).
- **Rebase**: Rebase before review. Wait for green lint/test/build status.

## PWA & Privacy

- **Client-side only**: No server rendering or network dependencies (except optional sync).
- **Manifest & Icons**: Update `public/manifest.json`, icons, and `public/sw.js` together. Test with `bun run export`.
- **Data**: All user data stays local by default. Export/import via JSON. Sync is opt-in with end-to-end encryption.

## References

- **Product Scope**: `CLAUDE.md` (features, architecture decisions, development notes)
- **Technical Details**: `TECHNICAL.md` (stack, data layer, component structure, key patterns)
- **Contribution Standards**: `coding-standards.md` (agentic behavior, solution quality, reflection)
- **Database**: `DATABASE_ARCHITECTURE.md` (ERD, schema migrations, indexing strategy)
- **Sync**: `SYNC_ARCHITECTURE.md` (state machine, conflict resolution, encryption)
- **Features**: `GSD_FEATURES_GUIDE.md` (user-facing feature guide)
- **OAuth/OIDC**: `OAUTH_OIDC_GUIDE.md` (OAuth flow, token lifecycle, security)

---

**Feedback Welcome**: If any section is unclear or missing, please provide feedback to improve these instructions.