# Sync History Page

## Overview
`page.tsx` is the client page for the sync history route. It shows the 50 most recent sync records in a virtualized list inside `AppShell`. A four-tile stats header sits above the list, and a Clear History button sits in the top bar.

## Interface
- `SyncHistoryPage` (`page.tsx`, default export): the only export. It renders `AppShell` from `@/components/matrix-simplified/app-shell` with the title "Sync history".
- Data calls, all from `@/lib/sync-history`: `getRecentHistory`, `getHistoryStats`, `clearHistory`.
- Private components `SyncHistoryStats` and `SyncHistoryRow` render the stat tiles and one `SyncHistoryRecord` (type from `@/lib/types`).
- `getStatusIcon` and `getStatusColor` handle four record statuses: `success`, `error`, `conflict`, `partial`.
- Query state uses `@tanstack/react-query` under `HISTORY_KEY` (`["syncHistory"]`) and `STATS_KEY` (`["syncHistoryStats"]`).

## Invariants
- `clearHistory` runs only from the "Clear" action of a confirmation toast (`handleClearHistory`). A comment says the toast replaces `window.confirm` to stay non-blocking.
- The page fetches at most 50 records (`getRecentHistory(50)` in `SyncHistoryPage`).
- The Clear History button renders only when `history.length > 0` (`topbarRightSlot`).
- The stats block renders only when `stats` exists and `history.length > 0`.
- `SyncHistoryRow` labels a record "Manual" when `triggeredBy === "user"`, and "Auto" otherwise.

## Side Effects
- Reads through `getRecentHistory(50)` and `getHistoryStats` (the two `useQuery` calls).
- Deletes all history through `clearHistory` (`clearMutation`).
- Invalidates `["syncHistory"]` and `["syncHistoryStats"]` after a successful clear.
- Shows `sonner` toasts: the confirmation, a success message, and an error message.
- Calls `router.push("/")` from the empty-state "Open matrix" button.

## Verification
- Run: `bun run test`
