# Spec — Command Palette v9 Rewire

**Date:** 2026-05-24
**Status:** Proposed → implementing
**Author:** Vinny (with Claude)

## Goal

Re-mount the existing `CommandPalette` component (currently dead code under `components/command-palette/`) so that ⌘K (Mac) / Ctrl+K (others) opens it from any page in the v9 shell.

## Inputs / Outputs

**Input:** keyboard event ⌘K/Ctrl+K from anywhere in the app, or click on a topbar ⌘K hint surface.

**Output:**
- Palette dialog opens, focused on its search input.
- Selecting an action runs the matching handler (navigate, toggle theme, open settings, etc.).
- Selecting a task closes the palette and highlights the task in the matrix.
- Escape closes the palette without side effects.

## Constraints

- **No new smart-view UI.** v9 (ADR 0011) deliberately removed smart-view surface; the palette must not advertise smart-view actions in this PR.
- **No global selection mode.** v9 removed bulk multi-select; selection actions must not appear.
- Must mount inside `AppShell` so ⌘K works on matrix, dashboard, archive, settings, and sync-history routes.
- Handlers that need matrix-page state (new task) dispatch window CustomEvents; matrix page subscribes. Pages without matrix can use existing URL-driven `?action=new-task` flow.
- Theme toggle uses `next-themes` (already a dependency).
- Export/Import reuse existing `lib/tasks/import-export.ts`.

## Edge Cases

- Palette mounted on settings page (no matrix). "Create new task" must route to `/?action=new-task` (matrix already handles this via `useEffect` URL parsing).
- Theme toggle when system theme is set: cycle to explicit light/dark.
- Cmd+K pressed while a text input has focus inside a non-matrix page: still opens (palette's hook listens on `document`).
- Existing matrix `/` keybinding: must not conflict (it isn't — `/` runs only when no modifier keys are held).

## Out of Scope

- Resurrecting smart-view UI (separate effort, see todo.md item #1 callout).
- Resurrecting bulk selection mode.
- New action types (already-rich set in `lib/command-actions.ts` is enough).
- Touching `command-actions.ts` action set (just wire handlers).
- A topbar ⌘K hint chip (could be a follow-up; not required for "feature exists").

## Acceptance Criteria

1. **AC1** — Pressing ⌘K/Ctrl+K anywhere inside an `AppShell`-wrapped page opens the palette (covered by new unit test on `AppShell`).
2. **AC2** — `AppShell` no longer requires page-level palette mount; only one palette instance is mounted (no duplication).
3. **AC3** — Selecting "Toggle theme" calls `next-themes` `setTheme` with the opposite theme.
4. **AC4** — Selecting "Open settings" navigates to `/settings` via the Next router.
5. **AC5** — Selecting "Create new task" on the matrix page opens the create drawer; on other pages, navigates to `/?action=new-task`.
6. **AC6** — Smart-view actions do NOT appear in the palette (per v9 design).
7. **AC7** — Existing `tests/ui/command-palette.test.tsx` continues to pass without changes (component contract preserved via additive prop).
8. **AC8** — `bun typecheck` and `bun lint` pass; PR diff stays focused (shell + small component edit + tests, no broad refactor).

## Test Stubs

- `tests/ui/app-shell.test.tsx`
  - `it('opens the command palette when Cmd+K is pressed')`
  - `it('opens the command palette when Ctrl+K is pressed')`
  - `it('does not render smart-view actions')`
  - `it('navigates to /settings when Open settings is executed')`
- Extend `tests/ui/command-palette.test.tsx`
  - `it('hides the smart-views section when showSmartViews is false')`

## Implementation Plan

1. **Add `showSmartViews?: boolean` prop to `CommandPalette`** (default `true` to preserve test behavior). When `false`, skip the `getSmartViews` effect and don't render the Smart Views command group.
2. **Build `useShellCommandHandlers` hook** at `lib/use-shell-command-handlers.ts`. Returns `CommandActionHandlers` + `conditions` with realistic implementations using router/theme/events.
3. **Mount `<CommandPalette showSmartViews={false} ...>` in `AppShell`.**
4. **Add `gsd:new-task` window event listener to `components/matrix-simplified/index.tsx`** that opens the create drawer.
5. **Tests:** new `tests/ui/app-shell.test.tsx`, extend `tests/ui/command-palette.test.tsx`.

## Anti-Goals

- Do NOT modify `command-actions.ts`.
- Do NOT introduce a new state-management library.
- Do NOT delete the existing `command-palette/` source.
- Do NOT add a topbar ⌘K hint chip in this PR (defer).
