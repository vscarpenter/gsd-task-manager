# Dashboard

## Overview

This directory has the presentational pieces of the dashboard and review surface.
It has a recharts trend chart, panels for quadrants, tags, time, deadlines, and streaks, a verdict text builder, and empty, error, and skeleton states.
All data arrives through props, with one exception: `FeedbackNudge` reads the feedback store.

## Interface

- `CompletionChart` (`completion-chart.tsx`): renders a recharts `ComposedChart` of Completed (area) against Created (dashed line). Props are `data: TrendDataPoint[]` and optional `control: React.ReactNode` for the header.
- `DashboardError` (`dashboard-error.tsx`): takes no props. It renders a `role="alert"` fallback with the heading "Couldn't read your review" and a "Try again" button.
- `VerdictSkeleton` (`dashboard-skeleton.tsx`): takes no props. It renders an `aria-hidden` two-line `Skeleton` placeholder.
- `StatRailSkeleton` (`dashboard-skeleton.tsx`): takes no props. It renders an `aria-hidden` three-column `Skeleton` placeholder.
- `DashboardSkeleton` (`dashboard-skeleton.tsx`): takes no props. It combines chart, distribution, streak, prompts, and two list skeletons.
- `EmptyRegion` (`empty-region.tsx`): renders a message line and an "Open matrix" `Link` to `ROUTES.HOME`. Props are `line: string` and optional `className`.
- `FeedbackNudge` (`feedback-nudge.tsx`): renders a feedback invitation with a "Send feedback" link and a "Not now" button, or `null`. Prop is `tasks: TaskRecord[]`.
- `QuadrantDistribution` (`quadrant-distribution.tsx`): renders active-task counts per quadrant as a segmented bar and a legend with percentages. Prop is `distribution: Record<QuadrantId, number>`.
- `ReviewPrompts` (`review-prompts.tsx`): renders three reflection prompts (Do First, Schedule, Eliminate) with active-task counts. Prop is `distribution: Record<QuadrantId, number>`.
- `ReviewVerdictText` (`review-verdict.tsx`): interface with string fields `lead` and `observation`.
- `buildReviewVerdict` (`review-verdict.tsx`): `(metrics: ProductivityMetrics) => ReviewVerdictText`. It builds two sentences from `completedThisWeek`, `activeTasks`, `overdueCount`, and `noDueDateCount`.
- `ReviewVerdict` (`review-verdict.tsx`): renders the `buildReviewVerdict` output as an `h2` lead and a paragraph. Prop is `metrics: ProductivityMetrics`.
- `StatsCard` (`stats-card.tsx`): renders one borderless measure with a count-up value. Props are `title`, `value: string | number`, and optional `note`, `meta`, `icon: LucideIcon`, `series: number[]`, and `className`.
- `StreakIndicator` (`streak-indicator.tsx`): renders the current streak, a seven-dot activity strip, and the best streak. Prop is `streakData: StreakData` (`current`, `longest`, `last7Days`).
- `TagAnalytics` (`tag-analytics.tsx`): renders per-tag horizontal bars with completed, total, and completion rate. Props are `tagStats: TagStatistic[]` and `maxTags?: number` (default 10).
- `TimeAnalytics` (`time-analytics.tsx`): renders time-tracking stat blocks, per-quadrant time bars, and estimation insights. Props are `summary: TimeTrackingSummary`, `quadrantDistribution: QuadrantTimeDistribution[]`, and optional `className`.
- `UpcomingDeadlines` (`upcoming-deadlines.tsx`): groups incomplete dated tasks into Overdue, Due today, and Due this week. Props are `tasks: TaskRecord[]` and optional `onTaskClick: (task: TaskRecord) => void`.

## Invariants

