# Saved

## Overview

This directory has the Saved page. It lists saved tasks from `useTasks().saved` and has a search field.
It also has a per-item component, an inline editor form for notes and returns, and two hooks.
The hooks wrap task mutations with toasts and hold the editor state.

## Interface

- `SavedPage` (`saved-page.tsx`, default export): page inside `AppShell title="Saved"`. It filters `useTasks().saved` with `filterTasks(saved, query)` and renders `SavedItem` rows or an empty or loading state.
- `SavedItem` (`saved-item.tsx`): `<li>` component that takes `SavedItemProps`. It shows title, description, tags, and the Edit notes, Return to matrix, and Delete buttons.
- `SavedItemProps` (`saved-item.tsx`): interface `{ task; onNotes(task, notes): Promise<boolean>; onReturn(task, quadrant, dueDate?): Promise<boolean>; onDelete(task): Promise<void> }`.
- `SavedItemEditor` (`saved-item-editor.tsx`): form component with props `{ task: TaskRecord; editor: ReturnType<typeof useSavedItem> }`. `editor.mode` selects a notes textarea or a quadrant select with a due date input.
- `useSavedActions` (`use-saved-actions.ts`): `(searchRef: RefObject<HTMLInputElement | null>) => { saveNotes, returnItem, removeItem }`. It wraps the module actions and refocuses the search input on success.
- `returnItem` (`use-saved-actions.ts`): `(task, quadrant, dueDate?) => Promise<boolean>`. It calls `returnSavedTask`, shows a toast with Undo, and returns `false` on failure.
- `useSavedItem` (`use-saved-item.ts`): takes `SavedItemProps` fields `{ task, onNotes, onReturn }`. It returns `{ mode, busy, setBusy, notes, setNotes, quadrant, setQuadrant, dueDate, setDueDate, open, close, submit }`.

## Invariants

- `saved-item-editor.tsx:NotesField`: the textarea `maxLength` is `SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH`. The counter shows `notes.length` against the same limit.
- `saved-item-editor.tsx:SavedItemEditor`: the submit button, the Cancel button, and the inputs are disabled while `editor.busy`.
- `saved-item.tsx:SavedItemActions`: all three action buttons are disabled while `editor.busy`. Delete sets busy to true and clears it in `finally`.
- `use-saved-item.ts:open`: opening any mode resets `notes`, `quadrant`, and `dueDate` from the current task before it sets the mode.
- `use-saved-item.ts:submit`: passes `notes.trim()`. The editor closes only when the callback resolves `true`. `finally` clears `busy`.
- `use-saved-item.ts:reviewedDueDate`: an unchanged date returns `task.dueDate` as is. A new date goes through `onDate(task.dueDate, date)`. An empty date returns `undefined`.
- `use-saved-item.ts:formDay`: the date input uses `localDayOf(task.dueDate)`. A comment states that slicing the ISO string gave the UTC day.
- `use-saved-actions.ts:saveNotes`, `returnItem`, `removeItem`: each catches its error, shows `toast.error`, and resolves `false`. None of them throws.
- `use-saved-actions.ts:useSavedActions`: refocuses the search input only when the return or delete succeeded.

## Side Effects

- `use-saved-actions.ts:saveNotes`: calls `updateTask(task.id, { description: notes })` from `@/lib/tasks`. It shows `toast.success("Notes saved")` or an error toast.
- `use-saved-actions.ts:returnItem`: calls `returnSavedTask(task.id, quadrant, dueDate)` from `@/lib/tasks/saved`. The success toast has an Undo action that calls `saveTaskForLater(task.id)`.
- `use-saved-actions.ts:removeItem`: calls `deleteTask(task.id)` from `@/lib/tasks`. The "Item moved to Trash" toast has an Undo action that calls `restoreTask(task)`.
- `use-saved-actions.ts:useSavedActions`: calls `searchRef.current?.focus()` after a successful return or delete.
- `saved-item-editor.tsx:NotesField`: focuses the notes textarea on mount.
- `saved-item-editor.tsx:ReturnFields`: focuses the quadrant select on mount.
- `saved-item.tsx:SavedItem`: focuses the Edit notes button when `editor.mode` returns to `"read"`.
- `saved-page.tsx:SavedPage`: reads tasks with `useTasks()` from `@/lib/use-tasks`. The empty state renders a `next/link` to `"/"`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
