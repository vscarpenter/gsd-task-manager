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
- **IndexedDB via Dexie** (`lib/db.ts`): Single `GsdDatabase` instance with `tasks` table
- **CRUD Operations** (`lib/tasks.ts`): All task mutations (create, update, delete, toggle, import/export)
- **Live Queries** (`lib/use-tasks.ts`): React hook `useTasks()` returns `{ all, byQuadrant }` with live updates
- **Schema Validation** (`lib/schema.ts`): Zod schemas for TaskDraft, TaskRecord, and ImportPayload

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
  - `app-header.tsx` - Search, new task button, theme toggle
  - `app-footer.tsx` - Export/import JSON controls

### Key Patterns
- **Client-side only**: All components use `"use client"` - no server rendering
- **Live reactivity**: `useTasks()` hook returns live data via `useLiveQuery` from dexie-react-hooks
- **Validation**: All task operations validate with zod schemas before persisting
- **Keyboard shortcuts**: Implemented via `useEffect` listeners (n=new, /=search, ?=help)

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

## Development Notes
- Changes to task schema require updating fixtures in `lib/schema.ts` and export/import logic
- When modifying quadrant logic, update both `lib/quadrants.ts` and UI rendering in matrix components
- PWA updates require changes to manifest.json, icons, and sw.js together
- Run `pnpm typecheck` and `pnpm lint` before committing
- Static export mode means no runtime server features (no API routes, no SSR)
