# UX Review Improvements — Implementation Plan

**Review Date:** 2026-04-01
**Source:** External UX review of gsd.vinny.dev
**Approach:** Phased — quick wins first, then medium-effort enhancements

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

## Phase 1 — Quick Wins

### 1.1: Simplify empty state with progressive disclosure
- **File:** `components/matrix-empty-state.tsx`
- **Change:** Condense to headline + 1 sentence + primary CTA at top. Move quadrant education into collapsible "Learn how it works" section. Add 3-5 example task templates.
- **Rationale:** Reduce blank-page anxiety, get users acting immediately

### 1.2: Add `destructive` button variant
- **File:** `components/ui/button.tsx`
- **Change:** Add 4th variant: red background, white text, red shadow
- **Follow-up:** Replace ad-hoc red styling on delete buttons across the app
- **Rationale:** Consistent visual language for destructive actions

### 1.3: Fix "Search..." ellipsis to "Search"
- **File:** `components/app-header.tsx`
- **Change:** Remove trailing ellipsis from search button label
- **Rationale:** Ellipsis implies pending dialog; this is a direct action

### 1.4: Add keyboard shortcut hints to header tooltips
- **File:** `components/app-header.tsx`
- **Change:** Add shortcut hints to existing tooltips (n for New Task, / for Search, ⌘K for command palette)
- **Rationale:** Contextual shortcut education at point of use

### 1.5: Contrast audit on muted text and quadrant backgrounds
- **Files:** `app/globals.css`, quadrant-related components
- **Change:** Verify WCAG AA compliance (4.5:1 for normal text, 3:1 for large text); fix any failures
- **Rationale:** Accessibility baseline

---

## Phase 2 — Medium Effort, High Payoff

### 2.1: Improve navigation hierarchy (separate Views from Actions)
- **File:** `components/app-header.tsx`
- **Change:** Group Matrix|Dashboard as view tabs with active indicator; keep New Task as primary CTA; Search/Filter as secondary
- **Rationale:** Reduces cognitive load, supports recognition over recall

### 2.2: Audit undo coverage for all destructive actions
- **Files:** `app/(archive)/archive/page.tsx`, `components/smart-view-selector.tsx`, `components/sync-debug-panel.tsx`
- **Change:** Replace `confirm()` dialogs with post-action undo toasts where appropriate
- **Rationale:** Modern pattern, better user control and freedom

### 2.3: Increase touch targets on small interactive elements
- **Files:** `components/task-card.tsx`, various UI components
- **Change:** Ensure minimum 44×44px tap area on all interactive elements
- **Rationale:** Material accessibility guidance, mobile usability

### 2.4: Add "Saved locally" indicator for non-sync users
- **File:** `components/app-header.tsx`
- **Change:** Show subtle "All changes saved locally" when sync is disabled
- **Rationale:** Trust-building for privacy-first positioning

---

## Phase 3 — Polish

### 3.1: Typography tightening (max-width on prose, consistent scale)
### 3.2: Card consistency audit across Matrix, Dashboard, Archive views
### 3.3: Smart View language clarification (tooltip explaining "saved filter combinations")

---

## Resuming From Here

**Status:** Starting Phase 1 implementation
**Branch:** Will create `feat/ux-review-improvements`
**Next:** Implement items 1.1 through 1.5
