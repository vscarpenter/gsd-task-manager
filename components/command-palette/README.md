# Command palette

## Overview

This directory has four client components that render a `cmdk` command dialog.
They are the palette shell, an action group, an action row with shortcut keys, and a task row.
Open state, search, filtering, and execution come from `useCommandPalette` in `@/lib/use-command-palette`.

## Interface

- `CommandPalette` (`index.tsx`): renders the `Command.Dialog`. Props are `handlers: CommandActionHandlers`, `conditions: { isSyncEnabled: boolean }`, optional `onSelectTask(taskId, saved?)`, and optional `showSmartViews` (default `true`).
- `CommandGroup` (`command-group.tsx`): renders a headed `Command.Group` of `CommandActionItem`s. Props are `heading: string`, `actions: CommandAction[]`, and `onExecute(action)`.
- `CommandActionItem` (`command-item.tsx`): renders one `Command.Item` for a `CommandAction`, with a label and an optional shortcut. Props are `action` and `onSelect`.
- `ShortcutDisplay` (`command-item.tsx`): renders each string in `keys: string[]` as a `<kbd>`. It is hidden on coarse pointers.
- `TaskItem` (`task-item.tsx`): renders one `Command.Item` for a `TaskRecord`. It shows a check icon, title, description, a quadrant or "Saved" badge, and the first two tags. Props are `task` and `onSelect`.

## Invariants

- `command-group.tsx:CommandGroup`: returns `null` when `actions.length === 0`.
- `index.tsx:CommandPalette`: when `showSmartViews` is `false`, the effect returns early and the "Smart Views" group does not render.
- `index.tsx:CommandPalette`: keeps only smart views with `isBuiltIn` true (`views.filter((v) => v.isBuiltIn)`).
- `index.tsx:CommandPalette`: groups actions by `action.section`. It renders only `actions`, `navigation`, `views`, and `settings`, in that order, after Tasks.
- `index.tsx:CommandPalette`: the "Tasks" group renders only when `matchingTasks.length > 0`.
- `index.tsx:paletteTaskRecords`: the task source is `tasks.stored ?? tasks.all` from `useTasks()`.
- `command-item.tsx:CommandActionItem`: the cmdk `value` is `${action.label} ${action.keywords.join(" ")}`. The shortcut renders only when `action.shortcut` is truthy.
- `command-item.tsx:CommandActionItem`: a comment requires selection styling to match `data-[selected=true]`, because cmdk writes `data-selected="false"` on other rows.
- `task-item.tsx:TaskItem`: the cmdk `value` is `task-${task.id}-${task.title}-${task.description}`.
- `task-item.tsx:TaskItem`: the badge reads "Saved" with neutral styling when `task.savedAt` is truthy. Otherwise it shows the quadrant title with `quadrantStyles[task.quadrant]`.
- `task-item.tsx:TaskItem`: the quadrant label is the matching `quadrants` entry's `title`. It falls back to the raw `task.quadrant` id.
- `task-item.tsx:TaskItem`: shows at most two tags (`task.tags.slice(0, 2)`), each prefixed with `#`.

## Side Effects

- `index.tsx:CommandPalette`: an effect calls async `getSmartViews` from `@/lib/smart-views` and stores the result in state.
- `index.tsx:CommandPalette`: calls `useTasks` from `@/lib/use-tasks` for task data.
- `index.tsx:CommandPalette`: calls `useCommandPalette` from `@/lib/use-command-palette` for `open`, `setOpen`, `search`, `executeAction`, and `selectTask`. Any listeners or navigation live in that hook.
- `index.tsx:CommandPalette`: calls `buildCommandActions` from `@/lib/command-actions` on every render.
- `index.tsx:SearchInput`: the close button calls `onClose`, which the palette wires to `setOpen(false)`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
