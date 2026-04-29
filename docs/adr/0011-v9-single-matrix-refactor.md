# 0011: v9 single-matrix UI refactor

**Date:** 2026-04-28
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

Through v8, the GSD UI surface had grown to include a 4-quadrant grid (`MatrixBoard` + `MatrixColumn`), a side filter panel (`FilterPanel`, `FilterPopover`, `FilterDueDate`, `FilterBar`), bulk multi-select (`BulkActionsBar`, `BulkTagDialog`), pinned smart-view chips with 1-9 keyboard shortcuts (`SmartViewPills`, `useSmartViewShortcuts`), a smart-view selector + save dialog, a modular task form (`components/task-form/` with subtasks/dependencies/tags inputs), a tag multiselect, an embedded user-guide accordion + wizard, a modal settings dialog, and a global ⌘K command palette. Each surface had its own tests and supporting hooks.

The v9 work, landed across commits `cc5c85e`, `912de38`, `616d90e`, `0296f94`, and follow-ups, replaced the central UX with a **single matrix shell** (`components/matrix-simplified/`) plus an inline **capture-bar** for new tasks and a slide-out **edit-drawer** for full task detail. Settings became a full page (`components/settings-page/`) instead of a modal. Help became a drawer (`help-drawer.tsx`) instead of an embedded user guide.

The v9 work shipped without removing the v8 surface area it replaced. By 2026-04-28, ~30 files in `components/` and `lib/` had no production importers — only tests still exercised them. CLAUDE.md still described several v8 features (command palette, bulk multi-select, smart-view 1-9 shortcuts) as if they were active.

## Decision

Adopt v9 as the single supported UI. Delete the v8 surface that was definitively replaced. Keep one v8 surface — the command palette — pending a future re-wire into the v9 shell.

**Deleted (no v9 replacement intended):**
- 4-quadrant filter UI: `filter-bar`, `filter-panel`, `filter-popover`, `filter-due-date`, `lib/matrix-filters.ts`
- Bulk multi-select: `bulk-actions-bar`, `bulk-tag-dialog`, `lib/bulk-operations.ts`
- Modular task form: `components/task-form/`, `task-form-{dependencies,subtasks,tags}.tsx`, `tag-autocomplete-input`, `tag-multiselect`
- Smart-view pinning UI: `smart-view-selector`, `save-smart-view-dialog`, `smart-view-pills`, `lib/use-smart-view-shortcuts.ts`
- Modal user-guide: `user-guide-dialog`, `components/user-guide/` (entire directory)
- Modal settings: `components/settings/settings-dialog.tsx`, top-level `components/settings-dialog.tsx` re-export
- Replaced empty/skeleton states: `matrix-empty-state`, `matrix-skeleton`
- Stale UX surface: `share-task-dialog` (whole dir), `keyboard-hints-toast`
- Orphan utilities: `lib/use-matrix-dialogs.ts`, `lib/db-helpers.ts`, `lib/pwa-detection.ts`, `lib/confetti.ts`
- Unused UI primitives: `components/ui/sheet.tsx`, `components/ui/slider.tsx`, `lib/z-index.ts`, `components/inline-task-form.tsx`, `components/notification-permission-prompt.tsx`
- Dependencies: `@radix-ui/react-slider`, `canvas-confetti`, `@types/canvas-confetti`

**Kept (v8 surface retained, not currently wired):**
- `components/command-palette/`, `lib/use-command-palette.ts`, `lib/command-actions.ts` — global ⌘K palette. Source compiles and is tested but is not mounted by the v9 shell. Resurrection (re-mounting it inside `matrix-simplified/app-shell.tsx`) is tracked in `tasks/todo.md`.

**Kept (still in active use, were misclassified as dead by an automated audit):**
- `task-timer.tsx` — used by `task-card-metadata.tsx`
- `snooze-dropdown.tsx` — used by `task-card-actions.tsx`
- `task-description.tsx` — used by `task-card-header.tsx`
- `reset-everything-dialog.tsx` — used by `settings/data-management.tsx`
- `import-dialog.tsx` — lazy-loaded by `settings-page/index.tsx`

## Consequences

**Easier:**
- Onboarding a new contributor: ~30 fewer files, one canonical UI path.
- CLAUDE.md/feature claims now match reality. No more "documented but not implemented" gap.
- Test runtime drops (~315 tests removed; test count went from 2088 → 1773).
- One moderate CVE cleared with the simultaneous `postcss` bump.

**Harder:**
- Re-introducing bulk multi-select, smart-view pinning, or filter UI now means a fresh design pass against the v9 shell, not a re-mount of v8 code.
- Anyone reading old PRs or commit messages may reference deleted files; git history still shows them.

**Out of scope:**
- Wiring the command palette back into the v9 shell. The files exist but nothing imports them; the `⌘K` keybinding is not registered. Tracked as a follow-up.
- Adding return types to all v9 components (deferred coding-standards work; was deferred until after this cleanup so as not to touch files about to be deleted).
- Replacing the `lucide-react` 1.7→1.12 jump (separate visual-test PR).

## Alternatives considered

1. **Feature-flag both surfaces.** Rejected — the v9 work has been live since `cc5c85e` and no rollback path is needed. A flag would add maintenance cost without value.
2. **Keep v8 code "for reference."** Rejected — that's what git history is for. Dead code in `main` invites accidental re-use, accumulates lint/audit noise, and inflates bundle size.
3. **Delete the command palette too.** Rejected for now — the `⌘K` shortcut is a frequently-cited feature in user-facing docs and the source is tested; preserving it cheaply keeps the resurrection option open.
