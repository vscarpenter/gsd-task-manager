# Copilot Instructions for GSD Task Manager

This guide enables AI coding agents to work productively in the GSD Task Manager codebase. Follow these project-specific conventions and workflows for best results.

## Architecture Overview
- **Next.js 15 App Router**: All routes live in `app/`. Main matrix view is `app/(matrix)/page.tsx`. PWA install at `app/(pwa)/install/page.tsx`.
- **Client-side only**: No server rendering. All components use `"use client"`.
- **Data Layer**: Tasks are stored in IndexedDB via Dexie (`lib/db.ts`). CRUD and import/export logic in `lib/tasks.ts`. Live queries via `useTasks()` hook in `lib/use-tasks.ts`.
- **Quadrant System**: Tasks classified by `urgent`/`important` flags. Quadrant logic in `lib/quadrants.ts`.
- **Schema Validation**: Zod schemas for all data in `lib/schema.ts`.

## Component Patterns
- **UI Primitives**: Use shadcn/ui-style components in `components/ui/` (e.g., `button.tsx`, `dialog.tsx`).
- **Domain Components**: Matrix grid (`matrix-board.tsx`), quadrant columns (`matrix-column.tsx`), task cards (`task-card.tsx`), and forms (`task-form.tsx`).
- **Theme & PWA**: Theme provider and PWA registration in `app/layout.tsx`.

## Developer Workflows
- **Install**: `pnpm install` (commit `pnpm-lock.yaml`)
- **Dev Server**: `pnpm dev` (runs at http://localhost:3000)
- **Lint**: `pnpm lint` (ESLint + TypeScript)
- **Test**: `pnpm test` (Vitest, CI mode)
- **Coverage**: `pnpm test -- --coverage` (target ≥80%)
- **Build**: `pnpm build` (production build, type errors)
- **Export**: `pnpm export` (static bundle for S3/CloudFront)

## Coding Conventions
- **TypeScript strict mode**; 2-space indentation; arrow-style React components.
- **Naming**: PascalCase for components/hooks, camelCase for utilities, kebab-case for files/folders.
- **Tailwind**: Group classes by layout → spacing → color. Shared styles in `app/globals.css`.
- **Prettier + ESLint**: Run autofix before commits. No manual formatting overrides.

## Coding Standards & Philosophy
- **Favor simplicity over cleverness**: Prioritize clear, readable code over complex solutions. Optimize only when needed.
- **Start minimal and iterate**: Build the smallest working solution first, then enhance based on real requirements.
- **Optimize for the next developer**: Write code that's easy for others to maintain and understand.
- **Descriptive naming**: Use clear variable, function, and class names that express intent.
- **Small, focused functions**: Each function should do one thing well; minimize nesting with early returns and guard clauses.
- **Comment "why" not "what"**: Code should be self-documenting for what it does; use comments to explain reasoning or non-obvious logic.
- **DRY, but not prematurely**: Extract common patterns after seeing repetition (3+ times), but avoid over-abstraction.
- **YAGNI (You Aren't Gonna Need It)**: Don't build features for hypothetical future needs.
- **Prefer composition over inheritance**: Build functionality by combining simple pieces.
- **Avoid premature optimization and over-engineering**: Make it work first, then measure and optimize bottlenecks.

### Quality Checklist
- Can a new team member understand this code in 5 minutes?
- Are names self-explanatory?
- Is the happy path clear and error handling robust?
- Is there unnecessary complexity or cleverness?
- Does it solve the actual problem without extra features?

### Red Flags
- Functions longer than 20-30 lines

## Testing
- **Vitest + Testing Library**: Specs in `tests/ui` (UI) and `tests/data` (persistence).
- **Accessibility**: Use `@testing-library/jest-dom` queries. Cover keyboard shortcuts.
- **Offline**: Add regression tests for `sw.js` and import/export logic.

## Commit & PRs
- **Conventional Commits**: Use `feat:`, `fix:`, etc. Reference issues (e.g., `Fixes #123`).
- **PRs**: Explain motivation, solution, and tests. Link spec updates. Include before/after screenshots for UI changes.
- **Rebase**: Rebase before review. Wait for green lint/test/build status.

## PWA & Privacy
- **Client-side only**: No network-only dependencies or persistent cookies.
- **Manifest & Icons**: Update `manifest.json`, icons, and caching rules together. Verify with `pnpm export`.
- **Data**: All user data stays local. Export/import via JSON.

## References
- See `CLAUDE.md` for product scope, architecture, and development guidance.
- See `coding-standards.md` for contribution standards.

---

If any section is unclear or missing, please provide feedback to improve these instructions.