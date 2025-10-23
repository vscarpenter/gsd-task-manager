# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GSD Task Manager is a privacy-first Eisenhower matrix task manager built with Next.js 15 App Router. All data is stored locally in IndexedDB via Dexie, with JSON export/import for backups. The app is a PWA that works completely offline.

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
- **IndexedDB via Dexie** (`lib/db.ts`): Single `GsdDatabase` instance with `tasks`, `smartViews`, and `notificationSettings` tables (v6 with dependencies support)
- **CRUD Operations** (`lib/tasks.ts`): All task mutations (create, update, delete, toggle, import/export) plus subtask management (addSubtask, deleteSubtask, toggleSubtask) and dependency management (addDependency, removeDependency)
- **Live Queries** (`lib/use-tasks.ts`): React hook `useTasks()` returns `{ all, byQuadrant }` with live updates
- **Schema Validation** (`lib/schema.ts`): Zod schemas for TaskDraft, TaskRecord, Subtask, ImportPayload, and RecurrenceType
- **Analytics** (`lib/analytics.ts`): Productivity metrics calculation including completion rates, streaks, and trends
- **Dependencies** (`lib/dependencies.ts`): Task dependency validation and relationship queries (circular dependency detection, blocking/blocked tasks)

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
    - `task-form.tsx` - Create/edit task dialog with zod validation
    - `task-form-tags.tsx` - Tag input with autocomplete
    - `task-form-subtasks.tsx` - Subtask checklist editor
    - `task-form-dependencies.tsx` - Dependency selector with circular dependency prevention
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
  - **Navigation & Settings**:
    - `app-header.tsx` - Search, new task button, settings menu, smart view selector, theme toggle
    - `view-toggle.tsx` - Matrix/Dashboard navigation toggle
    - `app-footer.tsx` - Footer with credits and build info
    - `import-dialog.tsx` - Import mode selection dialog (merge vs replace)

### Key Patterns
- **Client-side only**: All components use `"use client"` - no server rendering
- **Live reactivity**: `useTasks()` hook returns live data via `useLiveQuery` from dexie-react-hooks
- **Validation**: All task operations validate with zod schemas before persisting
- **Keyboard shortcuts**: Implemented via `useEffect` listeners (n=new, /=search, ?=help)
- **Recurring tasks**: When completed, automatically create new instance with updated due date
- **Enhanced search**: Search includes tags and subtasks in addition to title/description
- **Visual indicators**: Overdue warnings (red), due today alerts (amber), recurrence icons, subtask progress bars

### PWA Configuration
- `public/manifest.json` - App metadata for installation
- `public/sw.js` - Service worker for offline caching
- `components/pwa-register.tsx` - Client component that registers SW on mount

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

## Development Notes
- Changes to task schema require updating fixtures in `lib/schema.ts`, export/import logic, and test fixtures in `tests/`
- Database migrations handled in `lib/db.ts` - current version is 6 (v1→v6: tags/subtasks→filters→notifications→dependencies)
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
- Always leverage @coding-standards.md for coding standards and guidelines