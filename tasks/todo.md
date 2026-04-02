# UX Review Improvements — Implementation Plan

**Review Date:** 2026-04-01
**Source:** External UX review of gsd.vinny.dev
**Status:** Phase 1-3 complete

---

## Pre-Implementation Notes

### Already Implemented (reviewer missed — discoverability signal)
- Active filter chips with "Clear all" (`filter-bar.tsx`)
- Command palette with ⌘K (`command-palette/index.tsx`)
- Sync status indicator in header (`app-header.tsx`)
- Quadrant identity with tinted backgrounds, gradient bars, icons
- Undo toast for task deletion (`useErrorHandlerWithUndo`)
- Drag-and-drop task movement

### Key Insight
Several features exist but weren't found by the reviewer — this is itself a UX problem worth addressing through better discoverability.

---

## Phase 1 — Quick Wins ✅

- [x] 1.1: Simplify empty state with progressive disclosure
- [x] 1.2: Add `destructive` button variant + migrate 4 components
- [x] 1.3: Fix "Search..." ellipsis to "Search"
- [x] 1.4: Add keyboard shortcut hints to header tooltips
- [x] 1.5: WCAG AA contrast fix on accent color (#6366f1 → #5b5ee6)

## Phase 2 — Medium Effort ✅

- [x] 2.1: Improve navigation hierarchy (views vs actions grouping, Help demoted to ghost)
- [x] 2.2: Undo coverage audit (archive delete, smart view delete now use undo toasts)
- [x] 2.3: Touch targets increased to 44px minimum on mobile (task card action buttons, checkbox, drag handle)
- [x] 2.4: "Saved locally" indicator for non-sync users (shield icon + tooltip)

## Phase 3 — Polish ✅

- [x] 3.1: Typography audit — already well-constrained, no changes needed
- [x] 3.2: Card consistency audit — Matrix + Archive both use TaskCard, Dashboard intentionally different
- [x] 3.3: Smart View language clarification (info tooltip explaining "saved filter combinations")
