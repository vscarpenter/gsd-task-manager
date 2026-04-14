# 0009: Smart Views System

**Date:** 2026-04-14
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

Users frequently apply the same complex filter combinations — e.g., "high-priority tasks tagged 'work' due this week" — but rebuilding filters from scratch each time is friction-heavy. A mechanism to save, recall, and quickly switch between filter presets was needed. The feature must be consistent with the keyboard-first, local-first design philosophy of the app.

## Decision

Implement Smart Views as named filter configurations persisted in the `smartViews` IndexedDB table (schema v13). Each Smart View stores a filter predicate (quadrant, urgency, importance, tags, due date range, completion status, search text) and display metadata (name, icon, color). Up to 5 Smart Views can be pinned to the app header as pill shortcuts, accessible via keyboard shortcuts **1–9** (by pin order) with **0** to clear the active view. The `useSmartViewShortcuts` hook intercepts keydown events but suppresses shortcuts while the user is typing in an input or textarea. A set of built-in Smart Views (e.g., "Due Today", "Overdue", "No Due Date") are defined in `lib/smart-views/` as constants and are always available without requiring a database entry.

## Consequences

### Easier
- Pinned views with numeric shortcuts make filter switching as fast as pressing a single key.
- Storing views in IndexedDB means they persist across sessions and are included in JSON exports/imports.
- Built-in views provide immediate value for new users with zero configuration.
- The 5-pin limit keeps the header uncluttered and shortcut keys memorable.
- Smart Views compose with the existing filter system — they are filter presets, not a parallel system.

### Harder
- The 5-pin limit may frustrate power users with many saved views; the rest are accessible only through the Smart View selector, not header shortcuts.
- Keyboard shortcuts (1–9) conflict with number input in text fields — the typing-detection suppression logic in `useSmartViewShortcuts` must be maintained as new input types are added.
- Smart Views are local-only by default; they are not synced to PocketBase (only tasks are synced), so saved views differ across devices.
- Built-in view definitions in `lib/smart-views/` must be manually kept in sync with the filter schema as new filter fields are added.

## Alternatives Considered

- **URL query parameters / bookmarks**: Encodes filters in the URL, making them shareable and browser-bookmark-friendly. Rejected — the app is a single-page PWA where URL state adds complexity without clear benefit for a local-first, single-user tool. URL params would also conflict with the static export architecture.
- **Browser bookmarks**: No implementation required, but no keyboard shortcuts, no UI integration, and no portability in exports. Rejected as insufficient UX.
- **Server-saved presets (PocketBase)**: Would sync views across devices automatically. Rejected at this stage — views are personal UI preferences, not task data, and adding a second synced collection increases PocketBase schema complexity. Can be revisited.
- **Tag-based pseudo-views**: Using tags as a filter proxy. Rejected — tags are task metadata; conflating them with display preferences would pollute the tag namespace and make tasks harder to manage.
