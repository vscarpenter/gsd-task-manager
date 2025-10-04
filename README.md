# GSD Task Manager

GSD Task Manager is a privacy-first Eisenhower matrix built with Next.js App Router, TypeScript, Tailwind CSS, Dexie, and shadcn-inspired components. All task data lives in the browser via IndexedDB and can be exported or imported as JSON.

## Getting Started

```bash
pnpm install
pnpm dev
```

The development server runs at `http://localhost:3000`. Use the keyboard shortcuts `n`, `/`, and `?` for quick task creation, search, and help.

## Available Scripts

- `pnpm dev` - start the Next.js development server with App Router
- `pnpm lint` - run ESLint with the Next.js config
- `pnpm test` - execute Vitest in CI mode using the `jsdom` environment
- `pnpm build` - build the production bundle
- `pnpm export` - static export for S3/CloudFront deployments

## Testing

Vitest is configured with Testing Library helpers. Example suites live in `tests/` and target utility logic and soon UI behavior. Aim for at least 80% statement coverage using `pnpm test -- --coverage` before shipping changes.

## PWA

The app registers a service worker (`public/sw.js`) and ships a manifest (`public/manifest.json`) so it can be installed on desktop and mobile. Visit `/install` for platform-specific installation guidance.

## Data Storage

Tasks persist via Dexie-managed IndexedDB tables (`lib/db.ts`). Use the export/import controls in the header to back up or restore task data. Schema validation is handled with `zod` in `lib/schema.ts`.
