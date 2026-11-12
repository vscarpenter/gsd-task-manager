# About Page

## Overview
`page.tsx` exports static page metadata and renders six about sections inside `AppShell`.

## Interface
- `metadata` (`page.tsx`, named export): a Next.js `Metadata` object with the title, description, `openGraph`, and `twitter` fields.
- `AboutPage` (`page.tsx`, default export): renders `AppShell` from `@/components/matrix-simplified/app-shell` with the title "About".
- Sections, in order, from `@/components/about/`: `HeroSection`, `MatrixSection`, `FeaturesSection`, `PrivacySection`, `McpSection`, `FooterCta`.
- `FooterCta` receives `version` from `packageJson.version` (import of `@/package.json`).

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `bun run test`
