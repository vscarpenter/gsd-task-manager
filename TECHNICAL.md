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

- **Database setup:** `lib/db.ts` — Single `GsdDatabase` instance with `tasks` table
- **CRUD operations:** `lib/tasks.ts` — All task mutations (create, update, delete, toggle, import/export)
- **React integration:** `lib/use-tasks.ts` — `useTasks()` hook returns `{ all, byQuadrant }` with live updates
- **Validation:** `lib/schema.ts` — Zod schemas for TaskDraft, TaskRecord, and ImportPayload

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
- `app/(pwa)/install/page.tsx` — PWA installation instructions
- `app/layout.tsx` — Root layout with theme provider and PWA registration

**UI Components** (`components/ui/`):
- shadcn-style primitives (button, dialog, input, textarea, etc.)

**Domain Components** (`components/`):
- `matrix-board.tsx` — 2×2 grid container, orchestrates task state
- `matrix-column.tsx` — Single quadrant column with tasks
- `task-card.tsx` — Individual task with complete/edit/delete actions
- `task-form.tsx` — Create/edit task dialog with Zod validation
- `app-header.tsx` — Search, new task button, theme toggle
- `app-footer.tsx` — Export/import JSON controls

### Key Patterns

- **Client-side only:** All components use `"use client"` — no server rendering
- **Live reactivity:** `useTasks()` hook returns live data via `useLiveQuery` from dexie-react-hooks
- **Validation:** All task operations validate with Zod schemas before persisting
- **Keyboard shortcuts:** Implemented via `useEffect` listeners (n=new, /=search, ?=help)

### PWA Configuration

- `public/manifest.json` — App metadata for installation
- `public/sw.js` — Service worker for offline caching
- `components/pwa-register.tsx` — Client component that registers SW on mount

## Testing

Tests use Vitest with Testing Library for component and integration testing.

- **UI tests:** `tests/ui/`
- **Data logic tests:** `tests/data/`
- **Coverage thresholds:** 80% statements, 80% lines, 80% functions, 75% branches (configured in `vitest.config.ts`)

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

- Changes to task schema require updating fixtures in `lib/schema.ts` and export/import logic
- When modifying quadrant logic, update both `lib/quadrants.ts` and UI rendering in matrix components
- PWA updates require changes to `manifest.json`, icons, and `sw.js` together
- Run `pnpm typecheck` and `pnpm lint` before committing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm test && pnpm lint && pnpm typecheck`)
5. Commit your changes with a clear message
6. Push to your fork and open a pull request

## License

See [LICENSE](./LICENSE) file for details.
