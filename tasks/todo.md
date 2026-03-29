# Coding Standards Compliance — Remediation Plan

**Audit Date:** 2026-03-28
**Audited Against:** `coding-standards.md` v10.0
**Overall Score:** ~85/100 -> ~93/100 after remediation
**Remediation Status:** P1-P4 complete (2026-03-28)

---

## Executive Summary

7 parallel audits covered: file size/function length, type safety, testing, security/error handling, naming/DRY/patterns, accessibility/performance, and logging/config/dependencies.

**Strengths (no action needed):**
- Security: A+ — Zod validation everywhere, typed errors, secret sanitization in logger, no hardcoded secrets
- Error handling: Excellent — typed error hierarchy (`SyncError`, `SyncNetworkError`, etc.), structured error categorizer
- Logging: 100/100 — structured JSON logger with context, secret redaction, correlation IDs
- Type safety: strict mode enabled, all `any` usages properly documented with comments
- Test naming: 9/10 — behavior-based `should_*` pattern used consistently
- File naming: All kebab-case, no violations
- No TODOs without tickets, no commented-out code, no unused imports

---

## Priority 1 — Critical (Architecture / DRY violations)

### P1.1: Split oversized `MatrixBoard` component (323-line function)
- **File:** `components/matrix-board/index.tsx`
- **Violation:** Single component function is 323 lines (standard: <=30 lines per function)
- **Fix:** Extract into smaller components:
  - `MatrixGrid` — the 4-column grid layout
  - `MatrixDialogs` — the dialog rendering block (~51 lines)
  - Move remaining state into existing `use-task-operations.ts` hook
- **Standard:** Functions <=30 lines, max 3 nesting levels

### P1.2: Refactor `pb-sync-engine.ts` oversized functions
- **File:** `lib/sync/pb-sync-engine.ts` (394 lines, 3 functions >70 lines each)
- **Violations:**
  - `pushLocalChanges()` — 78 lines, 4+ nesting levels
  - `pullRemoteChanges()` — 80 lines, 4+ nesting levels
  - `fullSync()` — 74 lines, 5+ nesting levels
- **Fix:** Extract helpers: `pushSingleTask()`, `applyRemoteDeletions()`, `applyRemoteUpserts()`, `resolveConflict()`
- **Standard:** Functions <=30 lines, max 3 nesting levels

### P1.3: Eliminate duplicate analytics modules (lib vs MCP server)
- **Files:**
  - `lib/analytics/metrics.ts` vs `packages/mcp-server/src/analytics/metrics.ts`
  - `lib/analytics/streaks.ts` vs `packages/mcp-server/src/analytics/streaks.ts`
- **Violation:** Nearly identical implementations in two locations (DRY: extract after 3+ repetitions)
- **Fix:** Create `packages/shared-analytics/` or export from lib for MCP server consumption
- **Standard:** Apply DRY after 3+ repetitions; no magic numbers

### P1.4: Centralize time calculation constants
- **Files:** 5+ files using inline `(1000 * 60 * 60 * 24)` instead of `TIME_MS.DAY`
  - `components/dashboard/upcoming-deadlines.tsx:145`
  - `components/install-pwa-prompt.tsx:47`
  - `packages/mcp-server/src/analytics/streaks.ts:114`
  - `lib/analytics/streaks.ts:123`
- **Fix:** Replace all with `TIME_MS.DAY` from `lib/constants.ts` (already exists but unused)
- **Standard:** No magic numbers; use named constants

---

## Priority 2 — Important (Testing & Coverage gaps)

### P2.1: Add tests for `lib/logger.ts` (core infrastructure, 0% coverage)
- **File:** `lib/logger.ts` (~250 lines)
- **Violation:** Core infrastructure module with zero test coverage
- **Fix:** Test structured output, log levels, secret sanitization, context prefixing, child loggers
- **Standard:** Test all public APIs and critical paths (~80% coverage)

### P2.2: Add tests for untested hooks
- **Files missing tests:**
  - `lib/use-command-palette.ts`
  - `lib/use-quick-settings.ts`
  - `lib/use-smart-view-shortcuts.ts`
  - `lib/use-tasks.ts` (main data hook)
- **Standard:** Test all public APIs and critical paths

### P2.3: Consolidate copy-pasted test fixtures
- **Files with inline fixture objects (should use factory from `tests/fixtures/index.ts`):**
  - `tests/ui/dashboard-components.test.tsx` — full TaskRecord[] copy-paste
  - `tests/ui/matrix-column.test.tsx` — full TaskRecord[] copy-paste
  - `tests/data/filters.test.ts` — 100+ lines of inline fixtures
  - `tests/sync/pb-sync-engine.test.ts` — partial copy-paste
- **Fix:** Replace with `createMockTask()` / `createMockTasks()` from `tests/fixtures/index.ts`
- **Standard:** Use factory functions for test data; never copy-paste fixtures

### P2.4: Add tests for settings components
- **Files:** 6+ settings components in `components/settings/` with zero test coverage
- **Standard:** Target ~80% coverage

---

## Priority 3 — Medium (Accessibility & Performance)

### P3.1: Add `aria-pressed` to filter toggle buttons
- **File:** `components/filter-panel.tsx` (lines 99-110, 120-131, 141-151, 162-191)
- **Violation:** Toggle buttons lack `aria-pressed` attribute for state indication
- **Fix:** Add `aria-pressed={isSelected}` to all filter toggle buttons
- **Standard:** Every interactive element must be keyboard-accessible

