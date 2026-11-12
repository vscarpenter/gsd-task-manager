# Analytics

## Overview

This package computes dashboard statistics from an array of `TaskRecord` values. Every function is pure over its input and the current clock. Nothing here reads or writes storage.

`index.ts` is the barrel. Day boundaries use the device's local calendar.

## Interface

- `metrics.ts:calculateMetrics(tasks: TaskRecord[]): ProductivityMetrics`. Returns completion counts, streaks, completion rate, quadrant distribution, tag stats, and due date counts.
- `metrics.ts:getQuadrantPerformance(tasks: TaskRecord[])`. Returns per-quadrant totals and completion rates, highest rate first.
- `metrics.ts:ProductivityMetrics`. Interface for the result of `calculateMetrics`.
- `metrics.ts:TrendDataPoint`. Interface with `date` (`YYYY-MM-DD`), `completed`, and `created`.
- `streaks.ts:getStreakData(tasks: TaskRecord[]): StreakData`. Returns the current streak, the longest streak, the last completion day, and a seven day history.
- `streaks.ts:StreakData`. Interface with `current`, `longest`, `lastCompletionDate`, and `last7Days`.
- `tags.ts:calculateTagStatistics(tasks: TaskRecord[]): TagStatistic[]`. Returns per-tag totals and completion rates, highest count first.
- `types.ts:TagStatistic`. Interface with `tag`, `count`, `completedCount`, and `completionRate`. `metrics.ts` re-exports it.
- `trends.ts:getCompletionTrend(tasks: TaskRecord[], days: number): TrendDataPoint[]`. Returns one data point per day for the last `days` days, oldest first.
- `trends.ts:getRecurrenceBreakdown(tasks: TaskRecord[]): Record<RecurrenceType, number>`. Counts incomplete tasks by recurrence type.
- `time-tracking.ts:calculateTimeTrackingSummary(tasks: TaskRecord[]): TimeTrackingSummary`. Totals tracked and estimated minutes and estimation accuracy.
- `time-tracking.ts:getTimeByQuadrant(tasks: TaskRecord[]): QuadrantTimeDistribution[]`. Returns tracked minutes per quadrant in fixed quadrant order.
- `time-tracking.ts:getTimeComparisonData(tasks: TaskRecord[]): TaskTimeComparison[]`. Returns estimate versus actual per task, most over first. The barrel does not re-export it.
- `time-tracking.ts:formatDuration(minutes: number): string`. Formats minutes. Zero returns `0m`.
- `time-tracking.ts:TimeTrackingSummary`, `time-tracking.ts:QuadrantTimeDistribution`, `time-tracking.ts:TaskTimeComparison`. Result interfaces.
- `completion-day.ts:completionTime(task): Date`. Returns when a task was completed.
- `completion-day.ts:localDayKey(date: Date): string`. Returns the local calendar day as `yyyy-MM-dd`.
- `index.ts`. Re-exports the functions and types above, except `getTimeComparisonData`, `TaskTimeComparison`, `completionTime`, and `localDayKey`.

## Invariants

- `completion-day.ts:completionTime` falls back to `updatedAt` when `completedAt` is missing or unparseable. One bad record must not throw in `localDayKey` and take down the dashboard.
- `completion-day.ts:completionTime` must stay in step with the MCP copy in `packages/mcp-server/src/analytics/date-utils.ts`.
- `streaks.ts:getStreakData` breaks a streak when a local calendar day passes with no completed task.
- `streaks.ts:calculateCurrentStreak` steps local midnights, so a DST change cannot skip or repeat a day.
- `streaks.ts:getLast7Days` returns seven booleans in chronological order. Index 0 is six days ago and index 6 is today.
- `trends.ts:isInDay` uses the half-open range `[startDate, endDate)`. A moment at exactly local midnight belongs to the day that starts there.
- `metrics.ts:buildQuadrantDistribution` and `metrics.ts:calculateDueDateMetrics` count active (incomplete) tasks only.
- `time-tracking.ts:formatDuration` delegates to `formatTimeSpent` from `lib/tasks/crud/time-tracking.ts` for every nonzero value.

## Side Effects

- None

## Verification

- Run: `bun run test`
