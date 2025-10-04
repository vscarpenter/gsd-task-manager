# Repository Guidelines
Follow these standards to keep contributions consistent with the GSD Task Manager vision.

## Project Structure & Module Organization
- `app/` - Next.js App Router routes; matrix views live in `app/(matrix)/`, PWA entry in `app/(pwa)/install`.
- `components/` - shared client modules; mirror shadcn/ui layout (`components/ui/button.tsx`, etc.) for easy upgrades.
- `lib/` - Dexie stores, zod schemas, and shortcut helpers (`lib/db.ts`, `lib/tasks.ts`).
- `tests/` - Vitest suites; keep UI specs in `tests/ui` and persistence logic in `tests/data`.
- `public/` - runtime static assets (`manifest.json`, `sw.js`, icons). Design references remain in `assets/`.
- `gsd-task-manager-spec.md` records product scope; revise it whenever behavior changes.

## Build, Test, and Development Commands
- `pnpm install` - install dependencies and commit the resulting `pnpm-lock.yaml`.
- `pnpm dev` - start the local server on port 3000.
- `pnpm lint` - run ESLint + TypeScript checks; resolve violations before pushing.
- `pnpm test` - execute Vitest in CI mode; append `-- --watch` during local iteration.
- `pnpm build` - produce the production build and surface type errors.
- `pnpm export` - generate the static bundle for S3/CloudFront deployment.

## Coding Style & Naming Conventions
- TypeScript strict mode, 2-space indentation, and arrow-style React components.
- `PascalCase` for components/hooks, `camelCase` utilities, `kebab-case` files and folders.
- Tailwind classes grouped by layout -> spacing -> color; shared styles stay in `app/globals.css`.
- Run Prettier + ESLint autofix before commits; avoid manual formatting overrides.

## Testing Guidelines
- Write Vitest + Testing Library specs named `*.test.ts(x)`; use snapshots only for stable UI.
- Maintain >=80% statement coverage (`pnpm test -- --coverage`), including Dexie persistence paths.
- Assert accessibility with `@testing-library/jest-dom` queries and cover keyboard shortcuts.
- Add offline regressions whenever `sw.js` or JSON import/export logic changes.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, etc.) and reference issues with `Fixes #123`.
- PR descriptions must explain motivation, solution, and tests; link any spec updates.
- Include before/after screenshots for UI tweaks that touch quadrant layout.
- Rebase before requesting review and wait for green lint/test/build status.

## PWA & Offline Notes
- Keep the app client-side only; avoid network-only dependencies and persistent cookies.
- Update `manifest.json`, icons, and caching rules together, verifying the `pnpm export` output.
- Refresh export/import fixtures whenever the task schema evolves.
