# Dashboard (Review) Page

## Overview
`page.tsx` is the client page for the dashboard route. It renders the weekly review inside `AppShell` under the title "Review". `use-dashboard-data.ts` derives every displayed analytics value from the task list.

## Interface
- `DashboardPage` (`page.tsx`, default export): renders `AppShell` from `@/components/matrix-simplified/app-shell`, then an `ErrorBoundary` around the private `ReviewBody`. The boundary's `fallback` is `DashboardError` from `@/components/dashboard/dashboard-error`.
- `ReviewBody` (`page.tsx`, private): reads tasks with `useTasks()` from `@/lib/use-tasks` and calls `useDashboardData`.
- `useDashboardData(tasks, trendPeriod)` (`use-dashboard-data.ts`, exported): returns `DashboardData`. It calls `calculateMetrics`, `getCompletionTrend`, `getStreakData`, `calculateTimeTrackingSummary`, and `getTimeByQuadrant` from `@/lib/analytics`. It calls no React hooks.
- `DashboardData` (`use-dashboard-data.ts`, exported interface): metrics, trend and streak data, time summaries, three 7-day series, and the insight strings.
- `page.tsx` renders these components from `@/components/dashboard/`: `ReviewVerdict`, `StatsCard`, `CompletionChart`, `QuadrantDistribution`, `StreakIndicator`, `ReviewPrompts`, `UpcomingDeadlines`, `TagAnalytics`, `TimeAnalytics`, `FeedbackNudge`, and the skeletons.
- `page.tsx` also renders `SweepLink` from `@/components/weekly-sweep/sweep-link`.

## Invariants
- The `ErrorBoundary` wraps the data region only, and `AppShell` sits outside it. A comment in `DashboardPage` says a failed local read must not cost the reader the navigation.
- `ReviewBody` treats the page as empty when loading is done and `tasks.length === 0`. It then renders `DashboardEmpty`.
- `TrendPeriod` is 7, 30, or 90, and it starts at 30 (`ReviewBody`, `TREND_OPTIONS`).
- In `useDashboardData`, the stat-rail series and pace figures always use the 7-day trend. Only `trendData` follows `trendPeriod`.
- `completionRateSeries` divides by `p.created || 1`, so a day with no created tasks does not divide by zero.
- `plannedActiveShare` is 0 when `metrics.activeTasks` is not above 0.
- `completedInsight` reports above or below pace only when `completedTrend` is beyond 10 percent in either direction.

## Side Effects
- `DashboardPage.openMatrixAction` calls `router.push` to the matrix, with a query string when given one.
- `handleDeadlineTaskClick` navigates to `/?highlight=<task.id>`. The new-task shortcut navigates to `/?action=new-task`.
- The search shortcut dispatches `OPEN_COMMAND_PALETTE_EVENT` on `window`. The help shortcut dispatches `gsd:open-help`.
- `page.tsx` reads tasks through `useTasks()` and writes nothing.
- `use-dashboard-data.ts`: None

## Verification
- Run: `bun run test`
