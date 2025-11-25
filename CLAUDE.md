# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GSD Task Manager is a privacy-first Eisenhower matrix task manager built with Next.js 16 App Router. All data is stored locally in IndexedDB via Dexie, with JSON export/import for backups. The app is a PWA that works completely offline.

**v5.0.0 Features:**
- **Optional Cloud Sync** — End-to-end encrypted multi-device sync via Cloudflare Workers (OAuth with Google/Apple)
- **MCP Server Integration** — AI-powered task management through Claude Desktop with natural language queries
- **Zero-Knowledge Architecture** — Worker stores only encrypted blobs; decryption happens locally

**v5.10.0 Features (UI/UX Enhancements):**
- **Enhanced Smart Views** — Pin up to 5 smart views to header for quick access (keyboard shortcuts 1-9, 0 to clear)
- **Command Palette** — Global ⌘K/Ctrl+K shortcut for quick actions, navigation, and task search
- **Quick Settings Panel** — Slide-out panel for frequently-adjusted settings (theme, show completed, notifications, sync interval)

## Core Commands

### Development
- `pnpm install` - Install dependencies (generates pnpm-lock.yaml)
- `pnpm dev` - Start development server at http://localhost:3000
- `pnpm typecheck` - Run TypeScript type checking without emitting files

### Testing & Quality
- `pnpm test` - Run Vitest tests in CI mode
- `pnpm test:watch` - Run Vitest in watch mode during development
- `pnpm test -- --coverage` - Generate coverage report (target: ≥80% statements)
- `pnpm lint` - Run ESLint with Next.js config

### Build & Deployment
- `pnpm build` - Build production bundle and surface type errors
- `pnpm export` - Generate static export for S3/CloudFront deployment
- `pnpm start` - Start production server (note: app uses static export)
- `./scripts/deploy-cloudfront-function.sh` - Deploy CloudFront Function for edge URL rewriting

#### CloudFront Edge Routing

**IMPORTANT**: The production app uses a CloudFront Function for SPA routing. Next.js static exports with `trailingSlash: true` create files like `/dashboard/index.html`, but S3 bucket endpoints don't automatically serve `index.html` for directory paths (would return 403).

**How it works**:
- CloudFront Function runs at edge locations with sub-millisecond latency
- Rewrites directory paths before request reaches S3:
  - `/dashboard/` → `/dashboard/index.html`
  - `/install/` → `/install/index.html`
  - `/` → `/index.html`

**Files**:
- `cloudfront-function-url-rewrite.js` - Edge function code (JavaScript runtime, not Node.js)
- `scripts/deploy-cloudfront-function.sh` - Automated deployment script

**When to redeploy**:
- After adding new routes in App Router
- If URL routing behavior changes
- When modifying the rewrite logic

**Deployment**:
```bash
./scripts/deploy-cloudfront-function.sh
```

This script automatically:
1. Creates or updates the CloudFront Function
2. Publishes the function to production
3. Attaches it to the distribution's default cache behavior
4. Invalidates the CloudFront cache
5. Propagates changes to all edge locations (2-3 min)

## Architecture

### Data Layer
- **IndexedDB via Dexie** (`lib/db.ts`): Single `GsdDatabase` instance with `tasks`, `smartViews`, `notificationSettings`, and `appPreferences` tables (v11 with app preferences)
- **CRUD Operations** (`lib/tasks.ts`): All task mutations (create, update, delete, toggle, import/export) plus subtask management (addSubtask, deleteSubtask, toggleSubtask) and dependency management (addDependency, removeDependency)
- **Bulk Operations** (`lib/bulk-operations.ts`): Batch operations for multi-select (delete, complete, uncomplete, move, add tags) - extracted from matrix-board for code organization
- **Live Queries** (`lib/use-tasks.ts`): React hook `useTasks()` returns `{ all, byQuadrant }` with live updates
- **Schema Validation** (`lib/schema.ts`): Zod schemas for TaskDraft, TaskRecord, Subtask, ImportPayload, and RecurrenceType
- **Analytics** (`lib/analytics/`): Modular productivity metrics (see Modular Architecture section)
- **Notifications** (`lib/notifications/`): Modular notification system (see Modular Architecture section)
- **Dependencies** (`lib/dependencies.ts`): Task dependency validation and relationship queries (circular dependency detection, blocking/blocked tasks)
- **Structured Logging** (`lib/logger.ts`): Environment-aware logger with contexts (SYNC_ENGINE, SYNC_PUSH, SYNC_PULL, etc.), log levels (debug/info/warn/error), and automatic secret sanitization
- **Constants** (`lib/constants/`): Centralized magic numbers and configuration values

