# Technical Documentation

Developer guide for GSD Task Manager contributors and self-hosters.

## Tech Stack

- **Framework:** Next.js 16 (App Router, static export)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn-inspired primitives
- **Database:** Dexie (IndexedDB wrapper)
- **Validation:** Zod schemas
- **Testing:** Vitest + Testing Library
- **PWA:** Service Worker + Web Manifest
- **Data Visualization:** Recharts 3.2+ (dashboard charts)
- **Date Utilities:** date-fns 4.1+ (date calculations and formatting)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
pnpm install
pnpm dev
```

Development server runs at `http://localhost:3000`.

## Available Scripts

- `pnpm dev` — Start Next.js development server
- `pnpm build` — Build production bundle (includes type checking)
- `pnpm export` — Generate static export for S3/CloudFront
- `pnpm start` — Start production server (note: app uses static export)
- `pnpm typecheck` — Run TypeScript type checking without emitting files
- `pnpm lint` — Run ESLint with Next.js config
- `pnpm test` — Run Vitest tests in CI mode
- `pnpm test:watch` — Run Vitest in watch mode
- `pnpm test -- --coverage` — Generate coverage report (target: ≥80% statements)

## Architecture

### Data Layer

All task data is stored client-side using IndexedDB via Dexie.

- **Database setup:** `lib/db.ts` — Single `GsdDatabase` instance (v12) with tables:
  - `tasks` — Task records with quadrant, completion, due dates, tags, subtasks, dependencies, and time tracking
  - `archivedTasks` — Completed tasks moved to archive after retention period
  - `smartViews` — Custom saved filter configurations
  - `notificationSettings` — User notification preferences
  - `syncQueue` — Pending sync operations for offline support
  - `syncMetadata` — OAuth tokens, device info, sync configuration
  - `deviceInfo` — Device UUID and name for multi-device sync
  - `archiveSettings` — Auto-archive configuration
  - `syncHistory` — Audit log of sync operations
  - `appPreferences` — UI preferences like pinned smart views
- **CRUD operations:** `lib/tasks.ts` — All task mutations (create, update, delete, toggle, import/export)
  - Subtask management: `addSubtask`, `deleteSubtask`, `toggleSubtask`
  - Dependency management: `addDependency`, `removeDependency`, `removeDependencyReferences`
- **React integration:** `lib/use-tasks.ts` — `useTasks()` hook returns `{ all, byQuadrant }` with live updates
- **Validation:** `lib/schema.ts` — Zod schemas for TaskDraft, TaskRecord, Subtask, ImportPayload, and RecurrenceType

**Database Migrations:**
- v1: Initial tasks table
- v2: Added recurrence, tags, subtasks fields
- v3: Added performance indexes (createdAt, updatedAt, compound)
- v4: Added smartViews table for custom filters
- v5: Added notification fields and notificationSettings table
- v6: Added dependencies field for task dependencies
- v7: Added sync support (syncQueue, syncMetadata, deviceInfo, vectorClock)
- v8: Added completedAt field for date-based filtering
- v9: Added archivedTasks table and archiveSettings
- v10: Added syncHistory table for sync audit logging
- v11: Added appPreferences table for UI preferences (pinned views)
- v12: Added time tracking fields (estimatedMinutes, timeSpent, timeEntries)

### v3.0 Features Architecture

#### Dashboard & Analytics

**Purpose:** Provide insights into task patterns, productivity metrics, and completion trends.

**Implementation:**
- **Analytics Module** (`lib/analytics.ts`) — Pure functions for calculating metrics:
  - `calculateTaskMetrics()` — Total, active, completed counts and completion rate
  - `calculateQuadrantDistribution()` — Task count per quadrant
  - `calculate7DayTrend()` — Daily completion counts for past week
  - `calculateDueDateAnalysis()` — Overdue, due today, due this week counts
  - `calculateActivityHeatmap()` — Task completion by day of week
