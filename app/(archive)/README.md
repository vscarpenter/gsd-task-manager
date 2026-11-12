# Archive Route Group

## Overview
`layout.tsx` wraps the routes in this group in `QueryProvider`. The group has one route, the archive page.

## Interface
- `ArchiveLayout` (`layout.tsx`, default export): takes `children` and returns `<QueryProvider>{children}</QueryProvider>`. `QueryProvider` comes from `@/components/query-provider`.
- Archive page: [archive/README.md](./archive/README.md)

## Invariants
- The react-query provider lives in this layout, not the root layout. A comment in `layout.tsx` says this keeps react-query out of the chunks every route downloads.

## Side Effects
- None

## Verification
- Run: `bun run test`