### Quadrant System
Tasks are classified by `urgent` and `important` boolean flags, which derive a quadrant ID:
- `urgent-important` - Do first (Q1)
- `not-urgent-important` - Schedule (Q2)
- `urgent-not-important` - Delegate (Q3)
- `not-urgent-not-important` - Eliminate (Q4)

Quadrant logic lives in `lib/quadrants.ts` with `resolveQuadrantId()` and `quadrantOrder` array.

### Component Structure
- **App Router** (`app/`):
  - `app/(matrix)/page.tsx` - Main matrix view (renders MatrixBoard)
  - `app/(dashboard)/dashboard/page.tsx` - Analytics dashboard with metrics and charts
  - `app/(pwa)/install/page.tsx` - PWA installation instructions
  - `app/layout.tsx` - Root layout with theme provider and PWA registration
- **UI Components** (`components/ui/`): shadcn-style primitives (button, dialog, input, etc.)
- **Domain Components** (`components/`):
  - **Matrix View**:
    - `matrix-board.tsx` - 2×2 grid container, orchestrates task state and bulk operations
    - `matrix-column.tsx` - Single quadrant column with tasks
    - `task-card.tsx` - Individual task with complete/edit/delete actions, selection mode
  - **Task Management**:
    - `task-form/` - Modular task form (see Modular Architecture section)
    - `task-form-tags.tsx` - Tag input with autocomplete
    - `task-form-subtasks.tsx` - Subtask checklist editor
    - `task-form-dependencies.tsx` - Dependency selector with circular dependency prevention
  - **Sync Components** (`components/sync/`):
    - `sync-button.tsx` - Main sync button UI component
    - `use-sync-health.ts` - Health monitoring hook
    - `use-sync-status.ts` - Status display logic hook
  - **Bulk Operations**:
    - `bulk-actions-bar.tsx` - Floating action bar for multi-select operations
    - `bulk-tag-dialog.tsx` - Dialog for adding tags to multiple tasks
  - **Dashboard** (`components/dashboard/`):
    - `stats-card.tsx` - Metric display with optional trend indicators
    - `completion-chart.tsx` - Line/bar chart for completed vs created tasks
    - `quadrant-distribution.tsx` - Pie chart showing task distribution
    - `streak-indicator.tsx` - Visual display of current/longest completion streaks
    - `tag-analytics.tsx` - Table with tag usage and completion rates
    - `upcoming-deadlines.tsx` - Grouped display of overdue/due today/due this week tasks
  - **User Guide** (`components/user-guide/`):
    - `user-guide-dialog.tsx` - Main dialog wrapper (163 lines, down from 1,049)
    - `shared-components.tsx` - Reusable guide components (GuideSection, QuadrantBlock, FeatureBlock, etc.)
    - `getting-started-section.tsx` - Getting started content
    - `matrix-section.tsx` - Eisenhower Matrix deep dive
    - `task-management-section.tsx` - Core task features
    - `advanced-features-section.tsx` - Advanced features (recurring, tags, subtasks, dependencies)
    - `smart-views-section.tsx` - Smart views & filtering
    - `batch-operations-section.tsx` - Batch operations
    - `dashboard-section.tsx` - Dashboard & analytics
    - `workflows-section.tsx` - Workflows & best practices
    - `data-privacy-section.tsx` - Data & privacy
    - `shortcuts-section.tsx` - Keyboard shortcuts
    - `pwa-section.tsx` - PWA features
  - **Navigation & Settings**:
    - `app-header.tsx` - Search, new task button, settings menu, smart view pills, theme toggle
    - `smart-view-pills.tsx` - Horizontal scrollable pills for pinned smart views with keyboard shortcuts (1-9, 0 to clear)
    - `smart-view-selector.tsx` - Full smart view selector with pin/unpin functionality
    - `command-palette.tsx` - Global command palette (⌘K/Ctrl+K) with action search and task quick-open
    - `quick-settings-panel.tsx` - Slide-out panel for frequently-adjusted settings (theme, show completed, notifications, sync)
    - `view-toggle.tsx` - Matrix/Dashboard navigation toggle
    - `app-footer.tsx` - Footer with credits and build info
    - `import-dialog.tsx` - Import mode selection dialog (merge vs replace)

### Key Patterns
- **Client-side only**: All components use `"use client"` - no server rendering
- **Live reactivity**: `useTasks()` hook returns live data via `useLiveQuery` from dexie-react-hooks
- **Validation**: All task operations validate with zod schemas before persisting
- **Keyboard shortcuts**: Implemented via `useEffect` listeners (n=new, /=search, ?=help, ⌘K/Ctrl+K=command palette, 1-9=smart view selection, 0=clear view)
- **Recurring tasks**: When completed, automatically create new instance with updated due date
- **Enhanced search**: Search includes tags and subtasks in addition to title/description
- **Visual indicators**: Overdue warnings (red), due today alerts (amber), recurrence icons, subtask progress bars