- **Dashboard Components** (`components/dashboard/*`):
  - `stats-card.tsx` — Metric display cards
  - `completion-trend.tsx` — Line chart of 7-day completion trend
  - `quadrant-distribution.tsx` — Bar chart of task distribution
  - `activity-heatmap.tsx` — Grid visualization of completion patterns
- **Dashboard Page** (`app/(dashboard)/dashboard/page.tsx`) — Orchestrates layout and data fetching
- **View Toggle** (`components/view-toggle.tsx`) — Switch between Matrix and Dashboard views

**Dependencies:**
- `recharts` — Charting library for visualizations
- `date-fns` — Date calculations and formatting

#### Batch Operations

**Purpose:** Enable efficient management of multiple tasks simultaneously.

**Implementation:**
- **Selection State** (`components/matrix-board.tsx`) — Manages selected task IDs using `Set<string>`
- **Selection Mode UI:**
  - Checkbox overlay on task cards when in selection mode
  - Visual indicators (border styling) for selected tasks
  - Header button to enter/exit selection mode
- **Bulk Actions Bar** (`components/bulk-actions-bar.tsx`) — Floating action bar with operations:
  - Complete/reopen selected tasks
  - Delete selected tasks
  - Move to quadrant (change urgency/importance)
  - Add tags to selected tasks
  - Assign dependencies to selected tasks
- **Batch Operations** (`lib/tasks.ts`):
  - Operations wrapped in transactions for atomicity
  - Validation ensures all operations complete or none do

#### Task Dependencies

**Purpose:** Define prerequisite relationships between tasks to model sequential workflows.

**Data Model:**
- `dependencies: string[]` field on TaskRecord — Array of task IDs that must be completed first
- Validation prevents self-reference and circular dependencies

**Implementation:**
- **Dependency Utilities** (`lib/dependencies.ts`):
  - `wouldCreateCircularDependency()` — BFS algorithm to detect cycles in dependency graph
  - `getBlockingTasks()` — Get tasks that must be completed before this task
  - `getBlockedTasks()` — Get tasks that are waiting on this task
  - `getUncompletedBlockingTasks()` — Filter blocking tasks to only uncompleted ones
  - `isTaskBlocked()` — Check if task has uncompleted dependencies
  - `isTaskBlocking()` — Check if other tasks depend on this one
  - `getReadyTasks()` — Get tasks with no uncompleted dependencies
  - `validateDependencies()` — Comprehensive validation with error messages
- **UI Component** (`components/task-form-dependencies.tsx`):
  - Search/autocomplete for available tasks
  - Real-time circular dependency prevention
  - Selected dependencies displayed as removable chips
- **Form Integration** (`components/task-form.tsx`):
  - Added `taskId` prop to identify task being edited
  - Dependency selector integrated into task form
  - Validation prevents invalid dependency configurations

**Algorithm Details:**
- Circular dependency detection uses breadth-first search (BFS)
- Visited set prevents infinite loops in cyclic graphs
- Early exit optimization when cycle detected
- Complexity: O(V + E) where V = tasks, E = dependency edges

### Quadrant System

Tasks are classified by `urgent` and `important` boolean flags, which derive a quadrant ID:

- `urgent-important` → Do First (Q1)
- `not-urgent-important` → Schedule (Q2)
- `urgent-not-important` → Delegate (Q3)
- `not-urgent-not-important` → Eliminate (Q4)

Quadrant logic lives in `lib/quadrants.ts` with `resolveQuadrantId()` and `quadrantOrder` array.

### Component Structure

**App Router** (`app/`):
- `app/(matrix)/page.tsx` — Main matrix view (renders MatrixBoard)
- `app/(dashboard)/dashboard/page.tsx` — Dashboard view with analytics and visualizations
- `app/(archive)/archive/page.tsx` — Archive view for completed/archived tasks
- `app/(sync)/sync-history/page.tsx` — Sync operation history view
- `app/(pwa)/install/page.tsx` — PWA installation instructions
- `app/layout.tsx` — Root layout with theme provider and PWA registration

**UI Components** (`components/ui/`):
- shadcn-style primitives (button, dialog, input, textarea, etc.)