### P3.2: Add `aria-label` to filter buttons
- **Files:**
  - `components/filter-panel.tsx` — quadrant/status/tag/due-date filter buttons
  - `components/filter-bar.tsx` (lines 98-105)
- **Fix:** Add descriptive `aria-label` attributes
- **Standard:** Accessible labeling for all interactive elements

### P3.3: Fix color-only status indicators
- **Files:**
  - `components/dashboard/streak-indicator.tsx:67-73` — activity dots use color only
  - `components/filter-panel.tsx:108` — quadrant color dots
- **Fix:** Add `aria-label` describing state; consider adding a subtle icon or pattern
- **Standard:** Color alone must not convey meaning

### P3.4: Fix O(n^2) lookups in components
- **File:** `components/task-form-dependencies.tsx:63-66`
  - `.find()` inside `.map()` — build a `Map` for O(1) lookup instead
- **File:** `components/dashboard/upcoming-deadlines.tsx:104-105`
  - `.find()` for quadrant lookup inside render — pre-build a Map
- **Standard:** Avoid O(n^2) when O(n) is straightforward

---

## Priority 4 — Low (Code Quality Polish)

### P4.1: Add 3 missing return type annotations
- **Files:**
  - `lib/sync/config/get-set.ts:83` — `getSyncStatus()` missing return type
  - `lib/smart-views.ts:115` — `getAppPreferences()` missing return type
  - `lib/smart-views.ts:134` — `updateAppPreferences()` missing return type
- **Standard:** Type annotations on all function signatures

### P4.2: Rename generic variables
- **Files with generic names like `data`, `result`, `item`:**
  - `lib/analytics/time-tracking.ts:135` — `data` -> `quadrantMetrics`
  - `lib/analytics/streaks.ts:108` — `result` -> `completionDays`
  - `lib/sync/pb-sync-engine.ts:103,111` — `data` -> `pbTaskRecord`
  - `lib/filters.ts:185` — `result` -> `filteredTasks`
  - `components/dashboard/quadrant-distribution.tsx:22` — `data` -> `quadrantStats`
- **Standard:** Use descriptive names; avoid generic terms

### P4.3: Pin floating dependency versions in overrides
- **File:** `package.json` lines 89-90
  - `"baseline-browser-mapping": "^2.9.11"` -> `"2.9.11"`
  - `"vite": "^7.3.0"` -> `"7.3.0"`
- **Standard:** Pin dependency versions in lockfiles

### P4.4: Centralize sync timing constants
- **Files with local constant definitions that belong in `lib/constants/sync.ts`:**
  - `lib/sync/health-monitor.ts:15-16` — `HEALTH_CHECK_INTERVAL_MS`, `STALE_OPERATION_THRESHOLD_MS`
  - `lib/sync/retry-manager.ts:13` — `RETRY_DELAYS` array
- **Standard:** No magic numbers; use named constants in central location

### P4.5: Remove duplicate time-unit constants
- **File:** `lib/constants.ts` lines 77-82
  - `NOTIFICATION_TIMING.MS_PER_MINUTE`, `MINUTES_PER_HOUR`, `MINUTES_PER_DAY` duplicate `TIME_UNITS`
  - Also `TIME_TRACKING` (lines 131-138) has same issue
- **Fix:** Reference `TIME_UNITS` instead of redefining

### P4.6: Refactor MCP server write handlers
- **File:** `packages/mcp-server/src/tools/handlers/write-handlers.ts`
  - `handleUpdateTask()` — 42 lines, 4 nesting levels
  - `handleDeleteTask()` — 36 lines, 3+ nesting levels
  - `handleCreateTask()` — 32 lines, 3-4 nesting levels
- **Standard:** Functions <=30 lines

### P4.7: Document environment variables in README
- **Gap:** No consolidated env var table in main README.md
- **Standard:** Document every environment variable with purpose, type, and default

---

## Items NOT Requiring Action

| Area | Finding |
|------|---------|
| Security | A+ — No secrets, proper validation, typed errors, filter escaping |
| Structured logging | 100% — logger.ts used everywhere, no raw console in app code |
| `any` usage | All 6 production instances properly documented with comments |
| tsconfig strict | Enabled globally |
| File naming | All kebab-case, no violations |
| Semantic HTML | Good baseline — `<button>`, `<label>`, `<section>` used correctly |
| Form accessibility | All inputs have associated `<label>` elements |
| Keyboard shortcuts | Well-documented with `<kbd>` elements |
| Test isolation | 9/10 — proper `beforeEach`/`afterEach`, no shared mutable state |
| Test naming | 9/10 — behavior-based `should_*` pattern |
| Error recovery | Retry with backoff, health monitoring, circuit-breaker patterns |

---

## Effort Estimates

| Priority | Items | Approx Effort |
|----------|-------|---------------|
| P1 (Critical) | 4 items | ~2-3 sessions |
| P2 (Important) | 4 items | ~2-3 sessions |
| P3 (Medium) | 4 items | ~1 session |
| P4 (Low) | 7 items | ~1-2 sessions |
| **Total** | **19 items** | **~6-9 sessions** |