### PWA Configuration
- `public/manifest.json` - App metadata for installation
- `public/sw.js` - Service worker for offline caching
- `components/pwa-register.tsx` - Client component that registers SW on mount

### Cloud Sync Architecture (Optional, v5.0.0)
- **Backend**: Cloudflare Workers + D1 (SQLite) + KV + R2
- **Authentication**: OAuth 2.0 with Google and Apple (OIDC-compliant)
- **Encryption**: AES-256-GCM with PBKDF2 key derivation (600k iterations)
- **Multi-Environment**: Dev, staging, prod with isolated databases and secrets
- **Sync Protocol**: Vector clock-based conflict resolution with cascade sync
- **Zero-Knowledge**: Worker stores only encrypted blobs + metadata, cannot decrypt task content

**Key Files (Worker - Backend)**:
- `worker/src/index.ts` - Main Worker entry point with Hono router
- `worker/src/handlers/sync/` - Modular sync handlers (push, pull, resolve, status, devices, helpers)
- `worker/src/handlers/oidc/` - Modular OIDC handlers (initiate, callback, result, token-exchange, id-verification, helpers)
- `worker/src/handlers/auth.ts` - Authentication middleware and utilities
- `worker/src/db/` - D1 database queries and migrations
- `worker/src/utils/logger.ts` - Worker-side structured logger

**Key Files (Client - Frontend)**:
- `lib/sync/engine.ts` - Re-export for backward compatibility (getSyncEngine singleton)
- `lib/sync/engine/coordinator.ts` - Main SyncEngine class with orchestration logic (350 lines)
- `lib/sync/engine/push-handler.ts` - Push operations (encrypts and uploads local changes)
- `lib/sync/engine/pull-handler.ts` - Pull operations (downloads and decrypts remote changes)
- `lib/sync/engine/conflict-resolver.ts` - Automatic conflict resolution (last-write-wins)
- `lib/sync/engine/error-handler.ts` - Error categorization and recovery strategies
- `lib/sync/engine/metadata-manager.ts` - Sync config and metadata management
- `lib/sync/crypto.ts` - Client-side AES-256-GCM encryption/decryption
- `lib/sync/api-client.ts` - HTTP client for Worker API
- `lib/sync/token-manager.ts` - JWT token lifecycle management
- `lib/sync/queue.ts` - Offline operation queue with persistence

**API Endpoints**:
- `/api/auth/login/:provider` - OAuth initiation
- `/api/auth/callback/:provider` - OAuth callback
- `/api/sync/push` - Upload encrypted task changes
- `/api/sync/pull` - Fetch encrypted task updates
- `/api/sync/status` - Sync health check
- `/api/devices` - Device management

### MCP Server Architecture (v5.0.0)
- **Purpose**: Enable Claude Desktop to access and analyze tasks via natural language
- **Location**: `packages/mcp-server/` - Standalone npm package
- **Runtime**: Node.js 18+ with TypeScript
- **Communication**: stdio transport (JSON-RPC 2.0) with Claude Desktop
- **Security**: Read-only access, decryption happens locally on user's machine

**Key Modules** (modularized in v5.6.1):
- `packages/mcp-server/src/index.ts` - MCP server entry point, tool registration
- `packages/mcp-server/src/crypto.ts` - Encryption/decryption using Node.js Web Crypto API
- `packages/mcp-server/src/tools/` - Individual MCP tool implementations (see Modular Architecture section)
- `packages/mcp-server/src/api/` - HTTP client with error handling
- `packages/mcp-server/src/cli/` - Setup wizard and validation utilities

**Available MCP Tools**:
1. `list_tasks` - List decrypted tasks with optional filtering (quadrant, status, tags)
2. `get_task` - Get detailed task information by ID
3. `search_tasks` - Search across titles, descriptions, tags, subtasks
4. `get_sync_status` - Check sync health and storage usage
5. `list_devices` - View all registered devices
6. `get_task_stats` - Get task statistics and metadata