**Domain Components** (`components/`):
- **Matrix View:**
  - `matrix-board/` — Modular matrix board with orchestration hooks
  - `matrix-column.tsx` — Single quadrant column with tasks
  - `task-card.tsx` — Individual task with complete/edit/delete actions and selection checkbox
- **Task Management:**
  - `task-form/` — Modular task form (index.tsx, use-task-form.ts, validation.ts)
  - `task-form-tags.tsx` — Tag input with autocomplete
  - `task-form-subtasks.tsx` — Subtask checklist management
  - `task-form-dependencies.tsx` — Dependency selector with circular prevention
  - `task-timer.tsx` — Time tracking timer component
  - `snooze-dropdown.tsx` — Task snooze functionality
- **Dashboard:**
  - `dashboard/stats-card.tsx` — Metric display cards with trend indicators
  - `dashboard/completion-chart.tsx` — Line/bar chart (7/30/90 day periods)
  - `dashboard/quadrant-distribution.tsx` — Pie chart of task distribution
  - `dashboard/streak-indicator.tsx` — Visual completion streak display
  - `dashboard/tag-analytics.tsx` — Tag usage and completion rates table
  - `dashboard/upcoming-deadlines.tsx` — Grouped deadline display
  - `dashboard/time-analytics.tsx` — Time tracking visualizations
- **Sync Components** (`components/sync/`):
  - `sync-button.tsx` — Main sync button UI with status indicators
  - `sync-auth-dialog.tsx` — OAuth login/logout dialog
  - `oauth-buttons.tsx` — Google/Apple OAuth sign-in buttons
  - `encryption-passphrase-dialog.tsx` — Encryption passphrase setup/entry
  - `use-sync-health.ts` — Health monitoring hook
  - `use-sync-status.ts` — Status display logic hook
- **Settings Components** (`components/settings/`):
  - `settings-dialog.tsx` — iOS-style settings with tabbed sections
  - `appearance-settings.tsx` — Theme and display preferences
  - `notification-settings.tsx` — Notification configuration
  - `sync-settings.tsx` — Cloud sync settings and status
  - `archive-settings.tsx` — Auto-archive and retention settings
  - `data-management.tsx` — Import/export and data operations
  - `about-section.tsx` — App version and links
- **Batch Operations:**
  - `bulk-actions-bar.tsx` — Floating action bar for batch operations
  - `bulk-tag-dialog.tsx` — Dialog for adding tags to multiple tasks
- **Navigation & Layout:**
  - `app-header.tsx` — Search, new task, smart view pills, settings menu
  - `command-palette.tsx` — Global ⌘K/Ctrl+K command palette
  - `quick-settings-panel.tsx` — Slide-out quick settings panel
  - `smart-view-pills.tsx` — Pinned smart views in header
  - `smart-view-selector.tsx` — Full smart view selector with pin/unpin
  - `view-toggle.tsx` — Switch between Matrix and Dashboard views
  - `app-footer.tsx` — Footer with credits and attribution
- **User Guide** (`components/user-guide/`):
  - `user-guide-dialog.tsx` — Main dialog wrapper (modularized)
  - 11 section components for different topics
- **Dialogs:**
  - `import-dialog.tsx` — Import mode selection (merge vs replace)

### Key Patterns

- **Client-side only:** All components use `"use client"` — no server rendering
- **Live reactivity:** `useTasks()` hook returns live data via `useLiveQuery` from dexie-react-hooks
- **Validation:** All task operations validate with Zod schemas before persisting
- **Keyboard shortcuts:** Global shortcuts (n=new, /=search, ?=help, ⌘K=command palette, 1-9=smart view, 0=clear)
- **Recurring tasks:** Auto-create new instances on completion with updated due dates
- **Enhanced search:** Full-text search includes title, description, tags, and subtask content
- **Visual indicators:** Overdue (red border), due today (amber label), recurrence icon, progress bars
- **Selection state:** Batch operations use `Set<string>` for efficient lookup and deduplication
- **Circular dependency prevention:** Real-time validation using BFS algorithm in UI
- **Pure analytics functions:** All metric calculations are side-effect-free for testability
- **Transaction-based batch operations:** Ensure atomicity (all-or-nothing) for bulk updates
- **Time tracking:** Start/stop timers, automatic time calculation, session history
- **Modular architecture:** Large files split into <300 line modules (sync engine, user guide, etc.)

