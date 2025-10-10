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

## Architecture

### Data Layer
- **IndexedDB via Dexie** (`lib/db.ts`): Single `GsdDatabase` instance with `tasks` table (v2 with recurrence, tags, subtasks support)
- **CRUD Operations** (`lib/tasks.ts`): All task mutations (create, update, delete, toggle, import/export) plus subtask management (addSubtask, deleteSubtask, toggleSubtask)
- **Live Queries** (`lib/use-tasks.ts`): React hook `useTasks()` returns `{ all, byQuadrant }` with live updates
- **Schema Validation** (`lib/schema.ts`): Zod schemas for TaskDraft, TaskRecord, Subtask, ImportPayload, and RecurrenceType

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
  - `app/(pwa)/install/page.tsx` - PWA installation instructions
  - `app/layout.tsx` - Root layout with theme provider and PWA registration
- **UI Components** (`components/ui/`): shadcn-style primitives (button, dialog, input, etc.)
- **Domain Components** (`components/`):
  - `matrix-board.tsx` - 2×2 grid container, orchestrates task state
  - `matrix-column.tsx` - Single quadrant column with tasks
  - `task-card.tsx` - Individual task with complete/edit/delete actions
  - `task-form.tsx` - Create/edit task dialog with zod validation
  - `import-dialog.tsx` - Import mode selection dialog (merge vs replace)
  - `app-header.tsx` - Search, new task button, export/import buttons, theme toggle
  - `app-footer.tsx` - Footer with credits and build info

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

## Development Notes
- Changes to task schema require updating fixtures in `lib/schema.ts` and export/import logic
- Database migrations handled in `lib/db.ts` - current version is 2
- When modifying quadrant logic, update both `lib/quadrants.ts` and UI rendering in matrix components
- PWA updates require changes to manifest.json, icons, and sw.js together
- Run `pnpm typecheck` and `pnpm lint` before committing
- Static export mode means no runtime server features (no API routes, no SSR)
- New task fields (recurrence, tags, subtasks) are all optional with sensible defaults
- Import mode parameter defaults to "replace" for backward compatibility in lib/tasks.ts functions