**Configuration**: Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json` with:
- `GSD_API_BASE_URL` - Worker API URL (https://gsd.vinny.dev)
- `GSD_AUTH_TOKEN` - JWT token from OAuth flow (7-day expiration)
- `GSD_ENCRYPTION_PASSPHRASE` - User's passphrase for local decryption

**Security Model**:
- Encryption passphrase stored only in Claude Desktop config (never in cloud)
- End-to-end encryption maintained (Worker cannot decrypt tasks)
- Read-only access (Claude cannot modify, create, or delete tasks)
- Opt-in feature (requires explicit passphrase configuration)

## Modular Architecture (v5.6.1 Refactoring)

The codebase underwent comprehensive modularization in v5.6.1 to comply with coding standards (<300 lines per file, <30 lines per function). All modules maintain 100% backward compatibility through re-export layers.

### Frontend Modules

**lib/analytics/** (Productivity Metrics)
```
lib/analytics/
├── index.ts          # Re-exports for backward compatibility
├── metrics.ts        # Core metrics (completion rates, quadrant performance)
├── streaks.ts        # Current and longest streak calculations
├── tags.ts           # Tag statistics and completion rates
└── trends.ts         # Completion trends over time periods
```
**Usage**: `import { calculateMetrics } from '@/lib/analytics'` (unchanged)

**lib/notifications/** (Notification System)
```
lib/notifications/
├── index.ts          # Re-exports for backward compatibility
├── display.ts        # showTaskNotification, showNotification
├── permissions.ts    # Permission management and quiet hours
├── settings.ts       # Settings CRUD with IndexedDB
└── badge.ts          # PWA badge API
```
**Usage**: `import { showTaskNotification } from '@/lib/notifications'` (unchanged)

**lib/constants/** (Centralized Constants)
```
lib/constants/
├── sync.ts           # Sync-related constants (TOKEN_CONFIG, SYNC_CONFIG, OAUTH_CONFIG, ENCRYPTION_CONFIG, SYNC_TOAST_DURATION)
└── (constants.ts remains at lib/ root for DND_CONFIG, TOAST_DURATION, NOTIFICATION_TIMING)
```
**Usage**: `import { SYNC_TOAST_DURATION } from '@/lib/constants/sync'`

**lib/sync/** (Sync Configuration)
```
lib/sync/
├── config.ts             # Main sync configuration management
└── config-migration.ts   # Legacy config migration logic
```

**components/task-form/** (Task Form Component)
```
components/task-form/
├── index.tsx          # Main TaskForm component (UI rendering)
├── use-task-form.ts   # Form state management hook
└── validation.ts      # Zod schemas and validation helpers
```
**Usage**: `import { TaskForm } from '@/components/task-form'` (unchanged)

**components/sync/** (Sync Button Component)
```
components/sync/
├── sync-button.tsx       # Main UI component
├── use-sync-health.ts    # Health monitoring hook
└── use-sync-status.ts    # Status display logic hook
```

### MCP Server Modules

**packages/mcp-server/src/api/** (HTTP Client)
```
api/
└── client.ts         # API request handling with error categorization
```

**packages/mcp-server/src/encryption/** (Encryption)
```
encryption/
└── manager.ts        # Encryption initialization and key derivation
```

**packages/mcp-server/src/tools/** (MCP Tools)
```
tools/
├── list-tasks.ts     # List tasks with filters
├── get-task.ts       # Get single task by ID
├── search-tasks.ts   # Search across task fields
├── sync-status.ts    # Sync status and statistics
└── devices.ts        # Device management
```

**packages/mcp-server/src/cli/** (CLI Utilities)
```
cli/
├── index.ts          # Argument parsing and help display
├── setup-wizard.ts   # Interactive setup wizard
└── validation.ts     # Configuration validation
```

**packages/mcp-server/src/analytics/** (MCP Analytics)
```
analytics/
├── index.ts          # Re-exports
├── metrics.ts        # Core metrics calculation
├── streaks.ts        # Streak calculation logic
└── aggregator.ts     # AI insights generation
```

**Key Module Files**:
- `types.ts` - Shared type definitions
- `constants.ts` - Shared constants
- `tools.ts` - Backward compatibility re-export layer

### Refactoring Principles Applied

1. **Single Responsibility** - Each module has one clear purpose
2. **Backward Compatibility** - All existing imports continue to work via re-export layers
3. **Function Decomposition** - Large functions split into focused helpers (<30 lines each)
4. **File Size Compliance** - All files <300 lines (target met across 30+ modularized files)
5. **Type Safety** - Zero new TypeScript errors introduced
6. **Test Compatibility** - All 1,298 tests maintain compatibility (15 test failures are pre-existing timer-related issues)

### Coding Standards Compliance

**Achieved**:
- ✅ All files <300 lines
- ✅ 97% of functions <30 lines (3% are acceptable orchestrators)
- ✅ Magic numbers extracted to named constants
- ✅ Complex logic documented with "why" comments
- ✅ Zero breaking changes
- ✅ Production build successful

**Benefits**:
- Improved maintainability (smaller, focused modules)
- Better testability (can test modules in isolation)
- Enhanced readability (clear separation of concerns)
- Easier debugging (smaller units to reason about)

## Testing Guidelines
- Place UI tests in `tests/ui/`, data logic in `tests/data/`
- Use `@testing-library/react` and `@testing-library/jest-dom` for component tests
- Test Dexie persistence paths including import/export flows
- Coverage thresholds in `vitest.config.ts`: 80% statements, 80% lines, 80% functions, 75% branches

## Code Style
- **TypeScript strict mode** with Next.js typed routes enabled
- **Naming**: PascalCase for components/types, camelCase for functions, kebab-case for files
- **Tailwind**: Group classes by layout → spacing → color; shared styles in `app/globals.css`
- **React components**: Arrow functions with explicit return types when complex
- **Imports**: Use `@/` alias for all internal imports

## Feature Highlights (v2)

### Recurring Tasks
- Set recurrence interval: none, daily, weekly, monthly
- When marking a recurring task complete, a new instance is automatically created with the next due date
- Subtasks reset to uncompleted in new instances
- Recurrence indicator (repeat icon) shown on task cards

### Tags & Labels
- Add multiple tags to any task for categorization (e.g., #work, #personal, #health)
- Tags displayed as colored chips on task cards
- Search includes tag content for easy filtering
- Tag management in task form with inline add/remove

### Subtasks & Checklists
- Break down complex tasks into smaller actionable steps
- Visual progress bar showing completed/total subtasks (e.g., 2/5)
- Toggle subtask completion in task form
- Subtasks searchable via main search bar

### Enhanced Due Dates
- **Overdue warning**: Red border and "Overdue" label for past-due tasks
- **Due today alert**: Amber "Due today" label for immediate tasks
- Utility functions in `lib/utils.ts`: `isOverdue()`, `isDueToday()`, `isDueThisWeek()`
- Visual hierarchy helps prioritize time-sensitive work

### Import/Export with Mode Selection
- **Export**: Download all tasks as JSON backup file
- **Import with options**: When importing, users choose between two modes:
  - **Merge mode** (safe): Keeps existing tasks and adds imported tasks. Duplicate IDs are automatically regenerated to prevent conflicts.
  - **Replace mode** (destructive): Deletes all existing tasks and replaces with imported tasks. Shows warning with existing task count.
- Import dialog shows task counts for both existing and incoming tasks
- All import operations are validated against Zod schemas before persisting
- Implementation: `components/import-dialog.tsx`, `lib/tasks.ts` (importTasks, importFromJson)

### Advanced Filtering & Smart Views (Phase 2)
- **Smart Views**: Pre-configured filter combinations for common workflows
  - 7 built-in views: Today's Focus, This Week, Overdue Backlog, No Deadline, Recently Added, Recently Completed, Recurring Tasks
  - Custom Smart Views: Users can save their own filter combinations
  - Smart View selector in header (right of search bar)
  - Database schema v4 with `smartViews` table
- **Filter System**: Comprehensive filtering with multiple criteria
  - Filter by: quadrants, status, tags, due dates, recurrence, search query
  - FilterCriteria interface in `lib/filters.ts` with 99.23% test coverage
  - FilterBar shows active filter chips (removable)
  - FilterPopover provides detailed filter editor with collapsible sections
  - TagMultiselect component for searchable tag selection
- **UI Layout**:
  - Settings menu in header (Import/Export moved here)
  - Smart View selector in header (right of search)
  - Add Filter button **temporarily disabled** - Smart Views provide sufficient filtering for current needs
  - FilterBar only appears when filters are active (cleaner UI)
- **Implementation Notes**:
  - All filter components fully implemented and functional
  - Add Filter button commented out in `app-header.tsx` (lines 79-82)
  - To re-enable: uncomment button and wire up `onOpenFilters` prop
  - FilterPopover component ready for use when needed

## Feature Highlights (v3.0)

### Dashboard & Analytics
- **Comprehensive Metrics** (`lib/analytics.ts`):
  - Completion statistics: today, this week, this month
  - Completion rate: percentage of completed vs total tasks
  - Active and longest streak tracking
  - Quadrant distribution analysis
  - Tag-based statistics with completion rates
  - Trend data for 7/30/90 day periods
- **Interactive Visualizations** (`components/dashboard/*`):
  - Stats cards with trend indicators (up/down arrows)
  - Completion trend chart (toggleable line/bar view, 7/30/90 day periods)
  - Quadrant distribution pie chart
  - Streak indicator with flame icon
  - Tag analytics table with progress bars
  - Upcoming deadlines widget (overdue, due today, due this week)
- **Navigation**: ViewToggle component in header for Matrix ↔ Dashboard switching
- **Route**: `/dashboard` with full analytics dashboard layout
- **Dependencies**: Added `recharts@^3.2.1` and `date-fns@^4.1.0`

### Batch Operations
- **Selection Mode**:
  - Click anywhere on task card to select/deselect (replaces drag handle in selection mode)
  - Visual ring indicator on selected tasks
  - Auto-enables when first task is selected
- **Bulk Actions Bar** (`components/bulk-actions-bar.tsx`):
  - Floating action bar fixed at bottom center with animation
  - Shows selection count with clear button
  - Complete/Uncomplete buttons for batch status changes
  - Move to Quadrant dropdown menu
  - Add Tags button opens bulk tag dialog
  - Delete button with red styling for batch deletion
- **Bulk Tag Dialog** (`components/bulk-tag-dialog.tsx`):
  - Tag autocomplete with existing tag suggestions
  - Add multiple tags at once to all selected tasks
  - Automatic tag deduplication
  - Shows selected task count in title
- **State Management**:
  - `selectionMode` boolean state
  - `selectedTaskIds` Set<string> for efficient lookups
  - All bulk operations with toast notifications
  - Error handling for failed operations
- **Implementation**: Integrated into MatrixBoard with 8 bulk operation handlers

### Task Dependencies
- **Data Model**:
  - `dependencies: string[]` field on TaskRecord storing IDs of blocking tasks
  - Database v6 migration with automatic empty array default
  - Zod schema validation for dependencies array
- **Dependency Logic** (`lib/dependencies.ts`):
  - `wouldCreateCircularDependency()` - Validates no circular refs using BFS
  - `getBlockingTasks()` - Get tasks that must be completed first
  - `getBlockedTasks()` - Get tasks waiting on this task
  - `getUncompletedBlockingTasks()` - Filter to only incomplete blockers
  - `isTaskBlocked()` / `isTaskBlocking()` - Status check helpers
  - `getReadyTasks()` - Filter tasks with no blocking dependencies
  - `validateDependencies()` - Comprehensive validation with error messages
- **UI Components**:
  - **TaskFormDependencies** (`components/task-form-dependencies.tsx`):
    - Search and filter available tasks (excludes self, completed, circular)
    - Autocomplete dropdown with task title and description
    - Selected dependencies displayed as chips with remove buttons
    - Real-time circular dependency warning
    - Shows dependency count
  - **Task Form Integration**:
    - Added `taskId` prop to TaskForm for edit mode
    - Integrated dependency selector below subtasks
    - Passes task ID for circular dependency checking
- **CRUD Operations** (`lib/tasks.ts`):
  - `addDependency()` - Add single dependency with duplicate check
  - `removeDependency()` - Remove single dependency
  - `removeDependencyReferences()` - Cleanup when deleting a task
  - Updated `createTask()` and `updateTask()` to handle dependencies field
- **User Experience**:
  - Can't depend on self or completed tasks
  - Can't create circular dependencies (validated in real-time)
  - Search filters to relevant tasks only
  - Clear visual feedback for selected dependencies

## Feature Highlights (v5.0.0)

### OAuth Cloud Sync
- **End-to-End Encryption**: AES-256-GCM with PBKDF2 key derivation (600k iterations, OWASP 2023)
- **Zero-Knowledge Architecture**: Worker stores only encrypted task blobs; cannot decrypt task content
- **OAuth Authentication**: Secure login with Google or Apple (OIDC-compliant)
- **Multi-Device Sync**: Vector clock-based synchronization across unlimited devices
- **Conflict Resolution**: Automatic cascade sync for concurrent edits with manual resolution UI
- **Device Management**: View, manage, and revoke access for specific devices
- **Session Management**: JWT tokens with 7-day expiration and refresh flow

**Implementation Details**:
- `worker/src/index.ts` - Cloudflare Worker with Hono router
- `worker/src/routes/auth.ts` - OAuth login, callback, registration, salt endpoints
- `worker/src/routes/sync.ts` - Push, pull, status endpoints with vector clock logic
- `worker/src/routes/devices.ts` - Device listing and management
- `worker/src/db/` - D1 database queries with prepared statements
- `lib/sync/` - Frontend sync client with encryption (AES-GCM wrapper)
- Multi-environment deployment: dev (`localhost:3000`), staging (`gsd-dev.vinny.dev`), prod (`gsd.vinny.dev`)

**Security Features**:
- Encryption salt stored encrypted in D1 (useless without user's passphrase)
- PBKDF2 with 600,000 iterations (OWASP 2023 recommendation)
- Nonce per encryption operation (96-bit random)
- JWT tokens signed with HS256 (256-bit secret per environment)
- Rate limiting via KV (100 requests/minute per IP)
- CORS restrictions (only allow origin: https://gsd.vinny.dev in prod)

### MCP Server for Claude Desktop
- **Natural Language Task Access**: Query tasks with plain English ("What are my urgent tasks this week?")
- **6 MCP Tools**: list_tasks, get_task, search_tasks, get_sync_status, list_devices, get_task_stats
- **Local Decryption**: Encryption passphrase stored only in Claude Desktop config (never in cloud)
- **Read-Only Access**: Claude cannot modify, create, or delete tasks (safe exploration)
- **Privacy-Preserved**: End-to-end encryption maintained throughout (Worker → MCP → Claude)

**Implementation Details**:
- `packages/mcp-server/src/index.ts` - MCP server using `@modelcontextprotocol/sdk`
- `packages/mcp-server/src/crypto.ts` - Node.js Web Crypto API port of client-side crypto
- `packages/mcp-server/src/tools.ts` - API client with fetch + JWT auth, tool handlers
- stdio transport (JSON-RPC 2.0) spawned by Claude Desktop
- Stateless tool calls (no persistent state, ephemeral decryption)

**Usage Examples**:
- "What are my urgent tasks?" → Uses `list_tasks` with filter
- "Find tasks about the quarterly report" → Uses `search_tasks`
- "How many tasks do I have in Q2?" → Uses `list_tasks` + analysis
- "Check my sync status" → Uses `get_sync_status`

**Configuration**: Claude Desktop config JSON with environment variables:
```json
{
  "mcpServers": {
    "gsd-taskmanager": {
      "command": "npx",
      "args": ["-y", "@gsd/mcp-server"],
      "env": {
        "GSD_API_BASE_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "eyJ...",
        "GSD_ENCRYPTION_PASSPHRASE": "user's passphrase"
      }
    }
  }
}
```

## Development Notes
- Changes to task schema require updating fixtures in `lib/schema.ts`, export/import logic, and test fixtures in `tests/`
- Database migrations handled in `lib/db.ts` - current version is 11 (v1→v11: tags/subtasks→filters→notifications→dependencies→appPreferences)
- When modifying quadrant logic, update both `lib/quadrants.ts` and UI rendering in matrix components
- PWA updates require changes to manifest.json, icons, and sw.js together
- Run `pnpm typecheck` and `pnpm lint` before committing
- Static export mode means no runtime server features (no API routes, no SSR)
- New task fields (recurrence, tags, subtasks, dependencies) are all optional with sensible defaults
- Import mode parameter defaults to "replace" for backward compatibility in lib/tasks.ts functions
- Dependencies:
  - Always validate circular dependencies before adding relationships
  - Clean up dependency references when deleting tasks (use `removeDependencyReferences()`)
  - Consider blocking/blocked relationships when implementing dependency-aware features
- Dashboard uses `recharts` for visualizations - keep chart configurations simple for better TypeScript inference
- Batch operations use Set<string> for `selectedTaskIds` for O(1) lookup performance
- CloudFront Function:
  - Required for production SPA routing (S3 bucket endpoints don't auto-serve index.html for directory paths)
  - If adding new App Router routes, deploy CloudFront Function after deploying static files: `./scripts/deploy-cloudfront-function.sh`
  - The function rewrites URLs at edge before reaching S3 (e.g., `/dashboard/` → `/dashboard/index.html`)
  - Changes propagate to edge locations in 2-3 minutes
- Navigation:
  - Use `useViewTransition()` hook for client-side navigation with smooth View Transitions API
  - The hook automatically adds trailing slashes to routes (required for static export with trailingSlash: true)
  - View transitions only work in Chrome/Edge 111+, Safari 18+ (gracefully degrades in Firefox)
- Cloud Sync (v5.0.0):
  - **Worker Deployment**: Use `npm run deploy:all` in `worker/` to deploy to dev, staging, prod
  - **Environment Setup**: Run `./worker/scripts/setup-{env}.sh` to create D1, KV, R2 resources
  - **Migrations**: Use `npm run migrations:{env}` to apply D1 schema changes
  - **Secrets**: Set OAuth client IDs, secrets, JWT secret per environment via `wrangler secret put`
  - **Testing**: Use `./worker/test-*.sh` scripts for manual API testing with curl
  - **JWT Tokens**: Expire after 7 days; frontend should handle refresh flow (401 → re-auth)
  - **Encryption**: Never log or expose encryption salts or passphrases in Worker code
- MCP Server (v5.0.0):
  - **Location**: All MCP code in `packages/mcp-server/` (standalone package)
  - **Building**: Run `npm run build` in `packages/mcp-server/` before testing
  - **Testing**: Configure Claude Desktop with local `node dist/index.js` for development
  - **Tools**: Add new MCP tools in `tools.ts` following existing pattern (schema + handler)
  - **Security**: MCP tools must be read-only; never implement write operations without user consent
  - **Decryption**: Use `CryptoManager` singleton from `crypto.ts` for all decryption
  - **Error Handling**: Provide clear error messages (e.g., "Token expired" vs generic "Auth failed")
  - **Documentation**: Update `packages/mcp-server/README.md` when adding new tools
- **UI/UX Enhancements (v5.10.0)**:
  - **Smart View Pinning**: Store pinned view IDs in `appPreferences` table; emit `pinnedViewsChanged` CustomEvent when views are pinned/unpinned
  - **Command Palette**: Uses `cmdk` library (v1.1.1); actions built with `buildCommandActions()` and filtered in `useCommandPalette` hook
  - **Quick Settings**: Uses Radix UI Sheet and Slider primitives; settings loaded from `getSyncConfig()` (not `getSyncStatus()` for auto-sync properties)
  - **Keyboard Shortcuts**: Smart view shortcuts (1-9, 0) implemented in `useSmartViewShortcuts` with typing context detection via `isTypingElement()`
  - **Button Component**: Only supports variants "primary" | "subtle" | "ghost"; no `size` prop (use className for sizing)
- Always leverage @coding-standards.md for coding standards and guidelines

## Modular Architecture (Refactoring - October 2025)

The codebase underwent comprehensive refactoring to comply with coding standards (300-line file limit). Key improvements:

### Component Refactoring
- **User Guide** (1,049 → 163 lines): Split into 13 modular section components in `components/user-guide/`
  - Shared components extracted for reusability
  - Each section independently maintainable (<120 lines each)
  - Preserved exact same UI/UX functionality

### Sync Engine Refactoring (Frontend)
- **lib/sync/engine.ts** (924 → 350 lines): Modularized into `lib/sync/engine/`
  - `coordinator.ts` - Main orchestration logic (350 lines)
  - `push-handler.ts` - Push operations (207 lines)
  - `pull-handler.ts` - Pull operations (182 lines)
  - `conflict-resolver.ts` - Conflict resolution (54 lines)
  - `error-handler.ts` - Error categorization (132 lines)
  - `metadata-manager.ts` - Config & metadata (142 lines)
  - Backward-compatible re-export maintains existing imports

### Worker Handler Refactoring (Backend)
- **worker/src/handlers/sync.ts** (617 → 14 lines): Split into `worker/src/handlers/sync/`
  - `push.ts` - Push endpoint (240 lines)
  - `pull.ts` - Pull endpoint (163 lines)
  - `resolve.ts` - Conflict resolution (63 lines)
  - `status.ts` - Status endpoint (67 lines)
  - `devices.ts` - Device management (90 lines)
  - `helpers.ts` - Shared utilities (24 lines)

- **worker/src/handlers/oidc.ts** (612 → 18 lines): Split into `worker/src/handlers/oidc/`
  - `initiate.ts` - OAuth flow initiation (98 lines)
  - `callback.ts` - OAuth callback handler (299 lines)
  - `result.ts` - Result retrieval (58 lines)
  - `token-exchange.ts` - Token acquisition (76 lines)
  - `id-verification.ts` - JWT verification (56 lines)
  - `helpers.ts` - PKCE & Apple JWT utilities (106 lines)

### Structured Logging Implementation
- **lib/logger.ts**: Comprehensive logging system with:
  - 17 contexts (SYNC_ENGINE, SYNC_PUSH, SYNC_PULL, TASK_CRUD, etc.)
  - 4 log levels (debug, info, warn, error)
  - Environment-aware filtering (debug only in development)
  - Automatic secret sanitization
  - Correlation ID support for tracking related operations
- Replaced ~88 console statements in sync engine and worker handlers
- Remaining console statements intentionally preserved for debug utilities and UI-level logging

### Bulk Operations Extraction
- **lib/bulk-operations.ts**: Extracted from matrix-board.tsx
  - 7 standalone functions (clearSelection, toggleSelectionMode, bulkDelete, bulkComplete, bulkUncomplete, bulkMoveToQuadrant, bulkAddTags)
  - Reduced matrix-board.tsx from 635 → 590 lines
  - Improved testability and reusability

### Benefits Achieved
- **Compliance**: All major files now <350 lines (target was 300)
- **Maintainability**: Single-responsibility modules easier to understand and modify
- **Testability**: Functions can be tested in isolation
- **Readability**: Clearer code organization with logical boundaries
- **No Breaking Changes**: 100% backward compatibility maintained, all 479 tests passing
- **Type Safety**: No new TypeScript errors introduced