### Automatic Background Sync (v5.7.0)

**Purpose:** Automatically sync changes in the background without user intervention, improving multi-device workflows.

**Architecture:**

**Core Components:**
- **BackgroundSyncManager** (`lib/sync/background-sync.ts`) — Singleton class managing automatic sync lifecycle
  - `start()` — Initiates periodic sync and event listeners
  - `stop()` — Cleanup: clears intervals, removes event listeners
  - `scheduleDebouncedSync()` — Debounced sync trigger for task operations
  - `isRunning()` — Check if background sync is active

**Configuration:**
- `SyncConfig` extended with:
  - `autoSyncEnabled?: boolean` — Toggle auto-sync (default: `true`)
  - `autoSyncIntervalMinutes?: number` — Sync interval 1-30 min (default: `2`)
- `BackgroundSyncConfig` type defines runtime configuration:
  - `enabled` — Auto-sync on/off
  - `intervalMinutes` — Periodic sync interval
  - `syncOnFocus` — Sync when tab becomes visible (default: `true`)
  - `syncOnOnline` — Sync when network reconnects (default: `true`)
  - `debounceAfterChangeMs` — Delay after task edits (default: `30000` = 30s)

**Smart Triggers:**

1. **Periodic Interval** (`setInterval`)
   - Runs every N minutes (user-configurable)
   - Only syncs if: online + pending changes > 0
   - Minimum 15-second throttle between syncs

2. **Tab Visibility** (`document.visibilitychange`)
   - Syncs when tab becomes visible after being hidden
   - Prevents sync spam with MIN_SYNC_INTERVAL_MS check

3. **Network Reconnect** (`window.online` event)
   - Triggers sync immediately when coming back online
   - Pushes queued offline changes

4. **Debounced After Task Changes**
   - 30-second debounce timer after any task CRUD operation
   - Resets on new changes (coalesce rapid edits)
   - Integrated in `lib/tasks/crud.ts` via `scheduleSyncAfterChange()`

**Integration Points:**

- **useSync Hook** (`lib/hooks/use-sync.ts`)
  - Starts/stops `BackgroundSyncManager` based on sync enabled state
  - Loads auto-sync config and monitors changes every 500ms
  - Returns `autoSyncEnabled` and `autoSyncInterval` to UI

- **Task Operations** (`lib/tasks/crud.ts`, `lib/tasks/subtasks.ts`, `lib/tasks/dependencies.ts`)
  - After every `queue.enqueue()`, calls `scheduleDebouncedSync()`
  - Applies to: create, update, delete, toggle, move, duplicate

- **Settings UI** (`components/settings/sync-settings.tsx`)
  - Toggle switch for auto-sync on/off
  - Range slider + number input for interval (1-30 min)
  - Real-time config updates with 1-second debounce
  - Displays all sync trigger explanations

**Sync Priority System:**

- **User-initiated sync** (`requestSync('user')`) > **Auto-sync** (`requestSync('auto')`)
- `SyncCoordinator` ensures only one sync runs at a time
- Queues additional requests with deduplication (highest priority wins)

**Performance Optimizations:**

- Checks `navigator.onLine` before attempting sync (abort if offline)
- Checks `syncQueue.getPendingCount()` (skip if no changes)
- 15-second minimum interval prevents excessive syncs
- All intervals cleaned up on unmount/disable (no memory leaks)

**Lifecycle:**

```typescript
// Start (when sync enabled)
useEffect(() => {
  if (isEnabled && autoConfig.enabled) {
    bgSyncManager.start(autoConfig);
  }
}, [isEnabled]);

// Stop (on disable or unmount)
return () => {
  bgSyncManager.stop();
};
```

**Configuration Defaults:**

