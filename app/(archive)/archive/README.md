# Archive Page

## Overview
`page.tsx` is the client page for the archive route. It lists archived tasks, newest first, in a virtualized grid inside `AppShell`. Each card has Restore and Delete buttons, and each action shows a toast with Undo.

## Interface
- `ArchivePage` (`page.tsx`, default export): the only export. It renders `AppShell` from `@/components/matrix-simplified/app-shell` with the title "Archive".
- Data calls, all from `@/lib/archive`: `listArchivedTasks`, `restoreTask`, `deleteArchivedTask`, `archiveTaskNow`, `reinstateArchivedTask`.
- Cards render `TaskCard` from `@/components/task-card` through the private `ArchivedTaskCard` component.
- Query state uses `useQuery` and `useMutation` from `@tanstack/react-query` under the key `ARCHIVED_TASKS_KEY` (`["archivedTasks"]`).
- Rows are virtualized by `useVirtualizer` from `@tanstack/react-virtual`.

## Invariants
- Archived cards are read-only. `ArchivedTaskCard` passes no-op `onEdit`, `onDelete`, and `onToggleComplete` handlers to `TaskCard`.
- Undo of a restore must call `archiveTaskNow`. A comment in `restoreMutation` says it re-archives and queues the remote delete in one transaction.
- Undo of a delete must call `reinstateArchivedTask`. A comment in `deleteMutation` says it is idempotent, so a second click is a no-op.
- Delete has no confirmation step. The Undo toast in `deleteMutation` is the only recovery path in this file.
- Both Undo handlers catch errors and report them with `toast.error`.
- `useColumnCount` returns 1 when `window` is undefined, 2 from 768px, and 3 from 1024px.
- The list keeps a screen-reader `<h2>` above the cards, because `TaskCard` titles are `<h3>` (comment in `ArchivePage`).

## Side Effects
- Reads archived tasks through `listArchivedTasks` (the `useQuery` `queryFn`).
- Writes through `restoreTask`, `deleteArchivedTask`, `archiveTaskNow`, and `reinstateArchivedTask`.
- Invalidates `["archivedTasks"]` after each restore, delete, and successful undo (`queryClient.invalidateQueries`).
- Shows `sonner` toasts for success, undo, and failure.
- Calls `router.push("/")` from the empty-state "Open matrix" button.

## Verification
- Run: `bun run test`
