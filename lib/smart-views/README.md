# Smart Views

## Overview

This package defines the smart view data model, the nine built-in views, and the icon registry for those views. It holds types and static data only.

## Interface

- `types.ts:FilterCriteria`. Interface for filter criteria: `quadrants`, `status`, `tags`, `dueDateRange`, `overdue`, `dueToday`, `dueThisWeek`, `noDueDate`, `recurrence`, `recentlyAdded`, `recentlyCompleted`, `readyToWork`, `searchQuery`, and the deprecated `dueDate`.
- `types.ts:SmartView`. Interface for a named, persisted filter: `id`, `name`, `description`, `icon`, `criteria`, `isBuiltIn`, `createdAt`, `updatedAt`.
- `built-in.ts:BUILT_IN_SMART_VIEWS`. Array of nine built-in views without `id`, `createdAt`, or `updatedAt`.
- `icons.ts:SMART_VIEW_ICONS`. Map from nine icon keys to Lucide icon components.
- `icons.ts:SmartViewIconKey`. Union type of the keys of `SMART_VIEW_ICONS`.

## Invariants

- `types.ts:FilterCriteria.dueDate` is deprecated. The code keeps it only for legacy persisted smart views.
- `built-in.ts:BUILT_IN_SMART_VIEWS` sets `isBuiltIn: true` on every entry, and each entry names an icon key from `icons.ts:SMART_VIEW_ICONS`.
- `icons.ts:SMART_VIEW_ICONS` consumers index the map directly and render the raw string when it is not a known key. Legacy custom icons keep working this way.
- `icons.ts:SMART_VIEW_ICONS` must be indexed inline, not through a resolver function. The `react-hooks/static-components` rule flags a component returned from a function.

## Side Effects

- None

## Verification

- Run: `bun run test`