```typescript
{
  enabled: true,               // Auto-sync on by default
  intervalMinutes: 2,          // Sync every 2 minutes
  syncOnFocus: true,           // Sync on tab focus
  syncOnOnline: true,          // Sync on reconnect
  debounceAfterChangeMs: 30000 // 30s debounce
}
```

**User Preferences:**

Users can customize via **Settings → Cloud Sync**:
- Toggle auto-sync on/off
- Adjust interval (1-30 minutes)
- Manual sync button always available (bypasses throttling)

### PWA Configuration

- `public/manifest.json` — App metadata for installation
- `public/sw.js` — Service worker for offline caching
- `components/pwa-register.tsx` — Client component that registers SW on mount

## Testing

Tests use Vitest with Testing Library for component and integration testing.

- **UI tests:** `tests/ui/`
  - Component rendering and interaction tests
  - Dashboard component tests
  - Task card, form, and matrix tests
- **Data logic tests:** `tests/data/`
  - CRUD operations
  - Dependency validation (25 tests, 98.74% coverage)
  - Import/export with merge/replace modes
  - Filter and analytics logic
- **Coverage thresholds:** 80% statements, 80% lines, 80% functions, 75% branches (configured in `vitest.config.ts`)

**Test Suite Stats (v6.x):**
- Data layer coverage: 90%+ (tasks.ts, filters.ts, dependencies.ts, analytics.ts)
- Dependencies module: 98.74% coverage
- All tests passing with comprehensive edge case coverage
- Coverage target: ≥80% statements

Run tests:

```bash
pnpm test              # CI mode
pnpm test:watch        # Watch mode
pnpm test -- --coverage # With coverage report
```

## Code Style

- **TypeScript:** Strict mode with Next.js typed routes enabled
- **Naming conventions:**
  - PascalCase for components and types
  - camelCase for functions
  - kebab-case for filenames
- **Tailwind:** Group classes by layout → spacing → color; shared styles in `app/globals.css`
- **Imports:** Use `@/` alias for all internal imports

## Deployment

GSD uses static export for deployment to S3 + CloudFront:

```bash
pnpm build
pnpm export
```

Output is in the `out/` directory. Upload to your static hosting provider.

**Note:** Static export mode means no runtime server features (no API routes, no SSR).

## Development Notes

### General Guidelines

- Changes to task schema require updating:
  - Type definitions in `lib/types.ts`
  - Zod schemas in `lib/schema.ts`
  - Test fixtures across `tests/` directory
  - Database migration in `lib/db.ts` (increment version)
  - Export/import logic in `lib/tasks.ts`
- When modifying quadrant logic, update both `lib/quadrants.ts` and UI rendering in matrix components
- PWA updates require changes to `manifest.json`, icons, and `sw.js` together
- Run `pnpm typecheck` and `pnpm lint` before committing

### v3.0-Specific Notes

- **Dependencies:**
  - Always validate with `validateDependencies()` before persisting
  - Use `wouldCreateCircularDependency()` for real-time UI prevention
  - When deleting a task with dependencies, call `removeDependencyReferences()` to clean up references
  - Test fixtures must include `dependencies: []` field
- **Dashboard:**
  - Analytics functions are pure and can be tested in isolation
  - Recharts components require wrapper for Vitest (see `tests/ui/dashboard/*.test.tsx`)
  - Date calculations use date-fns for consistency
- **Batch Operations:**
  - All bulk operations should be wrapped in Dexie transactions
  - Selection state uses `Set<string>` for O(1) lookup
  - Clear selection state after operations complete
- **Database Migrations:**
  - Current version: v12
  - Always provide upgrade function with default values for new fields
  - Test migration by exporting old data and importing into latest version
- **Import/Export:**
  - Merge mode auto-regenerates IDs for duplicates (prevents conflicts)
  - Replace mode shows warning with existing task count
  - All imported data validated against Zod schemas

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm test && pnpm lint && pnpm typecheck`)
5. Commit your changes with a clear message
6. Push to your fork and open a pull request

## License

See [LICENSE](./LICENSE) file for details.