- `completion-chart.tsx:formatDate`: parses trend date keys with `parseISO` as local days. A comment states that `new Date()` would read them as UTC midnight.
- `completion-chart.tsx:CompletionChart`: the Y axis sets `allowDecimals={false}`.
- `empty-region.tsx:EmptyRegion`: a comment states that the link label is "Open matrix" everywhere. The link must keep `touch-target` with `inline-flex` for the 44px floor.
- `feedback-nudge.tsx:FeedbackNudge`: returns `null` unless `shouldShowFeedbackNudge` from `@/lib/feedback/nudge-eligibility` returns true.
- `feedback-nudge.tsx:FeedbackNudge`: passes `getServerFeedbackSnapshot` as the server snapshot. A comment states that the static export renders nothing and the client fills in after hydration.
- `feedback-nudge.tsx:dismissNudge`: `restoreFocusOrMainContent(null)` runs before `recordNudgeDismissed`, because the pressed button is about to unmount.
- `feedback-nudge.tsx:CONTROL_CLASS`: a comment requires an underline at rest on both controls and cites WCAG 1.4.1.
- `quadrant-distribution.tsx:QuadrantDistribution`: only quadrants with `value > 0` become segments. Zero segments renders `EmptyRegion` in place of the bar.
- `review-prompts.tsx:ReviewPrompts`: a comment states that counts describe active tasks only. `PROMPTS` covers three quadrants and omits `urgent-not-important`.
- `review-verdict.tsx:observe`: precedence is zero active, then `overdue > 0`, then `undated > 0`. The last case is that all open tasks have due dates.
- `review-verdict.tsx:buildReviewVerdict`: the lead is "Nothing completed this week." when `completedThisWeek === 0`. A comment says the verdict never characterizes the quadrant of completed work.
- `stats-card.tsx:StatsCard`: the sparkline renders only when `series.length > 1`. The note and meta paragraph renders only when one of them is set.
- `stats-card.tsx:Sparkline`: `max` has a floor of 1, and `range` falls back to 1 when max equals min. This avoids division by zero.
- `stats-card.tsx:Sparkline`: a comment requires stroke `--ink-hint` over `--ink-3` for the 3:1 graphic contrast floor (WCAG 1.4.11).
- `streak-indicator.tsx:StreakIndicator`: labels `last7Days` entries by index from `DAY_LABELS` (seven entries, "6d" to "Today"). A comment forbids `h-full` on the card.
- `tag-analytics.tsx:TagAnalytics`: shows at most `maxTags` tags. Bar width has a 4% minimum, `maxCount` has a floor of 1, and an empty list renders `EmptyRegion`.
- `time-analytics.tsx:TimeAnalytics`: renders the empty state unless `tasksWithTimeTracking > 0` or `tasksWithEstimates > 0`. Quadrant bars render only when `totalMinutesTracked > 0`.
- `time-analytics.tsx:QuadrantBar`: the percentage is 0 when `totalMinutes` is not greater than 0.
- `time-analytics.tsx:EstimationInsights`: returns `null` when `overCount` and `underCount` are both 0.
- `time-analytics.tsx:getAccuracyLabel`: bands are 0 "not enough data", under 80 "over-estimating", 80 to 120 "good accuracy", and over 120 "under-estimating".
- `time-analytics.tsx:getAccuracyColor`: 0 gives no color and 80 to 120 gives success ink. Over 150 or under 50 gives overdue ink. Anything else gives `text-warning-dark`.
- `upcoming-deadlines.tsx:UpcomingDeadlines`: skips tasks that are `completed` or lack `dueDate`. Classification order is `isOverdue`, then `isDueToday`, then due within seven days of now.
- `upcoming-deadlines.tsx:DeadlineSection`: lists at most five tasks per section, then a "+N more" row.
- `upcoming-deadlines.tsx:formatDueDate`: uses `differenceInCalendarDays`. A comment states that rounding hours mislabeled a task due tomorrow evening as "In 2 days".

## Side Effects

- `dashboard-error.tsx:DashboardError`: the "Try again" button calls `window.location.reload()`.
- `empty-region.tsx:EmptyRegion`: renders a `next/link` `Link` with `href={ROUTES.HOME}`.
- `feedback-nudge.tsx:FeedbackNudge`: subscribes through `useSyncExternalStore` to `subscribeToFeedback` and `getFeedbackSnapshot` from `@/lib/feedback/feedback-store`.
- `feedback-nudge.tsx:FeedbackNudge`: renders a `next/link` `Link` with `href="/settings#feedback"`.
- `feedback-nudge.tsx:dismissNudge`: calls `restoreFocusOrMainContent(null)` from `@/lib/focus-restoration`, which moves focus.
- `feedback-nudge.tsx:dismissNudge`: calls `recordNudgeDismissed(new Date().toISOString())` from `@/lib/feedback/feedback-store`.
- `stats-card.tsx:StatsCard`: calls `useCountUp(value)` from `@/lib/use-count-up`.
- `upcoming-deadlines.tsx:DeadlineSection`: a task button click invokes the caller's `onTaskClick?.(task)` callback.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
