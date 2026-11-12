# Analytics

## Overview

This directory computes productivity analytics from a `Task[]` array. It covers completion counts and rates, streaks, quadrant performance, tag statistics, deadline groups, and a plain-text insights summary. The functions make no network calls. Date math uses the host's local time zone and the current clock.

## Interface

Metrics (`metrics.ts`):

- `calculateMetrics`: builds a `ProductivityMetrics` object from tasks, relative to the current date.
- `getQuadrantPerformance`: returns metrics for all four quadrants, sorted by `completionRate` descending.
- `getUpcomingDeadlines`: groups incomplete tasks that have a `dueDate` into `overdue`, `dueToday`, and `dueThisWeek`.
- `QuadrantId`: union type of the four quadrant ID strings.
- `ProductivityMetrics`: completion counts, streaks, `completionRate`, `quadrantDistribution`, `tagStats`, due-date counts, and task totals.
- `TagStatistic`: `{tag, count, completedCount, completionRate}`.
- `QuadrantPerformance`: `{quadrantId, name, completionRate, totalTasks, completedTasks, activeTasks}`.
- `UpcomingDeadlines`: `{overdue, dueToday, dueThisWeek}`, each a `Task` array.

Streaks (`streaks.ts`):

- `getStreakData`: computes the current and longest daily completion streaks from completed tasks.
- `StreakData`: `{current, longest, lastCompletionDate}`.

Summary (`aggregator.ts`):

- `generateInsightsSummary`: returns newline-joined insight lines built from `calculateMetrics`, `getQuadrantPerformance`, and `getUpcomingDeadlines`.

Date helpers (`date-utils.ts`):

- `startOfDay`, `startOfWeek`, `startOfMonth`: return a copy of the date at the local start of that period.
- `isAfter`, `isBefore`: strict `getTime()` comparisons.
- `subDays`: returns a copy of the date with local calendar days subtracted.
- `isDueToday`, `isDueThisWeek`: test a due date against a given today value.
- `completionTime`: returns `completedAt` as a `Date`, falling back to `updatedAt`.
- `localDayKey`: formats a `Date` as a local `YYYY-MM-DD` string.
- `daysBetweenKeys`: returns the whole-day difference between two `YYYY-MM-DD` keys.

Barrel (`index.ts`):

- Re-exports the metrics and streak types, the five core functions, and eight date helpers.
- It does not re-export `completionTime`, `localDayKey`, or `daysBetweenKeys`.

## Invariants

- `date-utils.ts:startOfWeek`: the week starts on Sunday at local midnight.
- `date-utils.ts:completionTime`: a missing or unparseable `completedAt` falls back to `updatedAt`. Its comment says to keep this in step with the web app's `lib/analytics/completion-day.ts`.
- `date-utils.ts:daysBetweenKeys`: keys parse as UTC midnight and the result is rounded, so daylight saving shifts do not change it.
- `date-utils.ts:isDueThisWeek`: the window excludes both ends (after today, before today plus 7 days).
- `metrics.ts:calculateMetrics`: `completionRate` is a rounded integer percentage, and 0 when there are no tasks.
- `metrics.ts:calculateCompletionCounts`: a task counts when its `completionTime` is not before the start of today, the week, or the month.
- `metrics.ts:calculateQuadrantDistribution`: counts incomplete tasks only. All four quadrant keys start at 0.
- `metrics.ts:calculateDueDateMetrics`: a task is overdue when it is incomplete and its `dueDate` is before the local start of today.
- `metrics.ts:calculateTagStatistics`: `tagStats` are sorted by `count` descending.
- `metrics.ts:getQuadrantDefinitions`: the names are `Q1: Do First`, `Q2: Schedule`, `Q3: Delegate`, and `Q4: Eliminate`.
- `metrics.ts:getUpcomingDeadlines`: each group is sorted by `dueDate` ascending.
- `streaks.ts:getStreakData`: returns `{current: 0, longest: 0, lastCompletionDate: null}` when no task is completed.
- `streaks.ts:calculateCurrentStreak`: counts consecutive local days back from today, so it is 0 with no completion today.
- `streaks.ts:calculateLongestStreak`: the result is never lower than the current streak.
- `aggregator.ts:addQuadrantInsights`: picks the quadrant by active task count, not by completion rate.

## Side Effects

- `metrics.ts:calculateMetrics` and `metrics.ts:getUpcomingDeadlines` read the current clock with `new Date()`.
- `streaks.ts:calculateCurrentStreak` (called by `getStreakData`) reads the current clock with `new Date()`.
- `aggregator.ts:generateInsightsSummary` reads the clock through `calculateMetrics` and `getUpcomingDeadlines`.
- `date-utils.ts:startOfDay`, `startOfWeek`, `startOfMonth`, `subDays`, and `localDayKey` depend on the host's local time zone.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
