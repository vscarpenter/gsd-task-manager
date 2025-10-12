# Technical Documentation

Developer guide for GSD Task Manager contributors and self-hosters.

## Tech Stack

- **Framework:** Next.js 15 (App Router, static export)
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

- **Database setup:** `lib/db.ts` — Single `GsdDatabase` instance (v6) with three tables:
  - `tasks` — Task records with quadrant, completion, due dates, tags, subtasks, and dependencies
  - `smartViews` — Custom saved filter configurations
  - `notificationSettings` — User notification preferences
- **CRUD operations:** `lib/tasks.ts` — All task mutations (create, update, delete, toggle, import/export)
  - Subtask management: `addSubtask`, `deleteSubtask`, `toggleSubtask`
  - Dependency management: `addDependency`, `removeDependency`, `removeDependencyReferences`
- **React integration:** `lib/use-tasks.ts` — `useTasks()` hook returns `{ all, byQuadrant }` with live updates
- **Validation:** `lib/schema.ts` — Zod schemas for TaskDraft, TaskRecord, Subtask, ImportPayload, and RecurrenceType

**Database Migrations:**
- v1: Initial tasks table
- v2: Added recurrence, tags, subtasks fields
- v3: Added notification fields (notifyBefore, notificationEnabled, notificationSent)
- v4: Added smartViews table for custom filters
- v5: Added notificationSettings table
- v6: Added dependencies field for task dependencies

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
- `app/(pwa)/install/page.tsx` — PWA installation instructions
- `app/layout.tsx` — Root layout with theme provider and PWA registration

**UI Components** (`components/ui/`):
- shadcn-style primitives (button, dialog, input, textarea, etc.)

**Domain Components** (`components/`):
- **Matrix View:**
  - `matrix-board.tsx` — 2×2 grid container, orchestrates task state and selection mode
  - `matrix-column.tsx` — Single quadrant column with tasks
  - `task-card.tsx` — Individual task with complete/edit/delete actions and selection checkbox
- **Task Management:**
  - `task-form.tsx` — Create/edit task dialog with Zod validation
  - `task-form-tags.tsx` — Tag input with autocomplete
  - `task-form-subtasks.tsx` — Subtask checklist management
  - `task-form-dependencies.tsx` — Dependency selector with circular prevention
- **Dashboard:**
  - `dashboard/stats-card.tsx` — Metric display cards
  - `dashboard/completion-trend.tsx` — Line chart showing 7-day completion trend
  - `dashboard/quadrant-distribution.tsx` — Bar chart of task distribution
  - `dashboard/activity-heatmap.tsx` — Day-of-week completion heatmap
- **Batch Operations:**
  - `bulk-actions-bar.tsx` — Floating action bar for batch operations
- **Navigation & Layout:**
  - `app-header.tsx` — Search, new task, view toggle, settings menu
  - `view-toggle.tsx` — Switch between Matrix and Dashboard views
  - `app-footer.tsx` — Footer with credits and attribution
- **Dialogs & Settings:**
  - `import-dialog.tsx` — Import mode selection (merge vs replace)
  - `settings-menu.tsx` — Export/import controls

### Key Patterns

- **Client-side only:** All components use `"use client"` — no server rendering
- **Live reactivity:** `useTasks()` hook returns live data via `useLiveQuery` from dexie-react-hooks
- **Validation:** All task operations validate with Zod schemas before persisting
- **Keyboard shortcuts:** Implemented via `useEffect` listeners (n=new, /=search, ?=help)
- **Recurring tasks:** Auto-create new instances on completion with updated due dates
- **Enhanced search:** Full-text search includes title, description, tags, and subtask content
- **Visual indicators:** Overdue (red border), due today (amber label), recurrence icon, progress bars
- **Selection state:** Batch operations use `Set<string>` for efficient lookup and deduplication
- **Circular dependency prevention:** Real-time validation using BFS algorithm in UI
- **Pure analytics functions:** All metric calculations are side-effect-free for testability
- **Transaction-based batch operations:** Ensure atomicity (all-or-nothing) for bulk updates

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

**Test Suite Stats (v3.0):**
- Total tests: 177
- Dependencies module: 98.74% coverage
- All tests passing with comprehensive edge case coverage

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
  - Current version: v6
  - Always provide upgrade function with default values for new fields
  - Test migration by exporting v2 data and importing into v6
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
