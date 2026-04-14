# 0006: Pure-Function Modular Analytics Design

**Date:** 2026-04-14
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

As the analytics dashboard grew to include productivity scores, completion streaks, tag breakdowns, trend analysis, and time-tracking metrics, the calculation logic became a significant portion of the codebase. The initial approach of inline calculations inside dashboard components was difficult to test, reuse, and reason about independently. Analytics also needed to be accessible from the MCP server (ADR-0005), which runs outside the React component tree.

## Decision

Extract all metric calculations into pure functions in `lib/analytics/`, split across focused modules: `metrics.ts` (productivity scores, completion rates), `streaks.ts` (current and longest streaks), `tags.ts` (tag frequency and distribution), `trends.ts` (week-over-week comparisons), and `time-tracking.ts` (estimated vs. actual time analysis). Each module exports functions that accept task arrays and configuration as arguments and return derived values — no side effects, no direct Dexie calls, no React hooks. Components and the MCP server call these functions by passing in data fetched from their respective layers.

## Consequences

### Easier
- Every analytics function is independently unit-testable with plain data fixtures — no DOM, no IndexedDB mocking required.
- The MCP server's analytics tools (`get_productivity_metrics`, `get_task_insights`, etc.) reuse the same logic as the dashboard.
- Modules stay under the 350-line file limit, keeping diffs focused and reviewable.
- Pure functions compose naturally — trends can call metrics, tag analytics can call filters.
- Coverage targets (≥80%) are straightforward to hit for pure functions.

### Harder
- Components must explicitly fetch task data and pass it into analytics functions rather than having analytics manage their own data access.
- Adding a new metric requires touching both the analytics module and any consumer that wants to display it.
- Stateful concerns (e.g., caching expensive computations) must be handled at the call site rather than inside analytics functions.

## Alternatives Considered

- **Class-based analytics service**: A singleton `AnalyticsService` with internal state and Dexie access. Rejected — harder to test in isolation, introduces implicit dependencies, and conflicts with the functional style used elsewhere in `lib/`.
- **Inline calculations in dashboard components**: Fast to implement but mixes presentation and logic, makes reuse difficult, and produces untestable business rules trapped inside React components.
- **Dedicated analytics worker (Web Worker)**: Offloads CPU-intensive calculations off the main thread. Considered for future optimization but premature at current data volumes; pure functions are easy to migrate to a worker later if needed.
