# Settings Page

## Overview
`page.tsx` is a client page that only renders one component, `SettingsPage` from `@/components/settings-page`, inside `AppShell`.

## Interface
- `Page` (`page.tsx`, default export): renders `AppShell` from `@/components/matrix-simplified/app-shell` with the title "Settings".
- It passes `ThemeToggle` from `@/components/theme-toggle` as `topbarRightSlot`.

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `bun run test`
